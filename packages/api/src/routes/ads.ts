import { Router, type Router as ExpressRouter } from "express";
import jwt from "jsonwebtoken";
import { query } from "../config/database";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { badRequest, notFound } from "../middleware/errorHandler";
import { env } from "../config/env";
import { adDecisionEngine } from "../services/AdDecisionEngine";
import type { JwtAccessPayload } from "../types";

const router: ExpressRouter = Router();

// ─────────────────── PUBLIC: VOD ad serving (before the operator gate) ───────
// GET /api/ads/vod?videoId= — returns pre-roll (+ one mid-roll) for the player.
// Premium/Ultra viewers are ad-free; anonymous/free viewers get ads. Serving
// records the impression (VOD = 1 per play).
router.get(
  "/vod",
  asyncHandler(async (req, res) => {
    const videoId = (req.query.videoId as string) ?? null;

    // Optional auth: if a valid token says premium/ultra, serve no ads.
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      try {
        const payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET) as JwtAccessPayload;
        if (payload.plan === "premium" || payload.plan === "ultra") {
          ok(res, { ads: [], preroll: null, midroll: null });
          return;
        }
      } catch {
        /* invalid token → treat as free viewer */
      }
    }

    const selections = await adDecisionEngine.selectAdsForBreak(60);
    const preroll = selections[0] ?? null;
    const midroll = selections[1] ?? null;
    const served = [preroll, midroll].filter(Boolean) as NonNullable<typeof preroll>[];
    if (served.length > 0) {
      await adDecisionEngine.recordImpressions(served, 1, "vod", videoId);
    }
    ok(res, {
      preroll: preroll && { creativeVideoId: preroll.creativeVideoId, hlsUrl: preroll.hlsUrl, durationSeconds: preroll.durationSeconds, advertiserName: preroll.advertiserName },
      midroll: midroll && { creativeVideoId: midroll.creativeVideoId, hlsUrl: midroll.hlsUrl, durationSeconds: midroll.durationSeconds, advertiserName: midroll.advertiserName },
    });
  })
);

// ─────────────────── operator-gated routes below ───────
router.use(authenticate, requireRole("channel_manager", "super_admin"));

// ─────────────────────── campaigns ───────────────────────

// POST /api/ads/campaigns
router.post(
  "/campaigns",
  asyncHandler(async (req, res) => {
    const b = req.body as {
      advertiserName?: string;
      videoId?: string;
      budgetCents?: number;
      cpmCents?: number;
      impressionsTarget?: number;
      startDate?: string;
      endDate?: string;
    };
    if (!b.advertiserName || !b.videoId) {
      throw badRequest("advertiserName and videoId (creative) required");
    }
    const creative = await query("SELECT status FROM videos WHERE id = $1", [b.videoId]);
    if (!creative.rows[0]) throw notFound("Creative video not found");

    const { rows } = await query(
      `INSERT INTO ad_campaigns
         (advertiser_name, video_id, budget_cents, cpm_cents, impressions_target,
          start_date, end_date, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true)
       RETURNING id, advertiser_name, video_id, budget_cents, cpm_cents,
                 impressions_target, impressions_served, start_date, end_date, is_active`,
      [
        b.advertiserName, b.videoId, b.budgetCents ?? null, b.cpmCents ?? 2000,
        b.impressionsTarget ?? null, b.startDate ?? null, b.endDate ?? null,
      ]
    );
    ok(res, { campaign: rows[0] }, 201);
  })
);

