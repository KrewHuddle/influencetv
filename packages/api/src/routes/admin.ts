import { Router, type Router as ExpressRouter } from "express";
import { query } from "../config/database";
import { redisClient } from "../config/redis";
import { authenticate, clearUserCache } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { badRequest, notFound } from "../middleware/errorHandler";
import { parsePagination, paginate } from "../utils/pagination";
import { getIo, rooms } from "../sockets";
import type { AuthedRequest } from "../types";

const router: ExpressRouter = Router();

// All admin routes require super_admin.
router.use(authenticate, requireRole("super_admin"));

async function logAudit(req: AuthedRequest, action: string, targetType: string, targetId: string, data?: unknown): Promise<void> {
  await query(
    `INSERT INTO audit_log (admin_id, action, target_type, target_id, new_values, ip_address, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [req.user!.id, action, targetType, targetId, data ? JSON.stringify(data) : null, req.ip ?? null, req.headers["user-agent"] ?? null]
  ).catch(() => undefined);
}

// ─────────────────────── overview ───────────────────────
router.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    const [live, today, queues, mrr] = await Promise.all([
      query<{ viewers: string; active: string; ingesting: string }>(
        `SELECT COALESCE(SUM(viewer_count),0) AS viewers,
                COUNT(*) FILTER (WHERE status='active') AS active,
                COUNT(*) FILTER (WHERE status='active') AS ingesting
         FROM channels`
      ),
      query<{ signups: string; subs: string; revenue: string; gmv: string }>(
        `SELECT
           (SELECT COUNT(*) FROM users WHERE created_at::date=CURRENT_DATE) AS signups,
           (SELECT COUNT(*) FROM subscriptions WHERE created_at::date=CURRENT_DATE) AS subs,
           (SELECT COALESCE(SUM(amount_paid),0) FROM invoices WHERE paid_at::date=CURRENT_DATE) AS revenue,
           (SELECT COALESCE(SUM(subtotal_cents),0) FROM orders WHERE status<>'pending' AND created_at::date=CURRENT_DATE) AS gmv`
      ),
      query<{ videos: string; products: string; dmca: string }>(
        `SELECT
           (SELECT COUNT(*) FROM videos WHERE status='processing' OR status='uploading') AS videos,
           (SELECT COUNT(*) FROM products WHERE status='pending') AS products,
           (SELECT COUNT(*) FROM dmca_notices WHERE status IN ('received','under_review')) AS dmca`
      ),
      query<{ mrr: string }>(
        `SELECT COALESCE(SUM(CASE WHEN plan='premium' THEN 1499 WHEN plan='ultra' THEN 2499 ELSE 0 END),0) AS mrr
         FROM subscriptions WHERE status='active'`
      ),
    ]);

    ok(res, {
      live: {
        totalViewers: Number(live.rows[0].viewers),
        activeChannels: Number(live.rows[0].active),
        streamsIngesting: Number(live.rows[0].ingesting),
      },
      today: {
        newSignups: Number(today.rows[0].signups),
        newSubscriptions: Number(today.rows[0].subs),
        revenueCents: Number(today.rows[0].revenue),
        gmvCents: Number(today.rows[0].gmv),
      },
      mtd: { mrrCents: Number(mrr.rows[0].mrr) },
      queues: {
        pendingVideoReview: Number(queues.rows[0].videos),
        pendingProductReview: Number(queues.rows[0].products),
        openDmcaNotices: Number(queues.rows[0].dmca),
      },
    });
  })
);

// ─────────────────────── channels ───────────────────────
router.get(
  "/channels",
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      "SELECT id, name, slug, genre, status, viewer_count, requires_premium FROM channels ORDER BY name"
    );
    ok(res, { channels: rows });
  })
);

router.post(
  "/channels",
  asyncHandler(async (req: AuthedRequest, res) => {
    const { name, slug, genre, description, requiresPremium } = req.body as {
      name: string; slug: string; genre?: string; description?: string; requiresPremium?: boolean;
    };
    if (!name || !slug) throw badRequest("name, slug required");
    const { rows } = await query<{ id: string }>(
      `INSERT INTO channels (name, slug, genre, description, requires_premium, created_by, stream_key)
       VALUES ($1,$2,$3,$4,$5,$6, encode(gen_random_bytes(32),'hex')) RETURNING id`,
      [name, slug, genre ?? null, description ?? null, requiresPremium ?? false, req.user!.id]
    );
    await logAudit(req, "channel.create", "channel", rows[0].id);
    ok(res, { id: rows[0].id }, 201);
  })
);

router.patch(
  "/channels/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const { name, genre, description, status, requiresPremium } = req.body as {
      name?: string; genre?: string; description?: string; status?: string; requiresPremium?: boolean;
    };
    const { rows } = await query(
      `UPDATE channels SET
         name=COALESCE($1,name), genre=COALESCE($2,genre), description=COALESCE($3,description),
         status=COALESCE($4,status)::channel_status, requires_premium=COALESCE($5,requires_premium),
         updated_at=NOW()
       WHERE id=$6 RETURNING id, name, status`,
      [name ?? null, genre ?? null, description ?? null, status ?? null, requiresPremium ?? null, req.params.id]
    );
    if (!rows[0]) throw notFound("Channel not found");
    await logAudit(req, "channel.update", "channel", req.params.id, req.body);
    ok(res, { channel: rows[0] });
  })
);

router.delete(
  "/channels/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const r = await query("DELETE FROM channels WHERE id=$1", [req.params.id]);
    if (!r.rowCount) throw notFound("Channel not found");
    await logAudit(req, "channel.delete", "channel", req.params.id);
    ok(res, { success: true });
  })
);

// Emergency: kill a live stream. Publishes to a channel the playout process
// can subscribe to; also flips status + notifies admins.
router.post(
  "/channels/:id/kill",
  asyncHandler(async (req: AuthedRequest, res) => {
    await query("UPDATE channels SET status='offline' WHERE id=$1", [req.params.id]);
    await redisClient.publish("apex:kill-stream", req.params.id);
    try {
      getIo().to(rooms.admin()).emit("stream-killed", { channelId: req.params.id });
    } catch { /* socket optional */ }
    await logAudit(req, "channel.kill", "channel", req.params.id);
    ok(res, { success: true });
  })
);

// Playout control plane: publish start/stop/restart to the playout process.
router.post(
  "/channels/:id/playout",
  asyncHandler(async (req: AuthedRequest, res) => {
    const action = (req.body?.action as string) ?? "";
    if (!["start", "stop", "restart"].includes(action)) {
      throw badRequest("action must be start | stop | restart");
    }
    const ch = await query<{ slug: string }>("SELECT slug FROM channels WHERE id=$1", [req.params.id]);
    if (!ch.rows[0]) throw notFound("Channel not found");
    await redisClient.publish(
      "apex:playout:control",
      JSON.stringify({ action, channelId: req.params.id, slug: ch.rows[0].slug })
    );
    await logAudit(req, `channel.playout.${action}`, "channel", req.params.id);
    ok(res, { success: true, action });
  })
);

// GET /api/admin/playout/status — per-channel playout heartbeats (Redis).
router.get(
  "/playout/status",
  asyncHandler(async (_req, res) => {
    const keys = await redisClient.keys("playout:heartbeat:*");
    const channels = await Promise.all(
      keys.map(async (k) => {
        const raw = await redisClient.get(k);
        const hb = raw ? (JSON.parse(raw) as { running: boolean; itemId: string | null; ts: number }) : null;
        return {
          channelId: k.replace("playout:heartbeat:", ""),
          running: hb?.running ?? false,
          itemId: hb?.itemId ?? null,
          lastSeenMs: hb ? Date.now() - hb.ts : null,
        };
      })
    );
    ok(res, { channels });
  })
);

// ─────────────────────── users ───────────────────────
router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const p = parsePagination(req.query);
    const search = (req.query.search as string) ?? "";
    const role = req.query.role as string | undefined;
    const plan = req.query.plan as string | undefined;
    const conds: string[] = [];
    const params: unknown[] = [];
    if (search) {
      params.push(`%${search}%`);
      conds.push(`(email ILIKE $${params.length} OR display_name ILIKE $${params.length} OR username ILIKE $${params.length})`);
    }
    if (role) { params.push(role); conds.push(`role=$${params.length}::user_role`); }
    if (plan) { params.push(plan); conds.push(`subscription_plan=$${params.length}::subscription_plan`); }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    const countParams = [...params];
    params.push(p.limit, p.offset);
    const items = await query(
      `SELECT id, email, display_name, username, role, subscription_plan, is_active,
              suspended_until, last_login_at, created_at
       FROM users ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const count = await query<{ n: string }>(`SELECT COUNT(*)::int AS n FROM users ${where}`, countParams);
    ok(res, paginate(items.rows, Number(count.rows[0].n), p));
  })
);

