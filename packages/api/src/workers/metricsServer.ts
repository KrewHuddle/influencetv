import http from "http";
import { registry } from "../config/metrics";
import { isDbConnected } from "../config/database";
import { isRedisConnected } from "../config/redis";
import { logger } from "../config/logger";

/**
 * Minimal health + Prometheus endpoint for a standalone worker host. No-op
 * unless WORKER_METRICS_PORT is set. Lets Prometheus scrape the extracted
 * transcode droplet (queue depth, default process metrics) and an uptime check
 * hit /health — the worker process has no Express server of its own.
 */
export function startWorkerMetricsServer(): http.Server | null {
  const port = Number(process.env.WORKER_METRICS_PORT) || 0;
  if (!port) return null;

  const server = http.createServer((req, res) => {
    void (async () => {
      if (req.url === "/health") {
        const [db, redis] = await Promise.all([isDbConnected(), isRedisConnected()]);
        res.writeHead(db && redis ? 200 : 503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: db && redis ? "ok" : "degraded", db, redis }));
        return;
      }
      if (req.url === "/metrics") {
        res.writeHead(200, { "Content-Type": registry.contentType });
        res.end(await registry.metrics());
        return;
      }
      res.writeHead(404);
      res.end();
    })();
  });
  server.listen(port, () => logger.info({ port }, "Worker metrics server listening"));
  return server;
}
