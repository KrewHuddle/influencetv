/**
 * Text moderation for user-generated content (posts, comments). Two layers:
 * (1) a fast synchronous banned-term + link-spam filter (moderateText), and
 * (2) an optional Claude ML classifier (aiModeration.ts) via moderateContent.
 */
import { classifyText, aiModerationEnabled } from "./aiModeration";

const BANNED = ["spamword", "viagra", "casino", "freemoney", "crypto-giveaway"];
const MAX_LINKS = 3;

export interface ModerationResult {
  ok: boolean;
  reason?: string;
}

export function moderateText(text: string): ModerationResult {
  const lower = (text ?? "").toLowerCase();
  for (const w of BANNED) {
    if (new RegExp(`\\b${w}\\b`, "i").test(lower)) {
      return { ok: false, reason: "prohibited language" };
    }
  }
  const links = (text.match(/https?:\/\//gi) ?? []).length;
  if (links > MAX_LINKS) return { ok: false, reason: "too many links" };
  return { ok: true };
}

/**
 * Full moderation: run the fast banned-term filter first (cheap, catches the
 * obvious cases with no API cost), then the Claude ML classifier if enabled.
 * Fail-open — if the classifier can't be reached, the banned-list verdict
 * stands and the content is allowed.
 */
export async function moderateContent(text: string): Promise<ModerationResult> {
  const basic = moderateText(text);
  if (!basic.ok) return basic;
  if (!aiModerationEnabled) return { ok: true };

  const ai = await classifyText(text);
  if (ai?.flagged) {
    const cats = ai.categories.length ? ` (${ai.categories.join(", ")})` : "";
    return { ok: false, reason: `${ai.reason || "content policy"}${cats}` };
  }
  return { ok: true };
}
