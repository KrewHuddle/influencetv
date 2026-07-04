import crypto from "crypto";
import { Router, type Router as ExpressRouter } from "express";
import bcrypt from "bcryptjs";
import type { PoolClient } from "pg";
import { query, transaction } from "../config/database";
import { redisClient } from "../config/redis";
import { authenticate, clearUserCache } from "../middleware/auth";
import { authLimiter } from "../middleware/rateLimiter";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { badRequest, forbidden, unauthorized } from "../middleware/errorHandler";
import {
  validateBody,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendVerificationSchema,
} from "../utils/validate";
import {
  REFRESH_COOKIE,
  clearRefreshCookie,
  createSession,
  setRefreshCookie,
  signAccessToken,
  verifyRefreshToken,
} from "../utils/tokens";
import {
  sendEmail,
  verificationEmail,
  passwordResetEmail,
} from "../config/email";
import { env } from "../config/env";
import type { SubscriptionPlan, UserRole } from "@apex/shared";

const BCRYPT_ROUNDS = 12;

interface UserRow {
  id: string;
  email: string;
  email_verified: boolean;
  password_hash: string | null;
  display_name: string | null;
  role: UserRole;
  subscription_plan: SubscriptionPlan;
  is_active: boolean;
}

const publicUser = (u: UserRow) => ({
  id: u.id,
  email: u.email,
  displayName: u.display_name,
  role: u.role,
  plan: u.subscription_plan,
});

const router: ExpressRouter = Router();

