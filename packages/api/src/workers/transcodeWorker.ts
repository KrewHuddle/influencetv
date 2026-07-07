import { spawn } from "child_process";
import { mkdir, rm, readdir } from "fs/promises";
import { join } from "path";
import { Worker, type Job } from "bullmq";
import { TRANSCODE_QUEUE, type TranscodeJob } from "../config/queue";
import { redisClient, bullConnection } from "../config/redis";
import { query } from "../config/database";
import { buckets, cdnUrl } from "../config/storage";
import { downloadToFile, uploadFile, readFileBytes } from "../utils/s3";
import { isImageNSFW } from "../services/moderation";
import { sendEmail } from "../config/email";
import { getIo, rooms } from "../sockets";
import { logger } from "../config/logger";

const WORK_ROOT = "/tmp/apex-transcoding";

// HLS ladder: [name, resolution, videoBitrate(k), maxrate(k), bufsize(k)]
const LADDER: Array<[string, string, string]> = [
  ["1080p", "1920x1080", "2500k"],
  ["720p", "1280x720", "1500k"],
  ["480p", "854x480", "600k"],
  ["360p", "640x360", "400k"],
];

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let stderr = "";
    p.stderr.on("data", (d) => (stderr += d.toString()));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-500)}`))
    );
  });
}

function probeDurationSeconds(file: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      file,
    ]);
    let out = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.on("error", reject);
    p.on("close", () => resolve(Math.round(parseFloat(out.trim()) || 0)));
  });
}

const contentTypeFor = (name: string) =>
  name.endsWith(".m3u8")
    ? "application/vnd.apple.mpegurl"
    : name.endsWith(".ts")
      ? "video/mp2t"
      : name.endsWith(".jpg")
        ? "image/jpeg"
        : "application/octet-stream";

async function processVideo(job: Job<TranscodeJob>): Promise<void> {
  const { videoId, s3OriginalKey, userId } = job.data;
  const dir = join(WORK_ROOT, videoId);
  const original = join(dir, "original.mp4");

  await query("UPDATE videos SET status = 'processing' WHERE id = $1", [videoId]);
  await redisClient.set(`transcode:progress:${videoId}`, "5", "EX", 3600);
  await mkdir(dir, { recursive: true });

  try {
    // 1. Download source.
    await downloadToFile(buckets.uploads, s3OriginalKey, original);
    const duration = await probeDurationSeconds(original);
    await redisClient.set(`transcode:progress:${videoId}`, "20", "EX", 3600);

    // 2. Transcode each rendition to HLS.
    const masterLines = ["#EXTM3U", "#EXT-X-VERSION:3"];
    for (let i = 0; i < LADDER.length; i++) {
      const [name, res, bitrate] = LADDER[i];
      const outDir = join(dir, name);
      await mkdir(outDir, { recursive: true });
      await run("ffmpeg", [
        "-i", original,
        "-vf", `scale=${res}`,
        "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "main",
        "-b:v", bitrate, "-c:a", "aac", "-b:a", "128k",
        "-hls_time", "6", "-hls_list_size", "0",
        "-hls_segment_filename", join(outDir, "seg_%03d.ts"),
        "-f", "hls", join(outDir, "index.m3u8"),
      ]);
      const bw = parseInt(bitrate) * 1000;
      masterLines.push(
        `#EXT-X-STREAM-INF:BANDWIDTH=${bw},RESOLUTION=${res}`,
        `${name}/index.m3u8`
      );
      await redisClient.set(
        `transcode:progress:${videoId}`,
        String(20 + Math.round(((i + 1) / LADDER.length) * 60)),
        "EX", 3600
      );
    }

    // 3. Master playlist.
    const master = join(dir, "master.m3u8");
    await run("bash", ["-c", `printf '%s\\n' ${masterLines.map((l) => `'${l}'`).join(" ")} > '${master}'`]);

    // 4. Thumbnail at 10% of duration.
    const thumb = join(dir, "thumbnail.jpg");
    await run("ffmpeg", [
      "-ss", String(Math.max(1, Math.floor(duration * 0.1))),
      "-i", original, "-vframes", "1", "-q:v", "3", thumb,
    ]);

    // 5. NSFW moderation on the thumbnail (nsfwjs, local — replaces Rekognition).
    const bytes = await readFileBytes(thumb);
    if (await isImageNSFW(bytes)) {
      await query(
        "UPDATE videos SET status='rejected', rejection_reason='content-policy' WHERE id=$1",
        [videoId]
      );
      await rm(dir, { recursive: true, force: true });
      return;
    }

    // 6. Upload HLS tree + thumbnail.
    await uploadDir(dir, `${videoId}/hls`);
    const thumbKey = `thumbnails/${videoId}.jpg`;
    await uploadFile(buckets.assets, thumbKey, thumb, "image/jpeg");

    // 6.5 Normalized mezzanine for linear playout → PERMANENT assets bucket
    // (the uploads source expires after 24h). 1080p H.264 High + AAC, fixed 2s
    // GOP so `-c copy` streaming and program boundaries are clean.
    const mezz = join(dir, "mezzanine.mp4");
    await run("ffmpeg", [
      "-i", original,
      "-vf", "scale=-2:1080",
      "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "high",
      "-pix_fmt", "yuv420p",
      "-g", "48", "-keyint_min", "48", "-sc_threshold", "0",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      mezz,
    ]);
    const mezzKey = `mezzanine/${videoId}.mp4`;
    await uploadFile(buckets.assets, mezzKey, mezz, "video/mp4");

    // 7. Persist ready state.
    const hlsUrl = cdnUrl(`${videoId}/hls/master.m3u8`);
    const thumbnailUrl = cdnUrl(thumbKey); // assets served via same CDN prefix
    await query(
      `UPDATE videos SET status='ready', hls_url=$1, s3_hls_key=$2,
         thumbnail_url=$3, duration_seconds=$4, s3_mezzanine_key=$5,
         published_at=COALESCE(published_at, NOW())
       WHERE id=$6`,
      [hlsUrl, `${videoId}/hls/`, thumbnailUrl, duration, mezzKey, videoId]
    );
    await redisClient.set(`transcode:progress:${videoId}`, "100", "EX", 3600);

    // 8. Notify.
    try {
      getIo().to(rooms.user(userId)).emit("video-ready", { videoId, hlsUrl });
    } catch {
      /* socket optional in worker process */
    }
    const { rows } = await query<{ email: string; title: string }>(
      `SELECT u.email, v.title FROM videos v JOIN users u ON u.id = v.creator_id WHERE v.id=$1`,
      [videoId]
    );
    if (rows[0]) {
      await sendEmail(
        rows[0].email,
        "Your video is ready",
        `<p>“${rows[0].title}” finished processing and is ready to schedule.</p>`,
        `“${rows[0].title}” is ready to schedule.`
      );
    }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Recursively upload a local dir tree to videos bucket under keyPrefix. */
