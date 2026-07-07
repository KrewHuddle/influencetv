import { query } from "../config/database";
import { clearUserCache } from "../middleware/auth";
import { getIo, rooms } from "../sockets";

export type PointAction =
  | "watch_episode_full"
  | "watch_live"
  | "comment"
  | "post"
  | "join_community"
  | "purchase_patron"
  | "purchase_shop"
  | "like_received"
  | "first_upload"
  | "watch_party_host"
  | "haggle_bid"
  | "haggle_win"
  | "haggle_sell"
  | "haggle_watch";

const POINTS: Record<PointAction, number> = {
  watch_episode_full: 50,
  watch_live: 75,
  comment: 5,
  post: 10,
  join_community: 25,
  purchase_patron: 100,
  purchase_shop: 25,
  like_received: 2,
  first_upload: 200,
  watch_party_host: 150,
  haggle_bid: 10,
  haggle_win: 150,
  haggle_sell: 50,
  haggle_watch: 5,
};

// Ordered ascending by threshold.
const LEVELS: Array<{ level: number; name: string; min: number }> = [
  { level: 1, name: "Viewer", min: 0 },
  { level: 2, name: "Regular", min: 500 },
  { level: 3, name: "Fan", min: 2000 },
  { level: 4, name: "Superfan", min: 7500 },
  { level: 5, name: "Insider", min: 20000 },
  { level: 6, name: "Legend", min: 50000 },
];

function levelFor(points: number): { level: number; name: string } {
  let result = LEVELS[0];
  for (const l of LEVELS) if (points >= l.min) result = l;
  return { level: result.level, name: result.name };
}

/**
 * Award points for an action. Upserts user_points, recomputes level, and on
 * level-up emits `level-up` + grants free Premium at Level 6 (Legend).
 */
export async function awardPoints(
  userId: string,
  action: PointAction,
  metadata: Record<string, unknown> = {}
): Promise<{ total: number; level: number; leveledUp: boolean }> {
  const delta = POINTS[action];

  const { rows } = await query<{
    total_points: number;
    level: number;
  }>(
    `INSERT INTO user_points (user_id, total_points, last_activity_at, updated_at)
     VALUES ($1, $2, NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       total_points = user_points.total_points + $2,
       last_activity_at = NOW(), updated_at = NOW()
     RETURNING total_points, level`,
    [userId, delta]
  );

  const total = rows[0].total_points;
  const prevLevel = rows[0].level;
  const next = levelFor(total);
  const leveledUp = next.level > prevLevel;

  if (leveledUp) {
    await query(
      "UPDATE user_points SET level = $1, level_name = $2 WHERE user_id = $3",
      [next.level, next.name, userId]
    );
    // Level 6 "Legend" → free Premium.
    if (next.level >= 6) {
      await query(
        "UPDATE users SET subscription_plan = 'premium' WHERE id = $1 AND subscription_plan = 'free'",
        [userId]
      );
      await clearUserCache(userId);
    }
    try {
      getIo().to(rooms.user(userId)).emit("level-up", {
        level: next.level,
        levelName: next.name,
        total,
      });
    } catch {
      /* socket optional */
    }
  }

  void metadata;
  return { total, level: next.level, leveledUp };
}
