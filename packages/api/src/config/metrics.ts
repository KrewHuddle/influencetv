import client from "prom-client";
import { transcodeQueue } from "./queue";
import { redisClient } from "./redis";

/**
 * Prometheus metrics registry. Scraped at GET /metrics. Covers HTTP traffic,
 * the transcode queue, playout channel health (read from the shared Redis
 * heartbeats the streaming droplet writes), socket connections, and ad
 * impressions served by this process.
 *
 * NOTE: linear ad impressions are recorded by the separate playout process on
 * the streaming droplet — `ad_impressions_total{placement="vod"}` here counts
 * only VOD serves from the API. Instrument the playout process separately for a
 * complete ad-impression picture.
 */
export const registry = new client.Registry();
registry.setDefaultLabels({ service: "apex-api" });
client.collectDefaultMetrics({ register: registry });

export const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [registry],
});

export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests handled",
  labelNames: ["method", "route", "status"] as const,
  registers: [registry],
});

export const httpErrorsTotal = new client.Counter({
  name: "http_errors_total",
  help: "Unhandled 5xx errors",
  registers: [registry],
});

export const socketConnections = new client.Gauge({
  name: "socket_connections",
  help: "Currently connected Socket.io clients",
  registers: [registry],
});

export const adImpressionsTotal = new client.Counter({
  name: "ad_impressions_total",
  help: "Ad impressions served by this process",
  labelNames: ["placement"] as const,
  registers: [registry],
});

// ── Async-collected gauges (evaluated on each scrape) ──

// Transcode queue depth by job state — the backpressure signal for scaling
// workers (Phase 6.3). Concurrency is currently a hardcoded 2.
new client.Gauge({
  name: "transcode_queue_depth",
  help: "BullMQ transcode jobs by state",
  labelNames: ["state"] as const,
  registers: [registry],
  // `this` is typed as the Gauge by prom-client's CollectFunction signature.
  async collect() {
    try {
      const c = await transcodeQueue.getJobCounts(
        "waiting",
        "active",
        "delayed",
        "failed"
      );
      this.set({ state: "waiting" }, c.waiting ?? 0);
      this.set({ state: "active" }, c.active ?? 0);
      this.set({ state: "delayed" }, c.delayed ?? 0);
      this.set({ state: "failed" }, c.failed ?? 0);
    } catch {
      /* redis blip — leave last value */
    }
  },
});

// Playout channels reporting a fresh heartbeat with running=true. Alert when
// this drops below the number of active channels (a channel went dark).
new client.Gauge({
  name: "playout_channels_up",
  help: "Playout channels with a fresh running heartbeat",
  registers: [registry],
  async collect() {
    try {
      const keys = await redisClient.keys("playout:heartbeat:*");
      let up = 0;
      for (const k of keys) {
        const raw = await redisClient.get(k);
        if (!raw) continue;
        try {
          const hb = JSON.parse(raw) as { running?: boolean };
          if (hb.running) up += 1;
        } catch {
          /* malformed heartbeat — skip */
        }
      }
      this.set(up);
    } catch {
      /* redis blip — leave last value */
    }
  },
});
