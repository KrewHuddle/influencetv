import { spawn, type ChildProcess } from "child_process";
import { mkdir, readdir, rm, stat } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { query } from "../config/database";
import { redisClient } from "../config/redis";
import { buckets } from "../config/storage";
import { downloadToFile } from "../utils/s3";
import { getIo, rooms } from "../sockets";

const VOD_CACHE = "/tmp/apex-vod";
const CACHE_LIMIT_BYTES = 20 * 1024 * 1024 * 1024; // 20GB
const GAP_FILLER_THRESHOLD = 30; // seconds
const NOWPLAYING_TTL = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ScheduleItem {
  id: string;
  video_id: string | null;
  title: string;
  start_time: Date;
  end_time: Date;
  s3_original_key: string | null;
  hls_url: string | null;
  thumbnail_url: string | null;
  slug: string;
}

/** Drives one channel's continuous playout to rtmp://localhost/vod/{slug}. */
export class PlayoutEngine {
  private isRunning = false;
  private currentProcess: ChildProcess | null = null;
  private currentItemId: string | null = null;

  constructor(
    public readonly channelId: string,
    private slug = ""
  ) {}

  async start(): Promise<void> {
    if (this.isRunning) return;
    const { rows } = await query<{ slug: string }>(
      "SELECT slug FROM channels WHERE id = $1",
      [this.channelId]
    );
    if (!rows[0]) throw new Error(`Channel ${this.channelId} not found`);
    this.slug = rows[0].slug;
    this.isRunning = true;
    await query("UPDATE channels SET status='active' WHERE id=$1", [this.channelId]);
    this.safeEmit(rooms.admin(), "channel-online", { channelId: this.channelId });
    void this.mainLoop();
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.killCurrent();
    await query("UPDATE channels SET status='offline' WHERE id=$1", [this.channelId]);
    await redisClient.del(`nowplaying:${this.channelId}`);
  }

  private async killCurrent(): Promise<void> {
    const proc = this.currentProcess;
    if (!proc) return;
    proc.kill("SIGTERM");
    await Promise.race([
      new Promise<void>((r) => proc.once("close", () => r())),
      sleep(5000),
    ]);
    if (!proc.killed) proc.kill("SIGKILL");
    this.currentProcess = null;
  }

