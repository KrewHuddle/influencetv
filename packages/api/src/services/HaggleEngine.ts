/**
 * HaggleEngine — atomic live-auction core. Every bid flows through placeBid,
 * whose critical section is a single Lua script executed in Valkey/Redis so
 * concurrent bids can never race (read-modify-write is atomic server-side).
 *
 * Real-time events are published to the Redis `haggle:events` channel and
 * re-emitted to Socket.IO rooms by the subscriber wired in sockets/index.ts.
 * This makes emits work identically from the API process (placeBid) and the
 * worker process (settleAuction) — the worker has no in-process io server.
 *
 * Redis keys:
 *   haggle:auction:{id}   hash  — live auction state
 *   haggle:sequence:{id}  int   — monotonic bid sequence (INCR)
 *   haggle:proxy:{id}     zset  — bidderId -> maxAmountCents
 *   haggle:active:{chan}  str   — auctionId currently live on a channel
 *   haggle:history:{id}   list  — last 20 bid summaries
 */
import { query, transaction } from "../config/database";
import { redisClient } from "../config/redis";
import { stripe, stripeEnabled } from "../config/stripe";
import { awardPoints } from "./PointsEngine";
import {
  scheduleHaggleSettlement,
  scheduleHagglePaymentRetry,
} from "../config/queue";
import { presignDownload } from "../utils/s3";
import { sendEmail } from "../config/email";
import { logger } from "../config/logger";

export const HAGGLE_EVENTS_CHANNEL = "haggle:events";

const kAuction = (id: string) => `haggle:auction:${id}`;
const kSequence = (id: string) => `haggle:sequence:${id}`;
const kProxy = (id: string) => `haggle:proxy:${id}`;
const kActive = (channelId: string) => `haggle:active:${channelId}`;
const kHistory = (id: string) => `haggle:history:${id}`;

export interface BidResult {
  accepted: boolean;
  reason?: "AUCTION_ENDED" | "SELF_BID" | "TOO_LOW";
  currentBid?: number;
  minNext?: number;
  currentWinner?: string;
  endsAt?: number;
  wasExtended?: boolean;
  sequenceNum?: number;
  bidCount?: number;
}

/** Publish an event; the socket subscriber re-emits it to `room`. */
async function emit(room: string, event: string, payload: unknown): Promise<void> {
  try {
    await redisClient.publish(
      HAGGLE_EVENTS_CHANNEL,
      JSON.stringify({ room, event, payload })
    );
  } catch (err) {
    logger.warn({ err, event }, "haggle emit failed");
  }
}
const channelRoom = (id: string) => `channel:${id}`;
const userRoom = (id: string) => `user:${id}`;

/**
 * Atomic bid critical section. Returns a flat array of strings.
 *   accepted: ["1", amount, winner, endsAt, wasExtended, seq, bidCount, extCount]
 *   rejected: ["0", reason, currentBid, minNext]
 */
