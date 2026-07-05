// Ensure required env exists before importing modules that validate it.
process.env.DATABASE_URL ??= "postgresql://apex:apex@127.0.0.1:5433/apex_dev";
process.env.REDIS_URL ??= "redis://127.0.0.1:6380";
// DO_SPACES_* + DO_CDN_ENDPOINT have zod defaults — no need to set them here.
process.env.JWT_ACCESS_SECRET ??= "test_access_secret_0123456789";
process.env.JWT_REFRESH_SECRET ??= "test_refresh_secret_0123456789";

import jwt from "jsonwebtoken";
import { durationToMs, signAccessToken } from "../utils/tokens";
import {
  registerSchema,
  loginSchema,
  resetPasswordSchema,
} from "../utils/validate";

describe("validation schemas", () => {
  it("rejects weak passwords", () => {
    expect(registerSchema.safeParse({ email: "a@b.com", password: "short" }).success).toBe(false);
    expect(registerSchema.safeParse({ email: "a@b.com", password: "alllowercase1" }).success).toBe(false);
    expect(registerSchema.safeParse({ email: "a@b.com", password: "NoNumbersHere" }).success).toBe(false);
  });

  it("accepts a strong password", () => {
    expect(
      registerSchema.safeParse({ email: "a@b.com", password: "Strong123" }).success
    ).toBe(true);
  });

  it("rejects invalid emails on login", () => {
    expect(loginSchema.safeParse({ email: "notanemail", password: "x" }).success).toBe(false);
  });

  it("requires token + strong password on reset", () => {
    expect(resetPasswordSchema.safeParse({ token: "", password: "Strong123" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token: "t", password: "Strong123" }).success).toBe(true);
  });
});

describe("durationToMs", () => {
  it("parses units", () => {
    expect(durationToMs("15m")).toBe(900_000);
    expect(durationToMs("30d")).toBe(2_592_000_000);
    expect(durationToMs("1h")).toBe(3_600_000);
    expect(durationToMs("45s")).toBe(45_000);
    expect(durationToMs("3600")).toBe(3_600_000);
  });
});

describe("access token", () => {
  it("signs a verifiable access token with correct claims", () => {
    const token = signAccessToken({ id: "u1", role: "viewer_free", plan: "free" });
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as Record<
      string,
      unknown
    >;
    expect(decoded.sub).toBe("u1");
    expect(decoded.type).toBe("access");
    expect(decoded.role).toBe("viewer_free");
  });
});

// NOTE: Full register→login→refresh→logout + rate-limit + Google-OAuth-mock
// integration tests require live Postgres/Valkey and a createApp() export.
// Tracked for the CI harness; the unit suite above runs without external deps.
