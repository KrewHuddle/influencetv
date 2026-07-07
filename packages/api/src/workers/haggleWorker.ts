import { Worker, type Job } from "bullmq";
import {
  HAGGLE_SETTLEMENT_QUEUE,
  HAGGLE_PAYMENT_RETRY_QUEUE,
  type HaggleSettlementJob,
  type HagglePaymentRetryJob,
} from "../config/queue";
import { bullConnection } from "../config/redis";
import { settleAuction, retryHagglePayment } from "../services/HaggleEngine";
import { logger } from "../config/logger";

async function settle(job: Job<HaggleSettlementJob>): Promise<void> {
  await settleAuction(job.data.auctionId);
}

async function retry(job: Job<HagglePaymentRetryJob>): Promise<void> {
  const { auctionId, winnerId, amountCents } = job.data;
  await retryHagglePayment(auctionId, winnerId, amountCents);
}

export function startHaggleWorkers(): Worker[] {
  const settlement = new Worker<HaggleSettlementJob>(HAGGLE_SETTLEMENT_QUEUE, settle, {
    connection: bullConnection,
    concurrency: 8,
  });
  const paymentRetry = new Worker<HagglePaymentRetryJob>(HAGGLE_PAYMENT_RETRY_QUEUE, retry, {
    connection: bullConnection,
    concurrency: 4,
  });
  settlement.on("ready", () => logger.info("🔨 Haggle settlement worker ready"));
  settlement.on("failed", (job, err) =>
    logger.error({ err, auctionId: job?.data.auctionId }, "haggle settlement failed")
  );
  paymentRetry.on("failed", (job, err) =>
    logger.error({ err, auctionId: job?.data.auctionId }, "haggle payment retry failed")
  );
  return [settlement, paymentRetry];
}