const PLACE_BID_LUA = `
local raw = redis.call('HGETALL', KEYS[1])
if #raw == 0 then return {'0','AUCTION_ENDED','0','0'} end
local a = {}
for i=1,#raw,2 do a[raw[i]] = raw[i+1] end
local status = a['status']
if status ~= 'live' and status ~= 'ending' then
  return {'0','AUCTION_ENDED', a['currentBid'] or '0', '0'}
end
if a['currentWinner'] == ARGV[1] then
  return {'0','SELF_BID', a['currentBid'] or '0', '0'}
end
local currentBid = tonumber(a['currentBid']) or 0
local increment = tonumber(a['increment']) or 100
local bidCount = tonumber(a['bidCount']) or 0
local amount = tonumber(ARGV[2])
local minNext
if bidCount == 0 then minNext = tonumber(a['startingBid']) or increment
else minNext = currentBid + increment end
if amount < minNext then
  return {'0','TOO_LOW', tostring(currentBid), tostring(minNext)}
end
local seq = redis.call('INCR', KEYS[2])
bidCount = bidCount + 1
redis.call('HSET', KEYS[1], 'currentBid', amount, 'currentWinner', ARGV[1], 'bidCount', bidCount)
local endsAt = tonumber(a['endsAt']) or 0
local now = tonumber(ARGV[3])
local wasExtended = 0
if a['autoExtend'] == '1' then
  local thr = tonumber(a['extendThreshold']) or 10
  local extS = tonumber(a['extendSeconds']) or 15
  local extC = tonumber(a['extensionCount']) or 0
  local maxE = tonumber(a['maxExtensions']) or 5
  if (endsAt - now) < (thr * 1000) and extC < maxE then
    endsAt = endsAt + (extS * 1000)
    extC = extC + 1
    redis.call('HSET', KEYS[1], 'endsAt', endsAt, 'extensionCount', extC)
    wasExtended = 1
  end
end
local entry = cjson.encode({ bidderId = ARGV[1], name = ARGV[4], amount = amount, seq = seq, at = now })
redis.call('LPUSH', KEYS[3], entry)
redis.call('LTRIM', KEYS[3], 0, 19)
local ext = tonumber(redis.call('HGET', KEYS[1], 'extensionCount')) or 0
return {'1', tostring(amount), ARGV[1], tostring(endsAt), tostring(wasExtended), tostring(seq), tostring(bidCount), tostring(ext)}
`;

async function runBidLua(
  auctionId: string,
  bidderId: string,
  amountCents: number,
  nowMs: number,
  displayName: string
): Promise<string[]> {
  const res = (await redisClient.eval(
    PLACE_BID_LUA,
    3,
    kAuction(auctionId),
    kSequence(auctionId),
    kHistory(auctionId),
    bidderId,
    String(amountCents),
    String(nowMs),
    displayName
  )) as string[];
  return res.map((x) => String(x));
}

async function displayNameFor(userId: string): Promise<string> {
  const { rows } = await query<{ display_name: string | null; username: string | null }>(
    "SELECT display_name, username FROM users WHERE id = $1",
    [userId]
  );
  return rows[0]?.username ?? rows[0]?.display_name ?? "bidder";
}

// ─────────────────────────────────────────────────────────── placeBid ──
export async function placeBid(
  auctionId: string,
  bidderId: string,
  amountCents: number,
  maxAmountCents?: number,
  isProxy = false
): Promise<BidResult> {
  const name = await displayNameFor(bidderId);
  // capture the outgoing winner before the swap so we can notify them
  const prevWinner = await redisClient.hget(kAuction(auctionId), "currentWinner");
  const channelId = await redisClient.hget(kAuction(auctionId), "channelId");

  const r = await runBidLua(auctionId, bidderId, amountCents, Date.now(), name);
  if (r[0] !== "1") {
    return {
      accepted: false,
      reason: (r[1] as BidResult["reason"]) ?? "AUCTION_ENDED",
      currentBid: Number(r[2]) || 0,
      minNext: Number(r[3]) || 0,
    };
  }

  const amount = Number(r[1]);
  const endsAt = Number(r[3]);
  const wasExtended = r[4] === "1";
  const seq = Number(r[5]);
  const bidCount = Number(r[6]);
  const extCount = Number(r[7]);

  // persist bid
  await query(
    `INSERT INTO haggle_bids
       (auction_id, bidder_id, amount_cents, max_amount_cents, status, is_proxy, sequence_num)
     VALUES ($1,$2,$3,$4,'winning',$5,$6)`,
    [auctionId, bidderId, amount, maxAmountCents ?? null, isProxy, seq]
  );
  // mark prior winning bid(s) as outbid
  await query(
    `UPDATE haggle_bids SET status='outbid'
     WHERE auction_id=$1 AND bidder_id<>$2 AND status='winning'`,
    [auctionId, bidderId]
  );

  if (channelId) {
    await emit(channelRoom(channelId), "haggle-bid", {
      auctionId,
      amount,
      displayName: name,
      bidderId,
      endsAt,
      bidCount,
      wasExtended,
    });
    if (wasExtended) {
      await emit(channelRoom(channelId), "haggle-extended", {
        auctionId,
        newEndsAt: endsAt,
        extensionCount: extCount,
        reason: "bid_near_end",
      });
    }
  }
  if (prevWinner && prevWinner !== bidderId) {
    await emit(userRoom(prevWinner), "outbid-notification", {
      auctionId,
      newAmount: amount,
      newWinner: name,
    });
  }

  await awardPoints(bidderId, "haggle_bid", { auctionId, amount }).catch(() => {});

  if (!isProxy) {
    await resolveProxyBids(auctionId, amount, bidderId).catch((err) =>
      logger.warn({ err, auctionId }, "proxy resolution failed")
    );
  }

  return {
    accepted: true,
    currentBid: amount,
    currentWinner: bidderId,
    endsAt,
    wasExtended,
    sequenceNum: seq,
    bidCount,
  };
}