// ─────────────────────── register ───────────────────────
router.post(
  "/register",
  authLimiter,
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, password, displayName } = req.body as {
      email: string;
      password: string;
      displayName?: string;
    };

    const existing = await query("SELECT id FROM users WHERE email = $1", [
      email,
    ]);
    if (existing.rowCount) throw badRequest("Email already registered", "EMAIL_TAKEN");

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const verifyToken = crypto.randomUUID();
    const verifyExpires = new Date(Date.now() + 24 * 3_600_000);
    const name = displayName ?? email.split("@")[0];

    const result = await transaction(async (c: PoolClient) => {
      const { rows } = await c.query<UserRow>(
        `INSERT INTO users
           (email, password_hash, display_name, email_verification_token, email_verification_expires_at)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING id, email, email_verified, password_hash, display_name, role, subscription_plan, is_active`,
        [email, passwordHash, name, verifyToken, verifyExpires]
      );
      const user = rows[0];
      const { refreshToken, expiresAt } = await createSession(c, {
        id: user.id,
        role: user.role,
        plan: user.subscription_plan,
      }, req);
      return { user, refreshToken, expiresAt };
    });

    const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${verifyToken}`;
    const vm = verificationEmail(name, verifyUrl);
    await sendEmail(email, vm.subject, vm.html, vm.text);

    setRefreshCookie(res, result.refreshToken, result.expiresAt);
    ok(
      res,
      { user: publicUser(result.user), accessToken: signAccessToken({
        id: result.user.id,
        role: result.user.role,
        plan: result.user.subscription_plan,
      }) },
      201
    );
  })
);

// ─────────────────────── login ───────────────────────
router.post(
  "/login",
  authLimiter,
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as { email: string; password: string };

    const { rows } = await query<UserRow>(
      `SELECT id, email, email_verified, password_hash, display_name, role, subscription_plan, is_active
       FROM users WHERE email = $1`,
      [email]
    );
    const user = rows[0];
    // Uniform failure to avoid leaking which part was wrong.
    if (!user || !user.password_hash) throw unauthorized("Invalid credentials");
    if (!user.is_active) throw forbidden("Account disabled");

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw unauthorized("Invalid credentials");

    if (!user.email_verified) {
      const token = crypto.randomUUID();
      await query(
        `UPDATE users SET email_verification_token=$1,
           email_verification_expires_at=$2 WHERE id=$3`,
        [token, new Date(Date.now() + 24 * 3_600_000), user.id]
      );
      const url = `${env.FRONTEND_URL}/verify-email?token=${token}`;
      const vm = verificationEmail(user.display_name ?? "there", url);
      await sendEmail(user.email, vm.subject, vm.html, vm.text);
      throw forbidden("Email not verified — a new link was sent", {
        emailNotVerified: true,
      });
    }

    const session = await transaction(async (c: PoolClient) => {
      const s = await createSession(
        c,
        { id: user.id, role: user.role, plan: user.subscription_plan },
        req
      );
      await c.query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [
        user.id,
      ]);
      return s;
    });

    setRefreshCookie(res, session.refreshToken, session.expiresAt);
    ok(res, {
      user: publicUser(user),
      accessToken: signAccessToken({
        id: user.id,
        role: user.role,
        plan: user.subscription_plan,
      }),
    });
  })
);

// ─────────────────────── refresh ───────────────────────
router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) throw unauthorized("No refresh token");

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw unauthorized("Invalid refresh token");
    }

    const { rows } = await query<{
      id: string;
      user_id: string;
      expires_at: Date;
      role: UserRole;
      subscription_plan: SubscriptionPlan;
    }>(
      `SELECT s.id, s.user_id, s.expires_at, u.role, u.subscription_plan
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.refresh_token = $1`,
      [token]
    );
    const session = rows[0];
    if (!session || new Date(session.expires_at) < new Date()) {
      throw unauthorized("Session expired");
    }

    const rotated = await transaction(async (c: PoolClient) => {
      await c.query("DELETE FROM sessions WHERE id = $1", [session.id]);
      return createSession(
        c,
        {
          id: session.user_id,
          role: session.role,
          plan: session.subscription_plan,
        },
        req
      );
    });

    setRefreshCookie(res, rotated.refreshToken, rotated.expiresAt);
    ok(res, {
      accessToken: signAccessToken({
        id: session.user_id,
        role: session.role,
        plan: session.subscription_plan,
      }),
    });
    void payload;
  })
);

// ─────────────────────── logout ───────────────────────
router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (token) {
      await query("DELETE FROM sessions WHERE refresh_token = $1", [token]);
    }
    clearRefreshCookie(res);
    ok(res, { success: true });
  })
);

// ─────────────────────── verify email ───────────────────────
router.get(
  "/verify-email",
  asyncHandler(async (req, res) => {
    const token = req.query.token as string | undefined;
    if (!token) throw badRequest("Missing token");

    const { rows } = await query<{ id: string; email_verification_expires_at: Date }>(
      `SELECT id, email_verification_expires_at FROM users
       WHERE email_verification_token = $1`,
      [token]
    );
    const user = rows[0];
    if (!user || new Date(user.email_verification_expires_at) < new Date()) {
      throw badRequest("Invalid or expired token", "TOKEN_INVALID");
    }

    await query(
      `UPDATE users SET email_verified = true,
         email_verification_token = NULL,
         email_verification_expires_at = NULL WHERE id = $1`,
      [user.id]
    );
    await clearUserCache(user.id);
    ok(res, { verified: true });
  })
);

// ─────────────────────── resend verification ───────────────────────
router.post(
  "/resend-verification",
  authLimiter,
  validateBody(resendVerificationSchema),
  asyncHandler(async (req, res) => {
    const { email } = req.body as { email: string };
    const { rows } = await query<UserRow>(
      "SELECT id, email, email_verified, display_name FROM users WHERE email = $1",
      [email]
    );
    const user = rows[0];
    if (user && !user.email_verified) {
      const token = crypto.randomUUID();
      await query(
        `UPDATE users SET email_verification_token=$1,
           email_verification_expires_at=$2 WHERE id=$3`,
        [token, new Date(Date.now() + 24 * 3_600_000), user.id]
      );
      const url = `${env.FRONTEND_URL}/verify-email?token=${token}`;
      const vm = verificationEmail(user.display_name ?? "there", url);
      await sendEmail(user.email, vm.subject, vm.html, vm.text);
    }
    ok(res, { success: true });
  })
);

// ─────────────────────── forgot password ───────────────────────
router.post(
  "/forgot-password",
  authLimiter,
  validateBody(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const { email } = req.body as { email: string };
    const { rows } = await query<UserRow>(
      "SELECT id, email, display_name FROM users WHERE email = $1",
      [email]
    );
    const user = rows[0];
    if (user) {
      const token = crypto.randomUUID();
      await query(
        `INSERT INTO password_resets (user_id, token, expires_at)
         VALUES ($1,$2,$3)`,
        [user.id, token, new Date(Date.now() + 3_600_000)]
      );
      const url = `${env.FRONTEND_URL}/reset-password?token=${token}`;
      const pm = passwordResetEmail(user.display_name ?? "there", url);
      await sendEmail(user.email, pm.subject, pm.html, pm.text);
    }
    // Always success — never leak whether the email exists.
    ok(res, { success: true });
  })
);

// ─────────────────────── reset password ───────────────────────
router.post(
  "/reset-password",
  authLimiter,
  validateBody(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { token, password } = req.body as { token: string; password: string };
    const { rows } = await query<{
      id: string;
      user_id: string;
      expires_at: Date;
      used_at: Date | null;
    }>(
      "SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token = $1",
      [token]
    );
    const reset = rows[0];
    if (!reset || reset.used_at || new Date(reset.expires_at) < new Date()) {
      throw badRequest("Invalid or expired token", "TOKEN_INVALID");
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await transaction(async (c: PoolClient) => {
      await c.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
        passwordHash,
        reset.user_id,
      ]);
      await c.query("UPDATE password_resets SET used_at = NOW() WHERE id = $1", [
        reset.id,
      ]);
      // Invalidate all sessions on password change.
      await c.query("DELETE FROM sessions WHERE user_id = $1", [reset.user_id]);
    });
    await clearUserCache(reset.user_id);
    ok(res, { success: true });
  })
);

// ─────────────────────── Google OAuth ───────────────────────
// Manual OAuth2 code flow (no passport/session store needed for a JWT API).
router.get("/google", (_req, res) => {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get(
  "/google/callback",
  asyncHandler(async (req, res) => {
    const code = req.query.code as string | undefined;
    if (!code) throw badRequest("Missing code");

    // Exchange code for tokens.
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID ?? "",
        client_secret: env.GOOGLE_CLIENT_SECRET ?? "",
        redirect_uri: env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw unauthorized("Google token exchange failed");
    const tokens = (await tokenRes.json()) as { access_token: string };

    const profileRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    if (!profileRes.ok) throw unauthorized("Google profile fetch failed");
    const profile = (await profileRes.json()) as {
      sub: string;
      email: string;
      name?: string;
      picture?: string;
    };

    const user = await transaction(async (c: PoolClient) => {
      const found = await c.query<UserRow>(
        "SELECT id, email, display_name, role, subscription_plan FROM users WHERE email = $1",
        [profile.email]
      );
      let u: UserRow;
      if (found.rowCount) {
        u = found.rows[0];
        await c.query(
          "UPDATE users SET google_id = $1, email_verified = true WHERE id = $2",
          [profile.sub, u.id]
        );
      } else {
        const created = await c.query<UserRow>(
          `INSERT INTO users
             (email, google_id, email_verified, display_name, avatar_url)
           VALUES ($1,$2,true,$3,$4)
           RETURNING id, email, display_name, role, subscription_plan`,
          [profile.email, profile.sub, profile.name ?? profile.email, profile.picture ?? null]
        );
        u = created.rows[0];
      }
      const session = await createSession(
        c,
        { id: u.id, role: u.role, plan: u.subscription_plan },
        req
      );
      return { u, session };
    });

    setRefreshCookie(res, user.session.refreshToken, user.session.expiresAt);
    const accessToken = signAccessToken({
      id: user.u.id,
      role: user.u.role,
      plan: user.u.subscription_plan,
    });
    // Hand the access token to the SPA via URL fragment.
    res.redirect(`${env.FRONTEND_URL}/auth/callback#accessToken=${accessToken}`);
  })
);

