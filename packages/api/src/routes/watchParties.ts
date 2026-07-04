import { Router, type Router as ExpressRouter } from "express";
import { query } from "../config/database";
import { stripe, stripeEnabled } from "../config/stripe";
import { authenticate } from "../middleware/auth";
import { requirePlan } from "../middleware/requireRole";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { badRequest, notFound } from "../middleware/errorHandler";
import { awardPoints } from "../services/PointsEngine";
import { getIo, rooms } from "../sockets";
import type { AuthedRequest } from "../types";

const router: ExpressRouter = Router();

// POST /api/watch-parties (creator, premium, ultra)
router.post(
  "/",
  authenticate,
  requirePlan("premium", "ultra"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { title, videoId, channelId, startsAt, ticketPriceCents } = req.body as {
      title: string;
      videoId?: string;
      channelId?: string;
      startsAt?: string;
      ticketPriceCents?: number;
    };
    if (!title) throw badRequest("title required");
    const { rows } = await query<{ id: string }>(
      `INSERT INTO watch_parties (title, host_id, video_id, channel_id, starts_at, ticket_price_cents)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [title, req.user!.id, videoId ?? null, channelId ?? null, startsAt ?? null, ticketPriceCents ?? 0]
    );
    await awardPoints(req.user!.id, "watch_party_host");
    ok(res, { partyId: rows[0].id }, 201);
  })
);

// GET /api/watch-parties/:partyId (public)
router.get(
  "/:partyId",
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT id, title, host_id, video_id, channel_id, starts_at,
              ticket_price_cents, attendee_count, max_attendees, status
       FROM watch_parties WHERE id=$1`,
      [req.params.partyId]
    );
    if (!rows[0]) throw notFound("Watch party not found");
    ok(res, { party: rows[0] });
  })
);

// POST /api/watch-parties/:partyId/join (premium or ultra)
router.post(
  "/:partyId/join",
  authenticate,
  requirePlan("premium", "ultra"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { rows } = await query<{ ticket_price_cents: number; attendee_count: number; max_attendees: number }>(
      "SELECT ticket_price_cents, attendee_count, max_attendees FROM watch_parties WHERE id=$1",
      [req.params.partyId]
    );
    const party = rows[0];
    if (!party) throw notFound("Watch party not found");
    if (party.attendee_count >= party.max_attendees) throw badRequest("Party is full");

    // Ticketed + not Ultra → require payment.
    if (party.ticket_price_cents > 0 && req.user!.plan !== "ultra") {
      if (!stripeEnabled) throw badRequest("Payments not configured");
      const pi = await stripe.paymentIntents.create({
        amount: party.ticket_price_cents,
        currency: "usd",
        metadata: { watchPartyId: req.params.partyId, userId: req.user!.id },
      });
      ok(res, { requiresPayment: true, clientSecret: pi.client_secret });
      return;
    }

    await query(
      "UPDATE watch_parties SET attendee_count = attendee_count + 1 WHERE id=$1",
      [req.params.partyId]
    );
    try {
      getIo()
        .to(rooms.watchParty(req.params.partyId))
        .emit("viewer-joined", { userId: req.user!.id });
    } catch {
      /* socket optional */
    }
    ok(res, { joined: true });
  })
);

export default router;