// ──────────────────────────────────────────────────── resolveProxyBids ──
export async function resolveProxyBids(
  auctionId: string,
  newBidCents: number,
  newBidderId: string
): Promise<void> {
  const increment = Number(await redisClient.hget(kAuction(auctionId), "increment")) || 100;
  // highest competing max bid, excluding the current leader
  const top = await redisClient.zrevrange(kProxy(auctionId), 0, 3, "WITHSCORES");
  for (let i = 0; i < top.length; i += 2) {
    const member = top[i];
    const max = Number(top[i + 1]);
    if (member === newBidderId) continue;
    if (max < newBidCents + increment) continue;
    const counter = Math.min(max, newBidCents + increment);
    const res = await placeBid(auctionId, member, counter, max, true);
    if (res.accepted) {
      await emit(userRoom(member), "proxy-bid-placed", {
        auctionId,
        amount: counter,
        note: "Auto-bid placed on your behalf",
      });
    }
    return; // one counter step per manual bid
  }
}

// ───────────────────────────────────────────────────────── startAuction ──
export async function startAuction(auctionId: string): Promise<{ endsAt: number }> {
  const { rows } = await query<HaggleRow>(
    "SELECT * FROM haggle_auctions WHERE id = $1",
    [auctionId]
  );
  const a = rows[0];
  if (!a) throw new Error("Auction not found");
  if (a.channel_id) {
    const active = await redisClient.get(kActive(a.channel_id));
    if (active && active !== auctionId) {
      throw new Error("Another auction is already live on this channel");
    }
  }

  const durationMs = a.duration_seconds * 1000;
  const endsAt = Date.now() + durationMs;

  await query(
    "UPDATE haggle_auctions SET status='live', started_at=NOW(), ends_at=to_timestamp($2/1000.0) WHERE id=$1",
    [auctionId, endsAt]
  );

  await redisClient.hset(kAuction(auctionId), {
    currentBid: 0,
    currentWinner: "",
    startingBid: a.starting_bid_cents,
    increment: a.bid_increment_cents,
    reserve: a.reserve_price_cents ?? 0,
    status: "live",
    bidCount: 0,
    endsAt,
    channelId: a.channel_id ?? "",
    autoExtend: a.auto_extend ? "1" : "0",
    extendSeconds: a.extend_seconds ?? 15,
    extendThreshold: a.extend_threshold_seconds ?? 10,
    extensionCount: a.extension_count ?? 0,
    maxExtensions: a.max_extensions ?? 5,
  });
  if (a.channel_id) await redisClient.set(kActive(a.channel_id), auctionId);

  await scheduleHaggleSettlement(auctionId, durationMs);

  if (a.channel_id) {
    const prod = await query<{ thumbnail_url: string | null }>(
      "SELECT thumbnail_url FROM products WHERE id=$1",
      [a.product_id]
    );
    await emit(channelRoom(a.channel_id), "haggle-started", {
      auctionId,
      title: a.title,
      productId: a.product_id,
      image: prod.rows[0]?.thumbnail_url ?? null,
      startingBid: a.starting_bid_cents,
      endsAt,
      increment: a.bid_increment_cents,
      duration: a.duration_seconds,
    });
  }
  return { endsAt };
}

