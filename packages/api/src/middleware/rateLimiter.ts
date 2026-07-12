import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redisClient } from "../config/redis";

function store(prefix: string) {
  return new RedisStore({
    prefix: `rl:${prefix}:`,
    // ioredis call signature
    sendCommand: (command: string, ...args: string[]) =>
      redisClient.call(command, ...args) as never,
  });
}

/** Global limiter: 100 requests / 15 min per IP. */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  // Never throttle LB health checks — a 429 here marks the droplet down (503s).
  skip: (req) => req.path === "/health",
  store: store("global"),
  message: {
    data: null,
    error: { message: "Too many requests", code: "RATE_LIMITED" },
  },
});

/** Strict limiter for auth endpoints: 5 requests / 15 min per IP. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: store("auth"),
  message: {
    data: null,
    error: { message: "Too many attempts, try later", code: "RATE_LIMITED" },
  },
});
