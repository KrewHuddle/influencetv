import Redis from "ioredis";
import { env } from "./env";

export const redisClient = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  retryStrategy(times) {
    // exponential backoff, capped at 10s
    return Math.min(times * 200, 10_000);
  },
});

redisClient.on("connect", () => {
  // eslint-disable-next-line no-console
  console.log("✅ Redis/Valkey connected");
});

redisClient.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("Redis error:", err.message);
});

export async function setEx(
  key: string,
  seconds: number,
  value: string
): Promise<void> {
  await redisClient.set(key, value, "EX", seconds);
}

export async function get(key: string): Promise<string | null> {
  return redisClient.get(key);
}

export async function del(key: string): Promise<number> {
  return redisClient.del(key);
}

// Plain connection options for BullMQ (avoids passing an ioredis instance whose
// version may differ from the one BullMQ bundles). maxRetriesPerRequest must be null.
// IMPORTANT: carry username + TLS through — managed Valkey/Redis (rediss://)
// requires TLS; without it every Queue.add hangs against the TLS port.
const redisUrl = new URL(env.REDIS_URL);
export const bullConnection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  ...(redisUrl.protocol === "rediss:" ? { tls: {} } : {}),
  maxRetriesPerRequest: null as null,
};

export async function isRedisConnected(): Promise<boolean> {
  try {
    const pong = await redisClient.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}