router.patch(
  "/users/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const { role, plan } = req.body as { role?: string; plan?: string };
    const { rows } = await query(
      `UPDATE users SET role=COALESCE($1,role)::user_role,
         subscription_plan=COALESCE($2,subscription_plan)::subscription_plan, updated_at=NOW()
       WHERE id=$3 RETURNING id, role, subscription_plan`,
      [role ?? null, plan ?? null, req.params.id]
    );
    if (!rows[0]) throw notFound("User not found");
    await clearUserCache(req.params.id);
    await logAudit(req, "user.update", "user", req.params.id, req.body);
    ok(res, { user: rows[0] });
  })
);

router.post(
  "/users/:id/suspend",
  asyncHandler(async (req: AuthedRequest, res) => {
    const { reason, until } = req.body as { reason?: string; until?: string };
    await query(
      `UPDATE users SET suspended_at=NOW(), suspended_reason=$1,
         suspended_until=$2, is_active=false WHERE id=$3`,
      [reason ?? null, until ?? null, req.params.id]
    );
    await clearUserCache(req.params.id);
    await query("DELETE FROM sessions WHERE user_id=$1", [req.params.id]);
    await logAudit(req, "user.suspend", "user", req.params.id, { reason, until });
    ok(res, { success: true });
  })
);

