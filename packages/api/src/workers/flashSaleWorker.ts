import { Worker, type Job } from "bullmq";
import { FLASH_SALE_QUEUE, type FlashSaleJob } from "../config/queue";
import { redisClient, bullConnection } from "../config/redis";
import { query } from "../config/database";
import { getIo, rooms } from "../sockets";

async function process(job: Job<FlashSaleJob>): Promise<void> {
  const { flashSaleId, channelId, phase } = job.data;

  const { rows } = await query<{
    product_id: string;
    sale_price_cents: number;
    max_units: number | null;
  }>(
    "SELECT product_id, sale_price_cents, max_units FROM flash_sales WHERE id=$1",
    [flashSaleId]
  );
  const sale = rows[0];
  if (!sale) return;

  if (phase === "start") {
    if (channelId) {
      await redisClient.set(`flashsale:active:${channelId}`, flashSaleId, "EX", 3600);
    }
    if (sale.max_units != null) {
      await redisClient.set(`flashsale:inventory:${flashSaleId}`, String(sale.max_units), "EX", 3600);
    }
    if (channelId) {
      try {
        getIo().to(rooms.channel(channelId)).emit("flash-sale-started", {
          flashSaleId,
          productId: sale.product_id,
          salePriceCents: sale.sale_price_cents,
          unitsRemaining: sale.max_units,
        });
      } catch { /* socket optional */ }
    }
    return;
  }

  // phase === "end": sync Redis counter back to DB, deactivate, notify.
  const remaining = await redisClient.get(`flashsale:inventory:${flashSaleId}`);
  const sold =
    sale.max_units != null && remaining != null
      ? sale.max_units - Number(remaining)
      : undefined;
  await query(
    `UPDATE flash_sales SET is_active=false${sold != null ? ", units_sold=$2" : ""} WHERE id=$1`,
    sold != null ? [flashSaleId, sold] : [flashSaleId]
  );
  if (channelId) {
    await redisClient.del(`flashsale:active:${channelId}`);
    try {
      getIo().to(rooms.channel(channelId)).emit("flash-sale-ended", { flashSaleId });
    } catch { /* socket optional */ }
  }
  await redisClient.del(`flashsale:inventory:${flashSaleId}`);
}

export function startFlashSaleWorker(): Worker<FlashSaleJob> {
  const worker = new Worker<FlashSaleJob>(FLASH_SALE_QUEUE, process, {
    connection: bullConnection,
    concurrency: 4,
  });
  // eslint-disable-next-line no-console
  worker.on("ready", () => console.log("⚡ Flash-sale worker ready"));
  return worker;
}