// ──────────────────────────────────────────────────────── settleAuction ──
export async function settleAuction(auctionId: string): Promise<void> {
  // block new bids, 500ms grace for in-flight requests
  await redisClient.hset(kAuction(auctionId), "status", "ending");
  await new Promise((r) => setTimeout(r, 500));

  const h = await redisClient.hgetall(kAuction(auctionId));
  const currentBid = Number(h.currentBid) || 0;
  const winnerId = h.currentWinner || null;
  const reserve = Number(h.reserve) || 0;
  const channelId = h.channelId || null;

  const { rows } = await query<HaggleRow>(
    "SELECT * FROM haggle_auctions WHERE id=$1",
    [auctionId]
  );
  const auction = rows[0];
  if (!auction) return;

  const unsold = async (reason: "no_bids" | "reserve_not_met") => {
    await query("UPDATE haggle_auctions SET status='unsold' WHERE id=$1", [auctionId]);
    if (channelId) await emit(channelRoom(channelId), "haggle-unsold", { auctionId, reason });
    await notifyWatchlist(auctionId, "haggle-unsold", { auctionId, reason });
    if (channelId) await redisClient.del(kActive(channelId));
  };

  if (!winnerId || currentBid === 0) return unsold("no_bids");
  if (reserve > 0 && currentBid < reserve) return unsold("reserve_not_met");

  // winner exists + reserve met → sell
  await query(
    "UPDATE haggle_auctions SET status='sold', final_price_cents=$2 WHERE id=$1",
    [auctionId, currentBid]
  );

  const [winnerRes, sellerRes, prodRes] = await Promise.all([
    query<{ stripe_customer_id: string | null; default_payment_method_id: string | null; email: string; display_name: string | null }>(
      "SELECT stripe_customer_id, default_payment_method_id, email, display_name FROM users WHERE id=$1",
      [winnerId]
    ),
    query<{ stripe_account_id: string | null }>(
      "SELECT stripe_account_id FROM users WHERE id=$1",
      [auction.seller_id]
    ),
    query<{ is_digital: boolean; title: string }>(
      "SELECT is_digital, title FROM products WHERE id=$1",
      [auction.product_id]
    ),
  ]);
  const winner = winnerRes.rows[0];
  const seller = sellerRes.rows[0];
  const product = prodRes.rows[0];
  const feeCents = Math.floor(currentBid * 0.12);

  let paymentOk = false;
  let paymentIntentId: string | null = null;
  try {
    if (!stripeEnabled) throw new Error("STRIPE_DISABLED");
    if (!winner?.stripe_customer_id || !winner.default_payment_method_id) {
      throw new Error("NO_PAYMENT_METHOD");
    }
    const pi = await stripe.paymentIntents.create({
      amount: currentBid,
      currency: "usd",
      customer: winner.stripe_customer_id,
      payment_method: winner.default_payment_method_id,
      off_session: true,
      confirm: true,
      application_fee_amount: feeCents,
      ...(seller?.stripe_account_id
        ? { transfer_data: { destination: seller.stripe_account_id } }
        : {}),
      metadata: { haggle_auction_id: auctionId },
    });
    paymentOk = pi.status === "succeeded";
    paymentIntentId = pi.id;
  } catch (err) {
    logger.warn({ err, auctionId }, "haggle charge failed");
  }

  if (!paymentOk) {
    await query("UPDATE haggle_auctions SET status='payment_failed' WHERE id=$1", [auctionId]);
    await emit(userRoom(winnerId), "haggle-payment-failed", {
      auctionId,
      message: "Payment failed. Please update your payment method.",
    });
    await scheduleHagglePaymentRetry(auctionId, winnerId, currentBid, 10 * 60 * 1000);
    if (channelId) await redisClient.del(kActive(channelId));
    return;
  }

  // create order + item + earnings + digital delivery + points
  let downloadUrl: string | null = null;
  const orderId = await transaction(async (c) => {
    const order = await c.query<{ id: string }>(
      `INSERT INTO orders
         (buyer_id, seller_id, stripe_payment_intent_id, status, subtotal_cents,
          platform_fee_cents, seller_payout_cents)
       VALUES ($1,$2,$3,'paid',$4,$5,$6) RETURNING id`,
      [winnerId, auction.seller_id, paymentIntentId, currentBid, feeCents, currentBid - feeCents]
    );
    const oid = order.rows[0].id;
    await c.query(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents, source, live_shop_id)
       VALUES ($1,$2,1,$3,'haggle',$4)`,
      [oid, auction.product_id, currentBid, auction.live_shop_id ?? null]
    );
    await c.query(
      `INSERT INTO creator_earnings (creator_id, source, source_id, gross_cents, platform_fee_cents, net_cents)
       VALUES ($1,'haggle',$2,$3,$4,$5)`,
      [auction.seller_id, auctionId, currentBid, feeCents, currentBid - feeCents]
    );
    if (product?.is_digital) {
      downloadUrl = `/api/orders/${oid}/download`;
      await c.query("UPDATE orders SET download_url=$2 WHERE id=$1", [oid, downloadUrl]);
    }
    return oid;
  });

  await query(
    "UPDATE haggle_auctions SET stripe_payment_intent_id=$2 WHERE id=$1",
    [auctionId, paymentIntentId]
  );

  if (product?.is_digital && winner?.email) {
    try {
      const url = await presignDownload(`digital/${auction.product_id}`);
      await sendEmail(
        winner.email,
        `Your Haggle win: ${product.title}`,
        `<p>You won <strong>${product.title}</strong>. <a href="${url}">Download here</a> (link valid 1 hour).</p>`,
        `You won ${product.title}. Download (valid 1 hour): ${url}`
      ).catch(() => {});
    } catch {
      /* presign best-effort */
    }
  }

  await awardPoints(winnerId, "haggle_win", { auctionId }).catch(() => {});
  await awardPoints(auction.seller_id, "haggle_sell", { auctionId }).catch(() => {});

  const winnerName = await displayNameFor(winnerId);
  if (channelId) {
    await emit(channelRoom(channelId), "haggle-won", {
      auctionId,
      winnerName,
      finalPrice: currentBid,
    });
    await redisClient.del(kActive(channelId));
  }
  await emit(userRoom(winnerId), "haggle-won-confirmed", {
    auctionId,
    orderId,
    amount: currentBid,
    ...(downloadUrl ? { downloadUrl } : {}),
  });
}

// ─────────────────────────────────────────────────── retryHagglePayment ──
/** One retry of a failed winner charge. On success fulfils the order; on
 *  failure marks the auction payment_failed for good and notifies the seller. */
export async function retryHagglePayment(
  auctionId: string,
  winnerId: string,
  amountCents: number
): Promise<void> {
  const { rows } = await query<HaggleRow>("SELECT * FROM haggle_auctions WHERE id=$1", [auctionId]);
  const auction = rows[0];
  if (!auction || auction.status !== "payment_failed") return;

  const [w, s, p] = await Promise.all([
    query<{ stripe_customer_id: string | null; default_payment_method_id: string | null }>(
      "SELECT stripe_customer_id, default_payment_method_id FROM users WHERE id=$1",
      [winnerId]
    ),
    query<{ stripe_account_id: string | null }>("SELECT stripe_account_id FROM users WHERE id=$1", [auction.seller_id]),
    query<{ is_digital: boolean }>("SELECT is_digital FROM products WHERE id=$1", [auction.product_id]),
  ]);
  const winner = w.rows[0];
  const feeCents = Math.floor(amountCents * 0.12);

  try {
    if (!stripeEnabled) throw new Error("STRIPE_DISABLED");
    if (!winner?.stripe_customer_id || !winner.default_payment_method_id) throw new Error("NO_PAYMENT_METHOD");
    const pi = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      customer: winner.stripe_customer_id,
      payment_method: winner.default_payment_method_id,
      off_session: true,
      confirm: true,
      application_fee_amount: feeCents,
      ...(s.rows[0]?.stripe_account_id ? { transfer_data: { destination: s.rows[0].stripe_account_id } } : {}),
      metadata: { haggle_auction_id: auctionId, retry: "1" },
    });
    if (pi.status !== "succeeded") throw new Error("charge_not_succeeded");

    const orderId = await transaction(async (c) => {
      const order = await c.query<{ id: string }>(
        `INSERT INTO orders (buyer_id, seller_id, stripe_payment_intent_id, status, subtotal_cents, platform_fee_cents, seller_payout_cents)
         VALUES ($1,$2,$3,'paid',$4,$5,$6) RETURNING id`,
        [winnerId, auction.seller_id, pi.id, amountCents, feeCents, amountCents - feeCents]
      );
      const oid = order.rows[0].id;
      await c.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents, source, live_shop_id)
         VALUES ($1,$2,1,$3,'haggle',$4)`,
        [oid, auction.product_id, amountCents, auction.live_shop_id ?? null]
      );
      await c.query(
        `INSERT INTO creator_earnings (creator_id, source, source_id, gross_cents, platform_fee_cents, net_cents)
         VALUES ($1,'haggle',$2,$3,$4,$5)`,
        [auction.seller_id, auctionId, amountCents, feeCents, amountCents - feeCents]
      );
      let dl: string | null = null;
      if (p.rows[0]?.is_digital) {
        dl = `/api/orders/${oid}/download`;
        await c.query("UPDATE orders SET download_url=$2 WHERE id=$1", [oid, dl]);
      }
      return oid;
    });
    await query("UPDATE haggle_auctions SET status='sold', stripe_payment_intent_id=$2 WHERE id=$1", [auctionId, pi.id]);
    await awardPoints(winnerId, "haggle_win", { auctionId }).catch(() => {});
    await awardPoints(auction.seller_id, "haggle_sell", { auctionId }).catch(() => {});
    await emit(userRoom(winnerId), "haggle-won-confirmed", { auctionId, orderId, amount: amountCents });
  } catch (err) {
    logger.warn({ err, auctionId }, "haggle payment retry failed");
    await emit(userRoom(auction.seller_id), "haggle-payment-failed", {
      auctionId,
      message: "Winner's payment failed after retry.",
    });
  }
}

