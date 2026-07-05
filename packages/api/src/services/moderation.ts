import * as tf from "@tensorflow/tfjs-node";
import * as nsfwjs from "nsfwjs";

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
