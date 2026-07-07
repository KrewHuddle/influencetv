import { assertDbConnection } from "../config/database";
import { startTranscodeWorker } from "./transcodeWorker";
import { startWorkerMetricsServer } from "./metricsServer";
import { logger } from "../config/logger";

/**
 * Standalone transcode worker entrypoint (Phase 6.3). Runs ONLY the transcode
 * queue so it can live on a dedicated droplet/pool, off the API host — ffmpeg
 * no longer competes with the API for CPU. Scale with TRANSCODE_CONCURRENCY and
 * by running more instances (BullMQ load-balances across workers on the queue).
 *
 * Deploy: `pnpm --filter @apex/api worker:transcode`. Set
 * RUN_TRANSCODE_IN_MAIN_WORKER=false on the API host so it stops transcoding.
 */
async function main(): Promise<void> {
  await assertDbConnection();
  const worker = startTranscodeWorker();
  startWorkerMetricsServer();
  logger.info(
    { concurrency: process.env.TRANSCODE_CONCURRENCY ?? "2" },
    "Standalone transcode worker running"
  );

  let shuttingDown = false;
  const shutdown = async (sig: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ sig }, "Draining transcode worker");
    await worker.close(); // waits for in-flight jobs to finish
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "Transcode worker boot failed");
  process.exit(1);
});
