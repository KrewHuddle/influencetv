import { query } from "../config/database";
import { PlayoutEngine } from "./PlayoutEngine";

/** Owns one PlayoutEngine per active channel. */
class PlayoutManager {
  private engines = new Map<string, PlayoutEngine>();

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
}

export const playoutManager = new PlayoutManager();
