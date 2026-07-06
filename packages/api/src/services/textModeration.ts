/**
 * Lightweight text moderation for user-generated content (posts, comments).
 * Blocks a configurable banned-term list and obvious link spam. This is a
 * first-pass filter — swap BANNED for a managed list or an external moderation
 * API for production-grade coverage.
 */
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
