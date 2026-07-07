import * as tf from "@tensorflow/tfjs-node";
import * as nsfwjs from "nsfwjs";
import { env } from "../config/env";

// Load the NSFW model once and reuse it across calls.
let modelPromise: Promise<nsfwjs.NSFWJS> | null = null;
function getModel(): Promise<nsfwjs.NSFWJS> {
  modelPromise ??= nsfwjs.load();
  return modelPromise;
}

const NSFW_CLASSES = new Set(["Porn", "Hentai", "Sexy"]);
const NSFW_THRESHOLD = 0.6;

/**
 * Return true if the image is likely NSFW. Drop-in replacement for the old
 * AWS Rekognition moderation check — runs locally via nsfwjs + tfjs-node.
 */
export async function isImageNSFW(bytes: Buffer): Promise<boolean> {
  const model = await getModel();
  const image = tf.node.decodeImage(bytes, 3) as tf.Tensor3D;
  try {
    const predictions = await model.classify(image);
    const nsfwScore = predictions
      .filter((p) => NSFW_CLASSES.has(p.className))
      .reduce((sum, p) => sum + p.probability, 0);
    return nsfwScore >= NSFW_THRESHOLD;
  } finally {
    image.dispose();
  }
}

const FETCH_TIMEOUT_MS = 8000;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/**
 * Hosts we are willing to fetch server-side. Restricting to our own CDN/Spaces
 * prevents SSRF: product image URLs are user-supplied, and blindly fetching an
 * arbitrary URL from the API host could hit internal services or metadata
 * endpoints. Our images always live behind the CDN / Spaces domains.
 */
function hostAllowed(u: URL): boolean {
  const allow: string[] = [];
  try {
    const cdn = env.DO_CDN_ENDPOINT.startsWith("http")
      ? env.DO_CDN_ENDPOINT
      : `https://${env.DO_CDN_ENDPOINT}`;
    allow.push(new URL(cdn).host);
  } catch {
    /* no CDN configured */
  }
  try {
    if (env.DO_SPACES_ENDPOINT) allow.push(new URL(env.DO_SPACES_ENDPOINT).host);
  } catch {
    /* no Spaces endpoint */
  }
  return allow.some((h) => u.host === h || u.host.endsWith(`.${h}`));
}

/**
 * Fetch a remote image (only from allowlisted CDN/Spaces hosts) and NSFW-scan
 * it. Throws on anything unscannable — a disallowed host, non-image content,
 * oversize payload, fetch/timeout error, or a format tfjs can't decode. Callers
 * treat a throw as "could not determine" and fall back to manual review rather
 * than blocking the upload.
 */
export async function isRemoteImageNSFW(rawUrl: string): Promise<boolean> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error("invalid image url");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error("unsupported image url scheme");
  }
  if (!hostAllowed(u)) throw new Error("image host not allowlisted");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(u, { signal: ctrl.signal, redirect: "error" });
    if (!resp.ok) throw new Error(`image fetch ${resp.status}`);
    const ct = resp.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) throw new Error(`not an image: ${ct}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.byteLength > MAX_IMAGE_BYTES) throw new Error("image too large to scan");
    return isImageNSFW(buf);
  } finally {
    clearTimeout(timer);
  }
}
