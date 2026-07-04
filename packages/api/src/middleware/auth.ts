import type { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { query } from "../config/database";
import { redisClient } from "../config/redis";
import type { AuthUser, AuthedRequest, JwtAccessPayload } from "../types";
import { forbidden, unauthorized } from "./errorHandler";
import type { SubscriptionPlan, UserRole } from "@apex/shared";

interface UserRow {
  id: string;
  email: string;
  role: UserRole;
  subscription_plan: SubscriptionPlan;
  stripe_account_id: string | null;
  is_active: boolean;
  suspended_until: Date | null;
}

const USER_CACHE_TTL = 300; // 5 min

async function loadUser(userId: string): Promise<UserRow | null> {
  const cacheKey = `user:${userId}`;
  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached) as UserRow;

  const { rows } = await query<UserRow>(
    `SELECT id, email, role, subscription_plan, stripe_account_id, is_active, suspended_until
     FROM users WHERE id = $1`,
    [userId]
  );
  if (rows.length === 0) return null;

  await redisClient.set(cacheKey, JSON.stringify(rows[0]), "EX", USER_CACHE_TTL);
  return rows[0];
}

export async function authenticate(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw unauthorized("Missing bearer token");
    }
    const token = header.slice(7);

    let payload: JwtAccessPayload;
    try {
      payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtAccessPayload;
    } catch {
      throw unauthorized("Invalid or expired token");
    }
    if (payload.type !== "access") throw unauthorized("Wrong token type");

    const user = await loadUser(payload.sub);
    if (!user || !user.is_active) throw unauthorized("User not found");

    if (user.suspended_until && new Date(user.suspended_until) > new Date()) {
      throw forbidden("Account suspended");
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      plan: user.subscription_plan,
      stripeAccountId: user.stripe_account_id,
    };
    req.user = authUser;
    next();
  } catch (err) {
    next(err);
  }
}

/** Invalidate the cached user record (call after profile/role/plan changes). */
export async function clearUserCache(userId: string): Promise<void> {
  await redisClient.del(`user:${userId}`);
}
