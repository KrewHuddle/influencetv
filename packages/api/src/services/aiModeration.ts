import Anthropic from "@anthropic-ai/sdk";

/**
 * ML text-moderation classifier (Claude). Second-pass layer above the
 * banned-term filter in textModeration.ts — catches toxicity/harassment/hate
 * that a keyword list misses. No-op unless ANTHROPIC_API_KEY is set, so dev and
 * un-keyed envs fall back to the banned-list alone.
 *
 * Model defaults to claude-opus-4-8; override with MODERATION_MODEL (e.g.
 * claude-haiku-4-5 for cheaper/faster high-volume moderation).
 */
const apiKey = process.env.ANTHROPIC_API_KEY;
export const aiModerationEnabled = Boolean(apiKey);

const client = apiKey ? new Anthropic({ apiKey }) : null;
const MODEL = process.env.MODERATION_MODEL ?? "claude-opus-4-8";

export interface AiModerationResult {
  flagged: boolean;
  categories: string[];
  reason: string;
}

// Structured-output contract — the model must return exactly this shape.
const SCHEMA = {
  type: "object",
  properties: {
    flagged: { type: "boolean" },
    categories: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "harassment",
          "hate",
          "sexual",
          "violence",
          "self_harm",
          "spam",
          "illegal",
          "other",
        ],
      },
    },
    reason: { type: "string" },
  },
  required: ["flagged", "categories", "reason"],
  additionalProperties: false,
} as const;

const SYSTEM =
  "You are a content-moderation classifier for a community platform's posts and comments. " +
  "Flag content that is harassing, hateful, sexually explicit, violent, promotes self-harm, " +
  "is spam/scam, or is otherwise illegal. Do NOT flag ordinary disagreement, profanity used " +
  "casually, or on-topic criticism. Return flagged=true only when a human moderator would " +
  "reasonably remove the content. Keep `reason` to one short sentence.";

/**
 * Returns a classification, or null when moderation is disabled or the model
 * could not be consulted. Callers fail-open on null (the banned-list already
 * ran). A model refusal is treated as flagged, conservatively.
 */
export async function classifyText(text: string): Promise<AiModerationResult | null> {
  if (!client) return null;
  const content = (text ?? "").slice(0, 8000);
  if (!content.trim()) return null;
  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content }],
    });

    if (resp.stop_reason === "refusal") {
      return { flagged: true, categories: ["other"], reason: "Classifier declined the content" };
    }
    const block = resp.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return null;
    return JSON.parse(block.text) as AiModerationResult;
  } catch {
    // Network/parse/API error → can't determine; don't block (banned-list stands).
    return null;
  }
}
