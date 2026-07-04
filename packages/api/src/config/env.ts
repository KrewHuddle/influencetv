import { config as loadEnv } from "dotenv";
import { existsSync } from "fs";
import { join } from "path";
import { z } from "zod";

// Load env from the monorepo root .env (then a package-local .env override).
const rootEnv = join(__dirname, "../../../../.env");
if (existsSync(rootEnv)) loadEnv({ path: rootEnv });
loadEnv(); // package-local .env, if present (does not override already-set vars)

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().default(3000),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  AWS_REGION: z.string().default("us-east-1"),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_VIDEOS_BUCKET: z.string(),
  S3_UPLOADS_BUCKET: z.string(),
  S3_ASSETS_BUCKET: z.string(),
  CLOUDFRONT_DOMAIN: z.string(),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRY: z.string().default("15m"),
  JWT_REFRESH_EXPIRY: z.string().default("30d"),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_CONNECT_CLIENT_ID: z.string().optional(),
  STRIPE_PREMIUM_PRICE_ID: z.string().optional(),
  STRIPE_ULTRA_PRICE_ID: z.string().optional(),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z
    .string()
    .default("http://localhost:3000/api/auth/google/callback"),
  FRONTEND_URL: z.string().default("http://localhost:3001"),

  SES_FROM_ADDRESS: z.string().default("noreply@apex.tv"),
  YOUTUBE_API_KEY: z.string().optional(),

  ALLOWED_ORIGINS: z.string().default("http://localhost:3001"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(
    "❌ Invalid environment variables:",
    parsed.error.flatten().fieldErrors
  );
  process.exit(1);
}

export const env = parsed.data;

export const allowedOrigins = env.ALLOWED_ORIGINS.split(",").map((o) =>
  o.trim()
);