  private async mainLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        const item = await this.currentScheduleItem();
        if (item) {
          await this.playItem(item);
        } else {
          // Gap: fill if the next item is far enough out.
          const next = await this.nextScheduleItem();
          const filler = await this.pickFiller();
          if (filler) {
            const untilNext = next
              ? (new Date(next.start_time).getTime() - Date.now()) / 1000
              : Infinity;
            if (untilNext > GAP_FILLER_THRESHOLD) {
              await this.playItem(filler, true);
              continue;
            }
          }
          await sleep(2000);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[playout ${this.slug}] loop error:`, (err as Error).message);
        await sleep(2000);
      }
    }
  }

  private async currentScheduleItem(): Promise<ScheduleItem | null> {
    const { rows } = await query<ScheduleItem>(
      `SELECT s.id, s.video_id, s.title, s.start_time, s.end_time,
              v.s3_original_key, v.hls_url, v.thumbnail_url, c.slug
       FROM schedule s
       JOIN channels c ON c.id = s.channel_id
       LEFT JOIN videos v ON v.id = s.video_id
       WHERE s.channel_id = $1 AND s.start_time <= NOW() AND s.end_time > NOW()
       ORDER BY s.start_time ASC LIMIT 1`,
      [this.channelId]
    );
    return rows[0] ?? null;
  }

  private async nextScheduleItem(): Promise<ScheduleItem | null> {
    const { rows } = await query<ScheduleItem>(
      `SELECT s.id, s.video_id, s.title, s.start_time, s.end_time,
              v.s3_original_key, v.hls_url, v.thumbnail_url, c.slug
       FROM schedule s
       JOIN channels c ON c.id = s.channel_id
       LEFT JOIN videos v ON v.id = s.video_id
       WHERE s.channel_id = $1 AND s.start_time > NOW()
       ORDER BY s.start_time ASC LIMIT 1`,
      [this.channelId]
    );
    return rows[0] ?? null;
  }

  private async pickFiller(): Promise<ScheduleItem | null> {
    const { rows } = await query<ScheduleItem>(
      `SELECT v.id AS video_id, v.title, v.s3_original_key, v.hls_url,
              v.thumbnail_url, c.slug,
              NOW() AS start_time, NOW() + interval '5 minutes' AS end_time,
              gen_random_uuid() AS id
       FROM videos v CROSS JOIN channels c
       WHERE c.id = $1 AND v.status='ready' AND v.s3_original_key IS NOT NULL
       ORDER BY random() LIMIT 1`,
      [this.channelId]
    );
    return rows[0] ?? null;
  }

  private async playItem(item: ScheduleItem, isFiller = false): Promise<void> {
    if (!item.video_id || !item.s3_original_key) {
      await sleep(2000);
      return;
    }
    const localPath = await this.downloadVOD(item.video_id, item.s3_original_key);
    const seek = isFiller
      ? 0
      : Math.max(0, Math.floor((Date.now() - new Date(item.start_time).getTime()) / 1000));

    await this.broadcastNowPlaying(item, seek);

    await new Promise<void>((resolve) => {
      const proc = spawn("ffmpeg", this.buildFFmpegArgs(localPath, seek), {
        stdio: ["ignore", "ignore", "pipe"],
      });
      this.currentProcess = proc;
      this.currentItemId = item.id;

      // Advance when the scheduled end_time passes.
      const endMs = new Date(item.end_time).getTime();
      const watchdog = setInterval(() => {
        if (!this.isRunning || Date.now() >= endMs) {
          clearInterval(watchdog);
          proc.kill("SIGTERM");
        }
      }, 1000);

      proc.on("close", () => {
        clearInterval(watchdog);
        this.currentProcess = null;
        resolve();
      });
      proc.on("error", () => {
        clearInterval(watchdog);
        this.currentProcess = null;
        resolve();
      });
    });
  }

  private buildFFmpegArgs(localPath: string, seekOffset: number): string[] {
    return [
      "-re",
      "-ss", String(seekOffset),
      "-i", localPath,
      "-c", "copy",
      "-f", "flv",
      `rtmp://localhost/vod/${this.slug}`,
    ];
  }

  private async broadcastNowPlaying(item: ScheduleItem, elapsed: number): Promise<void> {
    const payload = {
      event: "now-playing",
      videoId: item.video_id,
      title: item.title,
      startTime: item.start_time,
      endTime: item.end_time,
      thumbnail: item.thumbnail_url,
      elapsedSeconds: elapsed,
    };
    await redisClient.set(
      `nowplaying:${this.channelId}`,
      JSON.stringify(payload),
      "EX", NOWPLAYING_TTL
    );
    await query(
      "UPDATE channels SET current_video_id=$1, current_program_start=$2 WHERE id=$3",
      [item.video_id, item.start_time, this.channelId]
    );
    this.safeEmit(rooms.channel(this.channelId), "now-playing", payload);
  }

  // ── VOD cache with 20GB LRU eviction ──
  private async downloadVOD(videoId: string, s3Key: string): Promise<string> {
    await mkdir(VOD_CACHE, { recursive: true });
    const dest = join(VOD_CACHE, `${videoId}.mp4`);
    if (existsSync(dest)) return dest;
    await this.evictIfNeeded();
    await downloadToFile(buckets.uploads, s3Key, dest);
    return dest;
  }

  private async evictIfNeeded(): Promise<void> {
    const entries = await readdir(VOD_CACHE).catch(() => [] as string[]);
    const stats = await Promise.all(
      entries.map(async (name) => {
        const p = join(VOD_CACHE, name);
        const s = await stat(p);
        return { p, size: s.size, atime: s.atimeMs };
      })
    );
    let total = stats.reduce((n, s) => n + s.size, 0);
    stats.sort((a, b) => a.atime - b.atime); // oldest access first
    for (const s of stats) {
      if (total <= CACHE_LIMIT_BYTES) break;
      await rm(s.p, { force: true });
      total -= s.size;
    }
  }

  private safeEmit(room: string, event: string, payload: unknown): void {
    try {
      getIo().to(room).emit(event, payload);
    } catch {
      /* socket not initialised in standalone playout process */
    }
  }

  get running(): boolean {
    return this.isRunning;
  }

  get playingItemId(): string | null {
    return this.currentItemId;
  }
}
