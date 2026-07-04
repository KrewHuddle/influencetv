import type { NextFunction, Response } from "express";
import { query } from "../config/database";
import { forbidden, notFound } from "./errorHandler";
import type { AuthedRequest } from "../types";

/**
 * Gate a video that is patron-exclusive. Passes through non-exclusive videos.
 * For exclusive videos, requires an active patron_subscription to the creator;
 * if the video specifies a required tier, the subscriber's tier position must
 * be >= the required tier's position.
 */
export function requirePatronForVideo(
  getVideoId: (req: AuthedRequest) => string
) {
  return async (
    req: AuthedRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const videoId = getVideoId(req);
      const { rows } = await query<{
        creator_id: string;
        is_patron_exclusive: boolean;
        patron_tier_id: string | null;
      }>(
        "SELECT creator_id, is_patron_exclusive, patron_tier_id FROM videos WHERE id=$1",
        [videoId]
      );
      const video = rows[0];
      if (!video) return next(notFound("Video not found"));
      if (!video.is_patron_exclusive) return next();

      if (!req.user) {
        return next(forbidden("Patron content", { requiresPatron: true, creatorId: video.creator_id }));
      }
      // Creator + admins always have access.
      if (req.user.id === video.creator_id || req.user.role === "super_admin") {
        return next();
      }

      const sub = await query<{ tier_position: number }>(
        `SELECT t.position AS tier_position
         FROM patron_subscriptions ps JOIN patron_tiers t ON t.id = ps.tier_id
         WHERE ps.fan_id=$1 AND ps.creator_id=$2 AND ps.status='active'`,
        [req.user.id, video.creator_id]
      );
      if (!sub.rows[0]) {
        return next(
          forbidden("Patron content", {
            requiresPatron: true,
            creatorId: video.creator_id,
          })
        );
      }

      if (video.patron_tier_id) {
        const required = await query<{ position: number }>(
          "SELECT position FROM patron_tiers WHERE id=$1",
          [video.patron_tier_id]
        );
        if (required.rows[0] && sub.rows[0].tier_position < required.rows[0].position) {
          return next(
            forbidden("Higher patron tier required", {
              requiresPatron: true,
              creatorId: video.creator_id,
              minimumTier: video.patron_tier_id,
            })
          );
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
