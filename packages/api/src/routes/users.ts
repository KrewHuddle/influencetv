import crypto from "crypto";
import { Router, type Router as ExpressRouter } from "express";
import multer from "multer";
import bcrypt from "bcryptjs";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { query } from "../config/database";
import { redisClient } from "../config/redis";
import { s3Client, buckets, cloudfrontUrl } from "../config/aws";
import { authenticate, clearUserCache } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { badRequest, notFound, unauthorized } from "../middleware/errorHandler";
import { validateBody, updateMeSchema, changePasswordSchema } from "../utils/validate";
import { REFRESH_COOKIE } from "../utils/tokens";
import type { AuthedRequest } from "../types";

const BCRYPT_ROUNDS = 12;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const okTypes = ["image/jpeg", "image/png", "image/webp"];
    cb(null, okTypes.includes(file.mimetype));
  },
});

const router: ExpressRouter = Router();

// ─────────────────────── GET /me ───────────────────────
router.get(
  "/me",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const { rows } = await query(
      `SELECT id, email, email_verified, role, subscription_plan, display_name,
              username, bio, avatar_url, banner_url, genre_preferences,
              stripe_account_status, created_at
       FROM users WHERE id = $1`,
      [userId]
    );
    if (!rows[0]) throw notFound("User not found");

    const sub = await query(
      `SELECT plan, status, current_period_end, cancel_at_period_end
       FROM subscriptions WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    const unread = Number(
      (await redisClient.get(`notif:unread:${userId}`)) ?? 0
    );

    ok(res, {
      user: rows[0],
      subscription: sub.rows[0] ?? null,
      unreadNotifications: unread,
    });
  })
);

// ─────────────────────── PATCH /me ───────────────────────
router.patch(
  "/me",
  authenticate,
  validateBody(updateMeSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const { displayName, username, bio, genrePreferences } = req.body as {
      displayName?: string;
      username?: string;
      bio?: string;
      genrePreferences?: string[];
    };

    if (username) {
      const taken = await query(
        "SELECT id FROM users WHERE username = $1 AND id <> $2",
        [username, userId]
      );
      if (taken.rowCount) throw badRequest("Username taken", "USERNAME_TAKEN");
    }

    const { rows } = await query(
      `UPDATE users SET
         display_name = COALESCE($1, display_name),
         username = COALESCE($2, username),
         bio = COALESCE($3, bio),
         genre_preferences = COALESCE($4, genre_preferences),
         updated_at = NOW()
       WHERE id = $5
       RETURNING id, display_name, username, bio, genre_preferences, avatar_url`,
      [displayName ?? null, username ?? null, bio ?? null, genrePreferences ?? null, userId]
    );
    await clearUserCache(userId);
    ok(res, { user: rows[0] });
  })
);

// ─────────────────────── POST /me/avatar ───────────────────────
router.post(
  "/me/avatar",
  authenticate,
  upload.single("avatar"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    if (!req.file) throw badRequest("No image (field 'avatar', jpg/png/webp ≤5MB)");

    const ext = req.file.mimetype.split("/")[1].replace("jpeg", "jpg");
    const key = `avatars/${userId}/${crypto.randomUUID()}.${ext}`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: buckets.assets,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      })
    );
    const url = cloudfrontUrl(key);
    await query("UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2", [
      url,
      userId,
    ]);
    await clearUserCache(userId);
    ok(res, { avatarUrl: url });
  })
);

// ─────────────────────── POST /me/change-password ───────────────────────
router.post(
  "/me/change-password",
  authenticate,
  validateBody(changePasswordSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };

    const { rows } = await query<{ password_hash: string | null }>(
      "SELECT password_hash FROM users WHERE id = $1",
      [userId]
    );
    const hash = rows[0]?.password_hash;
    if (!hash) throw badRequest("No password set (Google account)");
    if (!(await bcrypt.compare(currentPassword, hash))) {
      throw unauthorized("Current password incorrect");
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [
      newHash,
      userId,
    ]);
    // Revoke every session except the current one.
    const current = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    await query(
      "DELETE FROM sessions WHERE user_id = $1 AND ($2::text IS NULL OR refresh_token <> $2)",
      [userId, current ?? null]
    );
    ok(res, { success: true });
  })
);

// ─────────────────────── GET /me/sessions ───────────────────────
router.get(
  "/me/sessions",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { rows } = await query(
      `SELECT id, device_type, device_id, ip_address, user_agent, created_at, expires_at
       FROM sessions WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.user!.id]
    );
    ok(res, { sessions: rows });
  })
);

// ─────────────────────── DELETE /me/sessions/:id ───────────────────────
router.delete(
  "/me/sessions/:sessionId",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    const result = await query(
      "DELETE FROM sessions WHERE id = $1 AND user_id = $2",
      [req.params.sessionId, req.user!.id]
    );
    if (!result.rowCount) throw notFound("Session not found");
    ok(res, { success: true });
  })
);

// ─────────────────────── GET /:username (public) ───────────────────────
router.get(
  "/:username",
  asyncHandler(async (req, res) => {
    const { rows } = await query<{ id: string; role: string }>(
      `SELECT id, display_name, username, bio, avatar_url, banner_url, role, created_at
       FROM users WHERE username = $1 AND is_active = true`,
      [req.params.username]
    );
    const profile = rows[0] as
      | {
          id: string;
          role: string;
          display_name: string;
          username: string;
          bio: string;
          avatar_url: string;
          banner_url: string;
          created_at: Date;
        }
      | undefined;
    if (!profile) throw notFound("User not found");

    const base = {
      displayName: profile.display_name,
      username: profile.username,
      bio: profile.bio,
      avatarUrl: profile.avatar_url,
      bannerUrl: profile.banner_url,
      role: profile.role,
    };

    if (profile.role === "creator") {
      const [tiers, videos] = await Promise.all([
        query(
          `SELECT id, name, description, price_cents, perks, subscriber_count
           FROM patron_tiers WHERE creator_id = $1 AND is_active = true
           ORDER BY position`,
          [profile.id]
        ),
        query(
          `SELECT id, title, thumbnail_url, duration_seconds, view_count, published_at
           FROM videos WHERE creator_id = $1 AND status = 'ready'
           ORDER BY published_at DESC NULLS LAST LIMIT 6`,
          [profile.id]
        ),
      ]);
      ok(res, {
        ...base,
        patronTiers: tiers.rows,
        recentVideos: videos.rows,
      });
      return;
    }

    ok(res, base);
  })
);

export default router;