// ─────────────────────── Fire TV code login ───────────────────────
const TV_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
function tvCode(): string {
  const bytes = crypto.randomBytes(6);
  return Array.from(bytes, (b) => TV_ALPHABET[b % TV_ALPHABET.length]).join("");
}

// POST /api/auth/tv-code/generate — TV requests a pairing code.
router.post(
  "/tv-code/generate",
  asyncHandler(async (req, res) => {
    const deviceId = (req.body?.deviceId as string) || crypto.randomUUID();
    const code = tvCode();
    await redisClient.set(`tvcode:${code}`, deviceId, "EX", 600);
    ok(res, {
      code,
      deviceId,
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
    });
  })
);

// POST /api/auth/tv-code/verify — called from the phone/browser (must be signed in).
router.post(
  "/tv-code/verify",
  authenticate,
  asyncHandler(async (req, res) => {
    const code = ((req.body?.code as string) ?? "").toUpperCase();
    const deviceId = await redisClient.get(`tvcode:${code}`);
    if (!deviceId) throw badRequest("Invalid or expired code", "TV_CODE_INVALID");
    // req.user is set by authenticate.
    const userId = (req as { user?: { id: string } }).user!.id;
    await redisClient.set(`tvcode-verified:${deviceId}`, userId, "EX", 120);
    await redisClient.del(`tvcode:${code}`);
    ok(res, { success: true });
  })
);

// GET /api/auth/tv-code/poll/:deviceId — TV long-polls until verified.
router.get(
  "/tv-code/poll/:deviceId",
  asyncHandler(async (req, res) => {
    const userId = await redisClient.get(`tvcode-verified:${req.params.deviceId}`);
    if (!userId) {
      ok(res, { status: "pending" });
      return;
    }
    const u = await query<UserRow>(
      "SELECT id, email, display_name, role, subscription_plan FROM users WHERE id=$1",
      [userId]
    );
    if (!u.rows[0]) {
      ok(res, { status: "pending" });
      return;
    }
    const user = u.rows[0];
    const session = await transaction(async (c: PoolClient) =>
      createSession(
        c,
        { id: user.id, role: user.role, plan: user.subscription_plan },
        req,
        "firetv"
      )
    );
    await redisClient.del(`tvcode-verified:${req.params.deviceId}`);
    ok(res, {
      accessToken: signAccessToken({
        id: user.id,
        role: user.role,
        plan: user.subscription_plan,
      }),
      refreshToken: session.refreshToken,
      user: publicUser(user),
    });
  })
);

export default router;
