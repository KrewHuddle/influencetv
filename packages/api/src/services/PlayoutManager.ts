import type Redis from "ioredis";
import { query } from "../config/database";
import { redisClient } from "../config/redis";
import { PlayoutEngine } from "./PlayoutEngine";

const KILL_CHANNEL = "apex:kill-stream";
const CONTROL_CHANNEL = "apex:playout:control";
const HEARTBEAT_TTL = 30; // seconds

interface ControlCommand {
  action: "start" | "stop" | "restart";
  channelId: string;
  slug?: string;
}

/** Owns one PlayoutEngine per active channel, with a Redis control plane. */
class PlayoutManager {
  private engines = new Map<string, PlayoutEngine>();
  private sub: Redis | null = null;

  /** Boot engines for every active channel (call on streaming-server startup). */
  async startAll(): Promise<void> {
    const { rows } = await query<{ id: string; slug: string }>(
      "SELECT id, slug FROM channels WHERE status <> 'offline' OR status IS NULL"
    );
    await Promise.all(rows.map((c) => this.startChannel(c.id, c.slug)));
  }

  async startChannel(channelId: string, slug = ""): Promise<void> {
    if (this.engines.has(channelId)) return;
    const engine = new PlayoutEngine(channelId, slug);
    this.engines.set(channelId, engine);
    await engine.start();
  }

  async stopChannel(channelId: string): Promise<void> {
    const engine = this.engines.get(channelId);
    if (!engine) return;
    await engine.stop();
    this.engines.delete(channelId);
    await redisClient.del(`playout:heartbeat:${channelId}`).catch(() => undefined);
  }

  async restartChannel(channelId: string): Promise<void> {
    await this.stopChannel(channelId);
    await this.startChannel(channelId);
  }

  getStatus(): Array<{ channelId: string; running: boolean; itemId: string | null }> {
    return [...this.engines.values()].map((e) => ({
      channelId: e.channelId,
      running: e.running,
      itemId: e.playingItemId,
    }));
  }

  /**
   * Subscribe to the control plane. `apex:kill-stream` now actually stops the
   * engine (previously nothing listened → kill was a no-op). `apex:playout:control`
   * accepts JSON start/stop/restart commands from the API.
   */
  async listenForControl(): Promise<void> {
    const sub = redisClient.duplicate();
    this.sub = sub;
    await sub.subscribe(KILL_CHANNEL, CONTROL_CHANNEL);
    sub.on("message", (channel, message) => {
      if (channel === KILL_CHANNEL) {
        void this.stopChannel(message).catch(() => undefined);
        return;
      }
      if (channel === CONTROL_CHANNEL) {
        try {
          const cmd = JSON.parse(message) as ControlCommand;
          if (cmd.action === "start") void this.startChannel(cmd.channelId, cmd.slug ?? "");
          else if (cmd.action === "stop") void this.stopChannel(cmd.channelId);
          else if (cmd.action === "restart") void this.restartChannel(cmd.channelId);
        } catch {
          /* malformed command — ignore */
        }
      }
    });
  }

  /** Periodically publish per-engine heartbeats to Redis for the API to read. */
  startHeartbeat(intervalMs = 10_000): void {
    const t = setInterval(() => {
      for (const e of this.engines.values()) {
        void redisClient
          .set(
            `playout:heartbeat:${e.channelId}`,
            JSON.stringify({ running: e.running, itemId: e.playingItemId, ts: Date.now() }),
            "EX",
            HEARTBEAT_TTL
          )
          .catch(() => undefined);
      }
    }, intervalMs);
    t.unref?.();
  }

  /** Restart any engine that has fallen out of its run loop (self-healing). */
  startSupervisor(intervalMs = 15_000): void {
    const t = setInterval(() => {
      for (const [id, e] of this.engines) {
        if (!e.running) void this.restartChannel(id).catch(() => undefined);
      }
    }, intervalMs);
    t.unref?.();
  }

  async shutdown(): Promise<void> {
    await Promise.all([...this.engines.keys()].map((id) => this.stopChannel(id)));
    await this.sub?.quit().catch(() => undefined);
  }
}

export const playoutManager = new PlayoutManager();