router.post(
  "/users/:id/unsuspend",
  asyncHandler(async (req: AuthedRequest, res) => {
    await query(
      "UPDATE users SET suspended_at=NULL, suspended_reason=NULL, suspended_until=NULL, is_active=true WHERE id=$1",
      [req.params.id]
    );
    await clearUserCache(req.params.id);
    await logAudit(req, "user.unsuspend", "user", req.params.id);
    ok(res, { success: true });
  })
);

// ─────────────────────── content moderation ───────────────────────
router.get(
  "/videos",
  asyncHandler(async (req, res) => {
    const p = parsePagination(req.query);
    const status = req.query.status as string | undefined;
    const params: unknown[] = [];
    let where = "";
    if (status) { params.push(status); where = `WHERE v.status=$1::video_status`; }
    params.push(p.limit, p.offset);
    const items = await query(
      `SELECT v.id, v.title, v.status, v.type, v.rating, v.view_count, v.created_at,
              u.display_name AS creator_name
       FROM videos v JOIN users u ON u.id=v.creator_id ${where}
       ORDER BY v.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const count = await query<{ n: string }>(
      `SELECT COUNT(*)::int AS n FROM videos v ${where}`,
      status ? [status] : []
    );
    ok(res, paginate(items.rows, Number(count.rows[0].n), p));
  })
);

router.patch(
  "/videos/:id/approve",
  asyncHandler(async (req: AuthedRequest, res) => {
    await query("UPDATE videos SET status='ready' WHERE id=$1", [req.params.id]);
    await logAudit(req, "video.approve", "video", req.params.id);
    ok(res, { success: true });
  })
);

router.patch(
  "/videos/:id/reject",
  asyncHandler(async (req: AuthedRequest, res) => {
    const { reason } = req.body as { reason?: string };
    await query("UPDATE videos SET status='rejected', rejection_reason=$1 WHERE id=$2", [
      reason ?? "policy violation", req.params.id,
    ]);
    await logAudit(req, "video.reject", "video", req.params.id, { reason });
    ok(res, { success: true });
  })
);

router.get(
  "/products",
  asyncHandler(async (req, res) => {
    const p = parsePagination(req.query);
    const status = req.query.status as string | undefined;
    const params: unknown[] = [];
    let where = "";
    if (status) { params.push(status); where = "WHERE p.status=$1"; }
    params.push(p.limit, p.offset);
    const items = await query(
      `SELECT p.id, p.title, p.status, p.base_price_cents, p.created_at, u.display_name AS seller_name
       FROM products p JOIN users u ON u.id=p.seller_id ${where}
       ORDER BY p.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const count = await query<{ n: string }>(
      `SELECT COUNT(*)::int AS n FROM products p ${where}`,
      status ? [status] : []
    );
    ok(res, paginate(items.rows, Number(count.rows[0].n), p));
  })
);

router.patch(
  "/products/:id/approve",
  asyncHandler(async (req: AuthedRequest, res) => {
    await query("UPDATE products SET status='approved' WHERE id=$1", [req.params.id]);
    await logAudit(req, "product.approve", "product", req.params.id);
    ok(res, { success: true });
  })
);

router.patch(
  "/products/:id/reject",
  asyncHandler(async (req: AuthedRequest, res) => {
    const { reason } = req.body as { reason?: string };
    await query("UPDATE products SET status='rejected', rejection_reason=$1 WHERE id=$2", [
      reason ?? "policy violation", req.params.id,
    ]);
    await logAudit(req, "product.reject", "product", req.params.id, { reason });
    ok(res, { success: true });
  })
);

// ─────────────────────── DMCA ───────────────────────
router.get(
  "/dmca",
  asyncHandler(async (req, res) => {
    const p = parsePagination(req.query);
    const status = req.query.status as string | undefined;
    const params: unknown[] = [];
    let where = "";
    if (status) { params.push(status); where = "WHERE status=$1::dmca_status"; }
    params.push(p.limit, p.offset);
    const items = await query(
      `SELECT id, reporter_name, claimed_work_title, infringing_content_url, infringing_video_id,
              status, received_at
       FROM dmca_notices ${where} ORDER BY received_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const count = await query<{ n: string }>(
      `SELECT COUNT(*)::int AS n FROM dmca_notices ${where}`,
      status ? [status] : []
    );
    ok(res, paginate(items.rows, Number(count.rows[0].n), p));
  })
);

router.patch(
  "/dmca/:id/action",
  asyncHandler(async (req: AuthedRequest, res) => {
    const { action, notes } = req.body as {
      action: "remove" | "restore" | "reject";
      notes?: string;
    };
    const notice = await query<{ infringing_video_id: string | null }>(
      "SELECT infringing_video_id FROM dmca_notices WHERE id=$1",
      [req.params.id]
    );
    if (!notice.rows[0]) throw notFound("Notice not found");

    if (action === "remove" && notice.rows[0].infringing_video_id) {
      await query(
        "UPDATE videos SET status='rejected', rejection_reason='DMCA takedown' WHERE id=$1",
        [notice.rows[0].infringing_video_id]
      );
      await query("DELETE FROM schedule WHERE video_id=$1", [notice.rows[0].infringing_video_id]);
    }
    if (action === "restore" && notice.rows[0].infringing_video_id) {
      await query("UPDATE videos SET status='ready', rejection_reason=NULL WHERE id=$1", [
        notice.rows[0].infringing_video_id,
      ]);
    }

    const newStatus = action === "reject" ? "rejected" : action === "restore" ? "resolved" : "actioned";
    await query(
      `UPDATE dmca_notices SET status=$1::dmca_status, actioned_at=NOW(), actioned_by=$2, notes=$3 WHERE id=$4`,
      [newStatus, req.user!.id, notes ?? null, req.params.id]
    );
    await logAudit(req, `dmca.${action}`, "dmca", req.params.id, { notes });
    ok(res, { success: true });
  })
);

// ─────────────────────── revenue ───────────────────────
router.get(
  "/revenue",
  asyncHandler(async (_req, res) => {
    const [mrr, byStream, payouts, adRev, subsByPlan, gmv, churn] = await Promise.all([
      query<{ mrr: string }>(
        `SELECT COALESCE(SUM(CASE WHEN plan='premium' THEN 1499 WHEN plan='ultra' THEN 2499 ELSE 0 END),0) AS mrr
         FROM subscriptions WHERE status='active'`
      ),
      query(
        `SELECT source, COALESCE(SUM(platform_fee_cents),0) AS platform_fees, COALESCE(SUM(gross_cents),0) AS gross
         FROM creator_earnings GROUP BY source`
      ),
      query<{ total: string }>(
        "SELECT COALESCE(SUM(amount_cents),0) AS total FROM payouts WHERE status IN ('processing','paid')"
      ),
      query<{ total: string; impressions: string }>(
        "SELECT COALESCE(SUM(revenue_cents),0) AS total, COALESCE(SUM(impressions),0) AS impressions FROM ad_impressions"
      ),
      query("SELECT plan, COUNT(*)::int AS count FROM subscriptions WHERE status='active' GROUP BY plan"),
      query<{ total: string }>("SELECT COALESCE(SUM(subtotal_cents),0) AS total FROM orders WHERE status='paid'"),
      query<{ n: string }>("SELECT COUNT(*)::int AS n FROM subscriptions WHERE status='cancelled' AND cancelled_at > NOW() - interval '30 days'"),
    ]);
    ok(res, {
      mrrCents: Number(mrr.rows[0].mrr),
      byStream: byStream.rows,
      totalPayoutsCents: Number(payouts.rows[0].total),
      adRevenueCents: Number(adRev.rows[0].total),
      adImpressions: Number(adRev.rows[0].impressions),
      activeSubsByPlan: subsByPlan.rows,
      gmvCents: Number(gmv.rows[0].total),
      churn30: Number(churn.rows[0].n),
    });
  })
);

// ─────────────────────── audit log ───────────────────────
router.get(
  "/audit",
  asyncHandler(async (req, res) => {
    const p = parsePagination(req.query);
    const action = req.query.action as string | undefined;
    const params: unknown[] = [];
    let where = "";
    if (action) { params.push(`${action}%`); where = "WHERE a.action LIKE $1"; }
    params.push(p.limit, p.offset);
    const items = await query(
      `SELECT a.id, a.action, a.target_type, a.target_id, a.created_at, u.display_name AS admin_name
       FROM audit_log a LEFT JOIN users u ON u.id=a.admin_id ${where}
       ORDER BY a.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const count = await query<{ n: string }>(
      `SELECT COUNT(*)::int AS n FROM audit_log a ${where}`,
      action ? [`${action}%`] : []
    );
    ok(res, paginate(items.rows, Number(count.rows[0].n), p));
  })
);

export default router;
