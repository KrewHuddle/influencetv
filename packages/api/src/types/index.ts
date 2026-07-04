import type { Request } from "express";
import type { SubscriptionPlan, UserRole } from "@apex/shared";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  plan: SubscriptionPlan;
  stripeAccountId: string | null;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

export interface JwtAccessPayload {
  sub: string;
  role: UserRole;
  plan: SubscriptionPlan;
  type: "access";
}

export interface JwtRefreshPayload {
  sub: string;
  sessionId: string;
  type: "refresh";
}
