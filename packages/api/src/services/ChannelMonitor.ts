import { query } from "../config/database";
import { redisClient } from "../config/redis";
import { logger } from "../config/logger";
import { Sentry, sentryEnabled } from "../config/sentry";

/**
 * Synthetic playout monitoring, run from the API droplet (a different host
 * than the streaming droplet it watches). Every sweep, for each active
 * channel, two checks:
 *
 *  1. Playout heartbeat exists in Redis (written every 10s, TTL 30s).
 *  2. The public HLS manifest is reachable AND its media sequence advanced
 *     since the previous sweep — an HTTP 200 with frozen segments is the
 *     classic silent-death mode a plain uptime check misses.
 *
 * Two consecutive failing sweeps → alert (webhook + Sentry + log); recovery
 * alerts once; while down, reminders every REMIND_INTERVAL. Set
 * ALERT_WEBHOOK_URL to a Slack- or Discord-compatible webhook. Disable with
 * MONITOR_DISABLED=true.
 */

const CHECK_INTERVAL_MS = 60_000;
const REMIND_INTERVAL_MS = 15 * 60_000;
const FAILS_TO_ALERT = 2;
const FETCH_TIMEOUT_MS = 10_000;

interface ChannelRow {
  id: string;
  name: string;
  slug: string;
  hls_output_url: string | null;
}

interface ChannelState {
  fails: number;
  alerted: boolean;
  lastAlertAt: number;
  lastSeq: string | null;
  lastReason: string;
}

export class ChannelMonitor {
  private states = new Map<string, ChannelState>();
  private timer: NodeJS.Timeout | null = null;
  private sweeping = false;

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      if (this.sweeping) return; // never overlap sweeps
      this.sweeping = true;
      void this.sweep()
        .catch((err) => logger.error({ err }, "channel monitor sweep failed"))
        .finally(() => {
          this.sweeping = false;
        });
    }, CHECK_INTERVAL_MS);
    this.timer.unref?.();
    logger.info("channel monitor started");
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async sweep(): Promise<void> {
    const { rows } = await query<ChannelRow>(
      "SELECT id, name, slug, hls_output_url FROM channels WHERE status = 'active'"
    );
    const activeIds = new Set(rows.map((r) => r.id));
    for (const id of this.states.keys()) {
      if (!activeIds.has(id)) this.states.delete(id); // operator-stopped: not an incident
    }
    for (const c of rows) {
      await this.checkChannel(c);
    }
  }

  private async checkChannel(c: ChannelRow): Promise<void> {
    const st: ChannelState = this.states.get(c.id) ?? {
      fails: 0,
      alerted: false,
      lastAlertAt: 0,
      lastSeq: null,
      lastReason: "",
    };
    this.states.set(c.id, st);

    let reason: string | null = null;

    const hb = await redisClient.get(`playout:heartbeat:${c.id}`).catch(() => null);
    if (!hb) {
      reason = "no playout heartbeat";
    } else {
      const seq = await this.manifestSequence(c.hls_output_url);
      if (seq === null) {
        reason = "HLS manifest unreachable";
      } else if (st.lastSeq !== null && seq === st.lastSeq) {
        reason = "HLS segments not advancing (stale manifest)";
      }
      if (seq !== null) st.lastSeq = seq;
    }

    if (reason === null) {
      if (st.alerted) await this.alert("recovered", c, st.lastReason);
      st.fails = 0;
      st.alerted = false;
      st.lastReason = "";
      return;
    }

    st.fails += 1;
    st.lastReason = reason;
    const now = Date.now();
    if (
      st.fails >= FAILS_TO_ALERT &&
      (!st.alerted || now - st.lastAlertAt > REMIND_INTERVAL_MS)
    ) {
      st.alerted = true;
      st.lastAlertAt = now;
      await this.alert("down", c, reason);
    }
  }

  /**
   * Fingerprint of the live playlist position: media-sequence + last segment
   * URI. For a master playlist, follows the first variant. Null = unreachable.
   */
  private async manifestSequence(url: string | null): Promise<string | null> {
    if (!url) return null;
    const text = await this.fetchText(url);
    if (!text) return null;
    if (text.includes("#EXT-X-STREAM-INF")) {
      const variant = text
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l && !l.startsWith("#"));
      if (!variant) return null;
      const base = url.slice(0, url.lastIndexOf("/") + 1);
      const variantUrl = variant.startsWith("http") ? variant : base + variant;
      const vtext = await this.fetchText(variantUrl);
      if (!vtext) return null;
      return this.playlistFingerprint(vtext);
    }
    return this.playlistFingerprint(text);
  }

  private playlistFingerprint(playlist: string): string | null {
    const seq = playlist.match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/)?.[1] ?? "";
    const segments = playlist
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
    const last = segments[segments.length - 1] ?? "";
    if (!seq && !last) return null;
    return `${seq}|${last}`;
  }

  private async fetchText(url: string): Promise<string | null> {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  }

  private async alert(kind: "down" | "recovered", c: ChannelRow, reason: string): Promise<void> {
    const msg =
      kind === "down"
        ? `🔴 Playout DOWN: ${c.name} (${c.slug}) — ${reason}`
        : `🟢 Playout recovered: ${c.name} (${c.slug})${reason ? ` — was: ${reason}` : ""}`;

    if (kind === "down") logger.error({ channelId: c.id, reason }, msg);
    else logger.info({ channelId: c.id }, msg);

    if (sentryEnabled) {
      Sentry.captureMessage(msg, kind === "down" ? "error" : "info");
    }

    const hook = process.env.ALERT_WEBHOOK_URL;
    if (hook) {
      // `text` = Slack shape, `content` = Discord shape; harmless extras either way.
      await fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msg, content: msg }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }).catch((err) => logger.warn({ err }, "alert webhook delivery failed"));
    }
  }
}

export const channelMonitor = new ChannelMonitor();