// ──────────────────────────────────────────────────────── cancelAuction ──
export async function cancelAuction(auctionId: string, reason = "cancelled"): Promise<void> {
  const { rows } = await query<{ status: string; channel_id: string | null }>(
    "SELECT status, channel_id FROM haggle_auctions WHERE id=$1",
    [auctionId]
  );
  const a = rows[0];
  if (!a) throw new Error("Auction not found");
  if (a.status !== "scheduled" && a.status !== "live") {
    throw new Error("Only scheduled or live auctions can be cancelled");
  }
  await query("UPDATE haggle_auctions SET status='cancelled' WHERE id=$1", [auctionId]);
  await redisClient.del(kAuction(auctionId), kSequence(auctionId), kProxy(auctionId), kHistory(auctionId));
  if (a.channel_id) {
    await redisClient.del(kActive(a.channel_id));
    await emit(channelRoom(a.channel_id), "haggle-cancelled", { auctionId, reason });
  }
  await notifyWatchlist(auctionId, "haggle-cancelled", { auctionId });
}

// ──────────────────────────────────────────────────────────── helpers ──
async function notifyWatchlist(
  auctionId: string,
  event: string,
  payload: unknown
): Promise<void> {
  const { rows } = await query<{ user_id: string }>(
    "SELECT user_id FROM haggle_watchlist WHERE auction_id=$1",
    [auctionId]
  );
  for (const r of rows) await emit(userRoom(r.user_id), event, payload);
}

interface HaggleRow {
  id: string;
  seller_id: string;
  product_id: string;
  live_shop_id: string | null;
  channel_id: string | null;
  title: string;
  starting_bid_cents: number;
  reserve_price_cents: number | null;
  bid_increment_cents: number;
  duration_seconds: number;
  auto_extend: boolean;
  extend_seconds: number | null;
  extend_threshold_seconds: number | null;
  extension_count: number | null;
  max_extensions: number | null;
  status: string;
}