async function uploadDir(localDir: string, keyPrefix: string): Promise<void> {
  const entries = await readdir(localDir, { withFileTypes: true });
  for (const e of entries) {
    const local = join(localDir, e.name);
    if (e.isDirectory()) {
      await uploadDir(local, `${keyPrefix}/${e.name}`);
    } else if (e.name.endsWith(".m3u8") || e.name.endsWith(".ts")) {
      await uploadFile(
        buckets.videos,
        `${keyPrefix}/${e.name}`,
        local,
        contentTypeFor(e.name)
      );
    }
  }
}

export function startTranscodeWorker(): Worker<TranscodeJob> {
  // Concurrency is env-tunable so a dedicated transcode droplet (Phase 6.3) can
  // run more parallel ffmpeg jobs than the shared API host's default of 2.
  const concurrency = Number(process.env.TRANSCODE_CONCURRENCY) || 2;
  const worker = new Worker<TranscodeJob>(TRANSCODE_QUEUE, processVideo, {
    connection: bullConnection,
    concurrency,
  });
  worker.on("failed", async (job, err) => {
    logger.error({ jobId: job?.id, err }, "Transcode failed");
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      await query("UPDATE videos SET status='failed' WHERE id=$1", [
        job.data.videoId,
      ]).catch(() => undefined);
    }
  });
  worker.on("ready", () => logger.info({ concurrency }, "Transcode worker ready"));
  return worker;
}
