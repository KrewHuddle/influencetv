import { S3Client } from "@aws-sdk/client-s3";
import { SESClient } from "@aws-sdk/client-ses";
import { RekognitionClient } from "@aws-sdk/client-rekognition";
import { env } from "./env";

const credentials =
  env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined; // fall back to instance IAM role in prod

export const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials,
});

export const sesClient = new SESClient({
  region: env.AWS_REGION,
  credentials,
});

export const rekognitionClient = new RekognitionClient({
  region: env.AWS_REGION,
  credentials,
});

export const buckets = {
  videos: env.S3_VIDEOS_BUCKET,
  uploads: env.S3_UPLOADS_BUCKET,
  assets: env.S3_ASSETS_BUCKET,
};

export function cloudfrontUrl(key: string): string {
  const base = env.CLOUDFRONT_DOMAIN.startsWith("http")
    ? env.CLOUDFRONT_DOMAIN
    : `https://${env.CLOUDFRONT_DOMAIN}`;
  return `${base}/${key.replace(/^\/+/, "")}`;
}
