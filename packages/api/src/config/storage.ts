import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env";

// DigitalOcean Spaces is S3-compatible — same SDK, different endpoint.
export const spacesClient = new S3Client({
  endpoint: env.DO_SPACES_ENDPOINT,
  region: env.DO_SPACES_REGION,
  credentials: {
    accessKeyId: env.DO_SPACES_KEY ?? "",
    secretAccessKey: env.DO_SPACES_SECRET ?? "",
  },
  forcePathStyle: false,
});

export const buckets = {
  videos: env.DO_SPACES_VIDEOS_BUCKET,
  uploads: env.DO_SPACES_UPLOADS_BUCKET,
  assets: env.DO_SPACES_ASSETS_BUCKET,
};

/** Build a public CDN URL for a Spaces object key. */
export function cdnUrl(key: string): string {
  const base = env.DO_CDN_ENDPOINT.startsWith("http")
    ? env.DO_CDN_ENDPOINT
    : `https://${env.DO_CDN_ENDPOINT}`;
  return `${base.replace(/\/+$/, "")}/${key.replace(/^\/+/, "")}`;
}
