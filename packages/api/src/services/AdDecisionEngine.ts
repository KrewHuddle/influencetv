import { query } from "../config/database";

export interface AdSelection {
  campaignId: string;
  advertiserName: string | null;
  creativeVideoId: string;
  hlsUrl: string | null;
  s3OriginalKey: string | null;
  durationSeconds: number;
  cpmCents: number;
}

export type AdContext = "linear" | "vod";

/**
 * Ad decision engine — fills an ad break with eligible campaign creatives.
 *
 * Eligibility: active, within flight dates, has a ready creative, not past its
 * impression target, and not over budget (spend = cpm * impressions / 1000).
 * Rotation/pacing: least-served campaigns win first (ORDER BY impressions_served
 * ASC), so spend spreads evenly across advertisers.
 */
class AdDecisionEngine {
  /** Pick an ordered list of creatives to fill up to `targetSeconds`. */
  async selectAdsForBreak(targetSeconds: number): Promise<AdSelection[]> {
    const { rows } = await query<{
      id: string;
      advertiser_name: string | null;
      video_id: string;
      cpm_cents: number;
      duration_seconds: number | null;
      hls_url: string | null;
      s3_original_key: string | null;
    }>(
      `SELECT c.id, c.advertiser_name, c.video_id, c.cpm_cents,
              v.duration_seconds, v.hls_url, v.s3_original_key
       FROM ad_campaigns c
       JOIN videos v ON v.id = c.video_id AND v.status = 'ready'
       WHERE c.is_active
         AND (c.start_date IS NULL OR c.start_date <= NOW())
         AND (c.end_date   IS NULL OR c.end_date   >= NOW())
         AND (c.impressions_target IS NULL OR c.impressions_served < c.impressions_target)
         AND (c.budget_cents IS NULL OR (c.cpm_cents * c.impressions_served / 1000) < c.budget_cents)
       ORDER BY c.impressions_served ASC, c.created_at ASC`
    );

    const selections: AdSelection[] = [];
    let filled = 0;
    for (const r of rows) {
      if (filled >= targetSeconds) break;
      const dur = r.duration_seconds ?? 30;
      selections.push({
        campaignId: r.id,
        advertiserName: r.advertiser_name,
        creativeVideoId: r.video_id,
        hlsUrl: r.hls_url,
        s3OriginalKey: r.s3_original_key,
        durationSeconds: dur,
        cpmCents: r.cpm_cents,
      });
      filled += dur;
    }
    return selections;
  }

  /**
   * Record impressions for a set of served ads. `viewers` = concurrent viewers
   * (linear) or 1 (VOD). Increments each campaign's counter and writes a
   * revenue-ledger row per creative.
   */
  async recordImpressions(
    selections: AdSelection[],
    viewers: number,
    context: AdContext,
    refId: string | null
  ): Promise<void> {
    const count = Math.max(1, viewers);
    for (const s of selections) {
      const revenue = Math.round((s.cpmCents * count) / 1000);
      await query(
        "UPDATE ad_campaigns SET impressions_served = impressions_served + $1 WHERE id = $2",
        [count, s.campaignId]
      ).catch(() => undefined);
      await query(
        `INSERT INTO ad_impressions
           (campaign_id, context, ref_id, creative_video_id, impressions, revenue_cents)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [s.campaignId, context, refId, s.creativeVideoId, count, revenue]
      ).catch(() => undefined);
    }
  }
}

export const adDecisionEngine = new AdDecisionEngine();
