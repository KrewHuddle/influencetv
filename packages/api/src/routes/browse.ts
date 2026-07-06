import { Router, type Router as ExpressRouter } from "express";
import { query } from "../config/database";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { parsePagination } from "../utils/pagination";

const router: ExpressRouter = Router();

const SORTS: Record<string, string> = {
  new: "v.published_at DESC NULLS LAST, v.created_at DESC",
  popular: "v.view_count DESC",
  trending: "(v.view_count + v.like_count * 3) DESC, v.created_at DESC",
};

// GET /api/browse?sort=&genre=&category=&q=&page=&limit=
// Public catalogue of ready videos, joined to their creator.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const { limit, offset } = parsePagination(req.query);
    const sort = SORTS[(req.query.sort as string) ?? "new"] ?? SORTS.new;
    const genre = (req.query.genre as string) || (req.query.category as string) || "";
    const q = ((req.query.q as string) ?? "").trim();

    const where: string[] = ["v.status = 'ready'"];
    const params: unknown[] = [];

    if (genre && genre.toLowerCase() !== "all") {
      params.push(genre);
      where.push(`v.genre ILIKE $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      where.push(
        `(v.title ILIKE $${params.length} OR v.description ILIKE $${params.length} OR u.display_name ILIKE $${params.length})`
      );
    }

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const { rows } = await query(
      `SELECT
         v.id, v.title, v.thumbnail_url, v.duration_seconds, v.view_count,
         v.genre, v.type,
         v.is_patron_exclusive AS is_patron,
         v.is_premium,
         u.display_name AS creator_name,
         u.username     AS creator_username
       FROM videos v
       JOIN users u ON u.id = v.creator_id
       WHERE ${where.join(" AND ")}
       ORDER BY ${sort}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params
    );

    ok(res, { items: rows });
  })
);

export default router;
