import {
  CreateMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  UploadPartCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createReadStream, createWriteStream } from "fs";
import { readFile, stat } from "fs/promises";
import { pipeline } from "stream/promises";
import type { Readable } from "stream";
import { spacesClient, buckets } from "../config/storage";

const PRESIGN_TTL = 3600; // 1h

/** Presigned GET URL for a stored digital asset. */
export async function presignDownload(
  key: string,
  expiresSeconds = PRESIGN_TTL,
  bucket: string = buckets.assets
): Promise<string> {
  return getSignedUrl(
    spacesClient,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: expiresSeconds }
  );
}

export interface PresignedPart {
  partNumber: number;
  url: string;
}

/** Start a multipart upload and presign `partCount` part URLs. */
export async function createMultipartUpload(
  bucket: string,
  key: string,
  contentType: string,
  partCount = 10
): Promise<{ uploadId: string; parts: PresignedPart[] }> {
  const created = await spacesClient.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    })
  );
  const uploadId = created.UploadId!;
  const parts: PresignedPart[] = [];
  for (let n = 1; n <= partCount; n++) {
    const url = await getSignedUrl(
      spacesClient,
      new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: n,
      }),
      { expiresIn: PRESIGN_TTL }
    );
    parts.push({ partNumber: n, url });
  }
  return { uploadId, parts };
}

export async function completeMultipartUpload(
  bucket: string,
  key: string,
  uploadId: string,
  parts: Array<{ ETag: string; PartNumber: number }>
): Promise<void> {
  await spacesClient.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
      },
    })
  );
}

/** Upload a local file to S3. Streams the body from disk. */
export async function uploadFile(
  bucket: string,
  key: string,
  filePath: string,
  contentType: string
): Promise<void> {
  const { size } = await stat(filePath);
  await spacesClient.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: createReadStream(filePath),
      ContentLength: size,
      ContentType: contentType,
    })
  );
}

/** Read a whole S3-bound local file into a Buffer (for Rekognition, etc.). */
export async function readFileBytes(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}

/** Stream an S3 object to a local file path. */
export async function downloadToFile(
  bucket: string,
  key: string,
  destPath: string
): Promise<void> {
  const res = await spacesClient.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  await pipeline(res.Body as Readable, createWriteStream(destPath));
}
