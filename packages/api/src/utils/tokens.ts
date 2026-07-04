import crypto from "crypto";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import type { PoolClient } from "pg";
import { env } from "../config/env";
import type {
  JwtAccessPayload,
  JwtRefreshPayload,
} from "../types";
import { DEVICE_LIMITS, type SubscriptionPlan, type UserRole } from "@apex/shared";

export const REFRESH_COOKIE = "apex_refresh";

interface TokenUser {
  id: string;
  role: UserRole;
  plan: SubscriptionPlan;
}

export function signAccessToken(user: TokenUser): string {
  const payload: JwtAccessPayload = {
    sub: user.id,
    role: user.role,
    plan: user.plan,
    type: "access",
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
  } as jwt.SignOptions);
}

function signRefreshToken(userId: string, sessionId: string): string {
  const payload: JwtRefreshPayload = {
    sub: userId,
    sessionId,
    type: "refresh",
  };
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY,
  } as jwt.SignOptions);
}

export function verifyRefreshToken(token: string): JwtRefreshPayload {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtRefreshPayload;
  if (payload.type !== "refresh") throw new Error("wrong token type");
  return payload;
}

/** Convert "30d" / "15m" / "3600" to milliseconds. */
export function durationToMs(input: string): number {
  const m = /^(\d+)\s*([smhd])?$/.exec(input.trim());
  if (!m) return 0;
  const n = Number(m[1]);
  switch (m[2]) {
    case "s":
      return n * 1000;
    case "m":
      return n * 60_000;
    case "h":
      return n * 3_600_000;
    case "d":
      return n * 86_400_000;
    default:
      return n * 1000;
  }
}

/**
 * Create a session row + signed refresh token. Trims the user's oldest
 * sessions when they exceed MAX_SESSIONS_PER_USER (device cap enforcement
 * is refined per-plan in Prompt 06).
 */
export async function createSession(
  client: PoolClient,
  user: TokenUser,
  req: Request,
  deviceType = "web"
): Promise<{ refreshToken: string; expiresAt: Date }> {
  const sessionId = crypto.randomUUID();
  const refreshToken = signRefreshToken(user.id, sessionId);
  const expiresAt = new Date(Date.now() + durationToMs(env.JWT_REFRESH_EXPIRY));

  await client.query(
    `INSERT INTO sessions
       (id, user_id, refresh_token, device_type, device_id, ip_address, user_agent, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      sessionId,
      user.id,
      refreshToken,
      deviceType,
      (req.headers["x-device-id"] as string) ?? null,
      req.ip ?? null,
      req.headers["user-agent"] ?? null,
      expiresAt,
    ]
  );

  // Enforce per-plan device cap by evicting the oldest sessions.
  const cap = DEVICE_LIMITS[user.plan] ?? 1;
  await client.query(
    `DELETE FROM sessions WHERE id IN (
       SELECT id FROM sessions WHERE user_id = $1
       ORDER BY created_at DESC OFFSET $2
     )`,
    [user.id, cap]
  );

  return { refreshToken, expiresAt };
}

export function setRefreshCookie(
  res: Response,
  token: string,
  expiresAt: Date
): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
}
