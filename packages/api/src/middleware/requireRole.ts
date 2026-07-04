import type { NextFunction, Response } from "express";
import {
  PLAN_RANK,
  ROLE_RANK,
  type SubscriptionPlan,
  type UserRole,
} from "@apex/shared";
import type { AuthedRequest } from "../types";
import { forbidden, unauthorized } from "./errorHandler";

/** Require the caller to hold one of the listed roles (or a higher rank). */
export function requireRole(...roles: UserRole[]) {
  const minRank = Math.min(...roles.map((r) => ROLE_RANK[r]));
  return (req: AuthedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(unauthorized());
    const allowed =
      roles.includes(req.user.role) || ROLE_RANK[req.user.role] >= minRank;
    if (!allowed) return next(forbidden("Insufficient role"));
    next();
  };
}

/** Require the caller's subscription plan to be at least one of the listed plans. */
export function requirePlan(...plans: SubscriptionPlan[]) {
  const minRank = Math.min(...plans.map((p) => PLAN_RANK[p]));
  return (req: AuthedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(unauthorized());
    // super_admin bypasses plan gating
    if (req.user.role === "super_admin") return next();
    if (PLAN_RANK[req.user.plan] < minRank) {
      return next(
        forbidden("Upgrade required", { upgradeRequired: true })
      );
    }
    next();
  };
}

/**
 * Require the caller to own the resource. `getResourceUserId` resolves the
 * owning user id from the request; super_admin/moderator bypass ownership.
 */
export function requireOwner(
  getResourceUserId: (req: AuthedRequest) => Promise<string | null> | string | null
) {
  return async (
    req: AuthedRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) return next(unauthorized());
    if (["super_admin", "moderator"].includes(req.user.role)) return next();
    const ownerId = await getResourceUserId(req);
    if (!ownerId || ownerId !== req.user.id) {
      return next(forbidden("Not the owner"));
    }
    next();
  };
}
