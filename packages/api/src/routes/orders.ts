import { Router, type Router as ExpressRouter } from "express";
import { query } from "../config/database";
import { authenticate } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { forbidden, notFound, badRequest } from "../middleware/errorHandler";
import { presignDownload } from "../utils/s3";
import type { AuthedRequest } from "../types";

const router: ExpressRouter = Router();

// GET /api/orders/:orderId/download  (buyer only) — fresh presigned URL for a
// digital product; logs the download.
router.get(
  "/:orderId/download",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { rows } = await query<{ buyer_id: string; download_url: string | null }>(
      "SELECT buyer_id, download_url FROM orders WHERE id=$1",
      [req.params.orderId]
    );
    const order = rows[0];
    if (!order) throw notFound("Order not found");
    if (order.buyer_id !== req.user!.id && req.user!.role !== "super_admin")
      throw forbidden("Not your order");
    if (!order.download_url) throw badRequest("No digital download for this order");

    const item = await query<{ product_id: string }>(
      "SELECT product_id FROM order_items WHERE order_id=$1 LIMIT 1",
      [req.params.orderId]
    );
    const productId = item.rows[0]?.product_id;
    if (!productId) throw notFound("Order item not found");

    const downloadUrl = await presignDownload(`digital/${productId}`, 3600);
    await query("UPDATE orders SET download_count = download_count + 1 WHERE id=$1", [
      req.params.orderId,
    ]);
    ok(res, { downloadUrl, expiresIn: 3600 });
  })
);

export default router;