// GET /api/ads/campaigns
router.get(
  "/campaigns",
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT c.id, c.advertiser_name, c.video_id, c.budget_cents, c.cpm_cents,
              c.impressions_target, c.impressions_served, c.start_date, c.end_date,
              c.is_active,
              (c.cpm_cents * c.impressions_served / 1000) AS spend_cents,
              v.title AS creative_title, v.duration_seconds AS creative_duration
       FROM ad_campaigns c
       LEFT JOIN videos v ON v.id = c.video_id
       ORDER BY c.created_at DESC`
    );
    ok(res, { campaigns: rows });
  })
);

// PATCH /api/ads/campaigns/:id  (update / activate / pause)
router.patch(
  "/campaigns/:id",
  asyncHandler(async (req, res) => {
    const b = req.body as {
      advertiserName?: string;
      budgetCents?: number;
      cpmCents?: number;
      impressionsTarget?: number;
      startDate?: string;
      endDate?: string;
      isActive?: boolean;
    };
    const { rows } = await query(
      `UPDATE ad_campaigns SET
         advertiser_name    = COALESCE($1, advertiser_name),
         budget_cents       = COALESCE($2, budget_cents),
         cpm_cents          = COALESCE($3, cpm_cents),
         impressions_target = COALESCE($4, impressions_target),
         start_date         = COALESCE($5, start_date),
         end_date           = COALESCE($6, end_date),
         is_active          = COALESCE($7, is_active)
       WHERE id = $8
       RETURNING id, advertiser_name, is_active, impressions_served`,
      [
        b.advertiserName ?? null, b.budgetCents ?? null, b.cpmCents ?? null,
        b.impressionsTarget ?? null, b.startDate ?? null, b.endDate ?? null,
        b.isActive ?? null, req.params.id,
      ]
    );
    if (!rows[0]) throw notFound("Campaign not found");
    ok(res, { campaign: rows[0] });
  })
);

// DELETE /api/ads/campaigns/:id
router.delete(
  "/campaigns/:id",
  asyncHandler(async (req, res) => {
    const r = await query("DELETE FROM ad_campaigns WHERE id = $1", [req.params.id]);
    if (!r.rowCount) throw notFound("Campaign not found");
    ok(res, { success: true });
  })
);

// ─────────────────────── ad pods (manual, optional) ───────────────────────

// POST /api/ads/pods  { name, ads: [{ videoId, durationSeconds }] }
router.post(
  "/pods",
  asyncHandler(async (req, res) => {
    const b = req.body as { name?: string; ads?: Array<{ videoId: string; durationSeconds: number }> };
    if (!Array.isArray(b.ads) || b.ads.length === 0) throw badRequest("ads array required");
    const total = b.ads.reduce((n, a) => n + (a.durationSeconds || 0), 0);
    const { rows } = await query(
      `INSERT INTO ad_pods (name, total_duration_seconds, ads)
       VALUES ($1,$2,$3) RETURNING id, name, total_duration_seconds, ads`,
      [b.name ?? "Ad Pod", total, JSON.stringify(b.ads)]
    );
    ok(res, { pod: rows[0] }, 201);
  })
);

// GET /api/ads/pods
router.get(
  "/pods",
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      "SELECT id, name, total_duration_seconds, ads, created_at FROM ad_pods ORDER BY created_at DESC"
    );
    ok(res, { pods: rows });
  })
);

// ─────────────────────── reporting + decision ───────────────────────

// GET /api/ads/report — per-campaign impressions + derived revenue.
router.get(
  "/report",
  asyncHandler(async (_req, res) => {
    const campaigns = await query(
      `SELECT c.id, c.advertiser_name, c.cpm_cents, c.budget_cents,
              c.impressions_served, c.impressions_target,
              (c.cpm_cents * c.impressions_served / 1000) AS revenue_cents,
              c.is_active
       FROM ad_campaigns c
       ORDER BY revenue_cents DESC`
    );
    const totals = await query<{ impressions: string; revenue_cents: string }>(
      "SELECT COALESCE(SUM(impressions),0) AS impressions, COALESCE(SUM(revenue_cents),0) AS revenue_cents FROM ad_impressions"
    );
    ok(res, {
      campaigns: campaigns.rows,
      totals: {
        impressions: Number(totals.rows[0]?.impressions ?? 0),
        revenueCents: Number(totals.rows[0]?.revenue_cents ?? 0),
      },
    });
  })
);

// GET /api/ads/decision?targetSeconds=90 — dry-run: preview the fill, no record.
router.get(
  "/decision",
  asyncHandler(async (req, res) => {
    const target = Math.min(600, Math.max(1, Number(req.query.targetSeconds) || 60));
    const selections = await adDecisionEngine.selectAdsForBreak(target);
    ok(res, {
      targetSeconds: target,
      filledSeconds: selections.reduce((n, s) => n + s.durationSeconds, 0),
      ads: selections,
    });
  })
);

export default router;
