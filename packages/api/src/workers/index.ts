import { Worker } from "bullmq";
import { assertDbConnection } from "../config/database";
import { startTranscodeWorker } from "./transcodeWorker";
import { startFlashSaleWorker } from "./flashSaleWorker";
import { startWorkerMetricsServer } from "./metricsServer";
import { logger } from "../config/logger";

/**
 * Combined worker host (API droplet). Always runs the lightweight flash-sale
 * worker. Runs the transcode worker too UNLESS RUN_TRANSCODE_IN_MAIN_WORKER is
 * "false" — set that on the API host once a dedicated transcode droplet runs
 * `worker:transcode`, to move the heavy ffmpeg CPU load off the API (Phase 6.3).
 */
async function main(): Promise<void> {
  await assertDbConnection();

  const workers: Worker[] = [startFlashSaleWorker()];
  const transcodeHere = process.env.RUN_TRANSCODE_IN_MAIN_WORKER !== "false";
  if (transcodeHere) workers.push(startTranscodeWorker());

  startWorkerMetricsServer();
  logger.info({ transcodeHere }, "Apex workers running");

  let shuttingDown = false;
  const shutdown = async (sig: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ sig }, "Draining workers");
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "Worker boot failed");
  process.exit(1);
});
