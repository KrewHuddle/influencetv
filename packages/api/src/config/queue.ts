import { Queue } from "bullmq";
import { bullConnection } from "./redis";

export const TRANSCODE_QUEUE = "video-transcoding";

export interface TranscodeJob {
  videoId: string;
  s3OriginalKey: string;
  userId: string;
}

export const transcodeQueue = new Queue<TranscodeJob, void, string>(
  TRANSCODE_QUEUE,
  {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export async function enqueueTranscode(job: TranscodeJob): Promise<void> {
  await transcodeQueue.add("transcode", job, { jobId: job.videoId });
}

// ─── Flash-sale scheduling ───
export const FLASH_SALE_QUEUE = "flash-sale";

export interface FlashSaleJob {
  flashSaleId: string;
  channelId: string | null;
  phase: "start" | "end";
}

export const flashSaleQueue = new Queue<FlashSaleJob, void, string>(
  FLASH_SALE_QUEUE,
  { connection: bullConnection }
);

/** Schedule start + end jobs for a flash sale at absolute delays (ms). */
export async function scheduleFlashSale(
  flashSaleId: string,
  channelId: string | null,
  startDelayMs: number,
  endDelayMs: number
): Promise<void> {
  await flashSaleQueue.add(
    "start",
    { flashSaleId, channelId, phase: "start" },
    { delay: Math.max(0, startDelayMs), jobId: `${flashSaleId}:start` }
  );
  await flashSaleQueue.add(
    "end",
    { flashSaleId, channelId, phase: "end" },
    { delay: Math.max(0, endDelayMs), jobId: `${flashSaleId}:end` }
  );
}

// ─── Haggle live-auction settlement ───
export const HAGGLE_SETTLEMENT_QUEUE = "haggle-settlement";
export const HAGGLE_PAYMENT_RETRY_QUEUE = "haggle-payment-retry";

export interface HaggleSettlementJob {
  auctionId: string;
}
export interface HagglePaymentRetryJob {
  auctionId: string;
  winnerId: string;
  amountCents: number;
}

export const haggleSettlementQueue = new Queue<HaggleSettlementJob, void, string>(
  HAGGLE_SETTLEMENT_QUEUE,
  { connection: bullConnection }
);
export const hagglePaymentRetryQueue = new Queue<HagglePaymentRetryJob, void, string>(
  HAGGLE_PAYMENT_RETRY_QUEUE,
  { connection: bullConnection }
);

/** Settle an auction `delayMs` from now (its duration). Idempotent by jobId. */
export async function scheduleHaggleSettlement(
  auctionId: string,
  delayMs: number
): Promise<void> {
  await haggleSettlementQueue.add(
    "settle",
    { auctionId },
    { delay: Math.max(0, delayMs), jobId: `settle:${auctionId}`, removeOnComplete: true }
  );
}

/** Retry a failed winner charge after `delayMs`. */
export async function scheduleHagglePaymentRetry(
  auctionId: string,
  winnerId: string,
  amountCents: number,
  delayMs: number
): Promise<void> {
  await hagglePaymentRetryQueue.add(
    "retry",
    { auctionId, winnerId, amountCents },
    { delay: Math.max(0, delayMs), jobId: `retry:${auctionId}`, removeOnComplete: true }
  );
}
