import { Router, type Router as ExpressRouter } from "express";
import { query, transaction } from "../config/database";
import { redisClient } from "../config/redis";
import { authenticate } from "../middleware/auth";
import { requirePlan } from "../middleware/requireRole";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { badRequest, notFound } from "../middleware/errorHandler";
import { parsePagination, paginate } from "../utils/pagination";
import { awardPoints } from "../services/PointsEngine";
import type { AuthedRequest } from "../types";

const router: ExpressRouter = Router();

const SORTS: Record<string, string> = {
  new: "p.created_at DESC",
  hot: "(p.like_count + p.comment_count) DESC, p.created_at DESC",
  top: "p.like_count DESC",
};

// GET /api/community  (also mounted at /api/communities) — list all communities.
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT id, name, description, banner_url, member_count, post_count
       FROM communities
       ORDER BY member_count DESC, created_at ASC`
    );
    ok(res, { communities: rows });
  })
);

// GET /api/community/:communityId
router.get(
  "/:communityId",
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      "SELECT id, name, description, rules, banner_url, member_count, post_count FROM communities WHERE id=$1",
      [req.params.communityId]
    );
    if (!rows[0]) throw notFound("Community not found");
    const posts = await query(
      `SELECT p.id, p.title, p.type, p.created_at, u.display_name AS author_name
       FROM posts p JOIN users u ON u.id = p.user_id
       WHERE p.community_id=$1 ORDER BY p.is_pinned DESC, p.created_at DESC LIMIT 5`,
      [req.params.communityId]
    );
    ok(res, { community: rows[0], recentPosts: posts.rows });
  })
);

// POST /api/community/:communityId/join
router.post(
  "/:communityId/join",
  authenticate,
  requirePlan("premium", "ultra"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const inserted = await transaction(async (c) => {
      const r = await c.query(
        `INSERT INTO community_members (community_id, user_id)
         VALUES ($1,$2) ON CONFLICT (community_id, user_id) DO NOTHING RETURNING id`,
        [req.params.communityId, req.user!.id]
      );
      if (r.rowCount) {
        await c.query(
          "UPDATE communities SET member_count = member_count + 1 WHERE id=$1",
          [req.params.communityId]
        );
      }
      return r.rowCount ?? 0;
    });
    if (inserted) await awardPoints(req.user!.id, "join_community");
    ok(res, { joined: true });
  })
);

// GET /api/community/:communityId/posts
router.get(
  "/:communityId/posts",
  asyncHandler(async (req, res) => {
    const p = parsePagination(req.query);
    const sort = SORTS[(req.query.sort as string) ?? "new"] ?? SORTS.new;
    const typeFilter = req.query.type as string | undefined;
    const params: unknown[] = [req.params.communityId];
    let where = "p.community_id = $1";
    if (typeFilter) {
      params.push(typeFilter);
      where += ` AND p.type = $${params.length}::post_type`;
    }
    params.push(p.limit, p.offset);
    const items = await query(
      `SELECT p.id, p.title, p.body, p.type, p.like_count, p.comment_count,
              p.is_pinned, p.created_at, u.display_name AS author_name
       FROM posts p JOIN users u ON u.id = p.user_id
       WHERE ${where} ORDER BY p.is_pinned DESC, ${sort}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const count = await query<{ n: string }>(
      `SELECT COUNT(*)::int AS n FROM posts p WHERE ${where}`,
      params.slice(0, typeFilter ? 2 : 1)
    );
    ok(res, paginate(items.rows, Number(count.rows[0].n), p));
  })
);

// POST /api/community/:communityId/posts
router.post(
  "/:communityId/posts",
  authenticate,
  requirePlan("premium", "ultra"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { type, title, body, episodeId, timestampRef } = req.body as {
      type?: string;
      title?: string;
      body: string;
      episodeId?: string;
      timestampRef?: number;
    };
    if (!body?.trim()) throw badRequest("Body required");

    const post = await transaction(async (c) => {
      const r = await c.query<{ id: string }>(
        `INSERT INTO posts (community_id, user_id, type, title, body, episode_id, timestamp_ref)
         VALUES ($1,$2,COALESCE($3,'discussion')::post_type,$4,$5,$6,$7) RETURNING id`,
        [req.params.communityId, req.user!.id, type ?? null, title ?? null, body, episodeId ?? null, timestampRef ?? null]
      );
      await c.query(
        "UPDATE communities SET post_count = post_count + 1 WHERE id=$1",
        [req.params.communityId]
      );
      return r.rows[0];
    });
    await awardPoints(req.user!.id, "post");
    ok(res, { post }, 201);
  })
);

// GET /api/community/posts/:postId/comments (threaded)
router.get(
  "/posts/:postId/comments",
  asyncHandler(async (req, res) => {
    const { rows } = await query<{
      id: string;
      parent_id: string | null;
      body: string;
      like_count: number;
      created_at: Date;
      author_name: string | null;
    }>(
      `SELECT c.id, c.parent_id, c.body, c.like_count, c.created_at, u.display_name AS author_name
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.post_id=$1 ORDER BY c.created_at ASC`,
      [req.params.postId]
    );
    // Build a nested tree.
    type Node = (typeof rows)[number] & { replies: Node[] };
    const map = new Map<string, Node>();
    const roots: Node[] = [];
    for (const r of rows) map.set(r.id, { ...r, replies: [] });
    for (const r of rows) {
      const node = map.get(r.id)!;
      if (r.parent_id && map.has(r.parent_id)) map.get(r.parent_id)!.replies.push(node);
      else roots.push(node);
    }
    ok(res, { comments: roots });
  })
);

// POST /api/community/posts/:postId/comments
router.post(
  "/posts/:postId/comments",
  authenticate,
  requirePlan("premium", "ultra"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { body, parentId } = req.body as { body: string; parentId?: string };
    if (!body?.trim()) throw badRequest("Body required");
    const comment = await transaction(async (c) => {
      const r = await c.query<{ id: string }>(
        `INSERT INTO comments (post_id, user_id, parent_id, body)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [req.params.postId, req.user!.id, parentId ?? null, body]
      );
      await c.query(
        "UPDATE posts SET comment_count = comment_count + 1 WHERE id=$1",
        [req.params.postId]
      );
      return r.rows[0];
    });
    await awardPoints(req.user!.id, "comment");
    ok(res, { comment }, 201);
  })
);

// POST /api/community/posts/:postId/like (toggle via Redis set)
router.post(
  "/posts/:postId/like",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    const key = `postlikes:${req.params.postId}`;
    const already = await redisClient.sismember(key, req.user!.id);
    if (already) {
      await redisClient.srem(key, req.user!.id);
      await query("UPDATE posts SET like_count = GREATEST(0, like_count - 1) WHERE id=$1", [
        req.params.postId,
      ]);
      ok(res, { liked: false });
      return;
    }
    await redisClient.sadd(key, req.user!.id);
    const { rows } = await query<{ user_id: string }>(
      "UPDATE posts SET like_count = like_count + 1 WHERE id=$1 RETURNING user_id",
      [req.params.postId]
    );
    // Award the post author.
    if (rows[0] && rows[0].user_id !== req.user!.id) {
      await awardPoints(rows[0].user_id, "like_received");
    }
    ok(res, { liked: true });
  })
);

export default router;
