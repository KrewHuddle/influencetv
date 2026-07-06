import { Router, type Router as ExpressRouter, type Request } from "express";
import jwt from "jsonwebtoken";
import { query, transaction } from "../config/database";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../utils/asyncHandler";
import { ok } from "../utils/response";
import { badRequest, forbidden, notFound } from "../middleware/errorHandler";
import { env } from "../config/env";
import { PLAN_RANK } from "@apex/shared";
import type { AuthedRequest, JwtAccessPayload } from "../types";

const router: ExpressRouter = Router();
const creatorRoles = requireRole("creator", "super_admin");

/** Decode the bearer token if present, else null (for public routes that
 *  enhance their response for a signed-in viewer). */
function optionalUser(req: Request): { id: string; role: string; plan: string } | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  try {
    const p = jwt.verify(h.slice(7), env.JWT_ACCESS_SECRET) as JwtAccessPayload;
    return { id: p.sub, role: p.role, plan: p.plan };
  } catch {
    return null;
  }
}

function slugify(title: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
  const suffix = Math.floor(Math.random() * 1e6).toString(36);
  return `${base || "course"}-${suffix}`;
}

async function loadOwnedCourse(courseId: string, req: AuthedRequest) {
  const { rows } = await query<{ creator_id: string; lesson_count: number }>(
    "SELECT creator_id, lesson_count FROM courses WHERE id = $1",
    [courseId]
  );
  const c = rows[0];
  if (!c) throw notFound("Course not found");
  if (c.creator_id !== req.user!.id && req.user!.role !== "super_admin") {
    throw forbidden("Not the course owner");
  }
  return c;
}

// ─────────────────────── public catalogue ───────────────────────

// GET /api/courses — published courses.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const category = (req.query.category as string) || "";
    const params: unknown[] = [];
    let where = "c.is_published = true";
    if (category && category.toLowerCase() !== "all") {
      params.push(category);
      where += ` AND c.category ILIKE $${params.length}`;
    }
    const { rows } = await query(
      `SELECT c.id, c.title, c.slug, c.description, c.thumbnail_url, c.category,
              c.access_level, c.lesson_count, c.enrollment_count,
              u.display_name AS creator_name, u.username AS creator_username
       FROM courses c JOIN users u ON u.id = c.creator_id
       WHERE ${where}
       ORDER BY c.enrollment_count DESC, c.created_at DESC`,
      params
    );
    ok(res, { courses: rows });
  })
);

// GET /api/courses/me/enrollments — the current user's courses + progress.
router.get(
  "/me/enrollments",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { rows } = await query(
      `SELECT c.id, c.title, c.slug, c.thumbnail_url, c.lesson_count,
              e.enrolled_at, e.completed_at,
              (SELECT COUNT(*) FROM lesson_progress lp
               WHERE lp.user_id = $1 AND lp.course_id = c.id AND lp.completed)::int AS completed_lessons
       FROM enrollments e JOIN courses c ON c.id = e.course_id
       WHERE e.user_id = $1
       ORDER BY e.enrolled_at DESC`,
      [req.user!.id]
    );
    ok(res, { enrollments: rows });
  })
);

// GET /api/courses/me/authored — the current creator's own courses (incl drafts).
router.get(
  "/me/authored",
  authenticate,
  creatorRoles,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { rows } = await query(
      `SELECT id, title, slug, category, access_level, is_published, lesson_count, enrollment_count, created_at
       FROM courses WHERE creator_id = $1 ORDER BY created_at DESC`,
      [req.user!.id]
    );
    ok(res, { courses: rows });
  })
);

// GET /api/courses/:slug — full course with modules + lessons (+ progress if authed).
router.get(
  "/:slug",
  asyncHandler(async (req: AuthedRequest, res) => {
    const { rows } = await query<{
      id: string; creator_id: string; is_published: boolean;
      [k: string]: unknown;
    }>(
      `SELECT c.*, u.display_name AS creator_name, u.username AS creator_username
       FROM courses c JOIN users u ON u.id = c.creator_id
       WHERE c.slug = $1`,
      [req.params.slug]
    );
    const course = rows[0];
    if (!course) throw notFound("Course not found");

    const u = optionalUser(req);
    const userId = u?.id ?? null;
    const isOwner = userId === course.creator_id || u?.role === "super_admin";
    if (!course.is_published && !isOwner) throw notFound("Course not found");

    const modules = (
      await query("SELECT id, title, position FROM course_modules WHERE course_id = $1 ORDER BY position ASC", [course.id])
    ).rows;

    const enrolled = userId
      ? ((await query("SELECT 1 FROM enrollments WHERE course_id=$1 AND user_id=$2", [course.id, userId])).rowCount ?? 0) > 0
      : false;

    // Lesson bodies (content/video) only for enrolled users, the owner, or previews.
    const lessons = (
      await query<{ id: string; is_preview: boolean; [k: string]: unknown }>(
        `SELECT l.id, l.module_id, l.title, l.video_id, l.content, l.duration_seconds,
                l.position, l.is_preview, v.hls_url
         FROM lessons l LEFT JOIN videos v ON v.id = l.video_id
         WHERE l.course_id = $1 ORDER BY l.position ASC`,
        [course.id]
      )
    ).rows.map((l) => {
      const unlocked = enrolled || isOwner || l.is_preview;
      return unlocked ? l : { ...l, video_id: null, content: null, hls_url: null };
    });

    const progress = userId
      ? (await query("SELECT lesson_id, completed FROM lesson_progress WHERE user_id=$1 AND course_id=$2", [userId, course.id])).rows
      : [];

    ok(res, { course, modules, lessons, enrolled, progress });
  })
);

// ─────────────────────── learner actions ───────────────────────

// POST /api/courses/:id/enroll
router.post(
  "/:id/enroll",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { rows } = await query<{ access_level: string; is_published: boolean }>(
      "SELECT access_level, is_published FROM courses WHERE id = $1",
      [req.params.id]
    );
    const course = rows[0];
    if (!course || !course.is_published) throw notFound("Course not found");

    // Plan gate: course access_level (free/premium/ultra) vs the user's plan.
    const need = PLAN_RANK[course.access_level as keyof typeof PLAN_RANK] ?? 0;
    const have = PLAN_RANK[req.user!.plan] ?? 0;
    if (have < need) throw forbidden("Upgrade required for this course", { upgradeRequired: true });

    await transaction(async (c) => {
      const ins = await c.query(
        "INSERT INTO enrollments (course_id, user_id) VALUES ($1,$2) ON CONFLICT (course_id, user_id) DO NOTHING RETURNING id",
        [req.params.id, req.user!.id]
      );
      if (ins.rowCount) {
        await c.query("UPDATE courses SET enrollment_count = enrollment_count + 1 WHERE id = $1", [req.params.id]);
      }
    });
    ok(res, { enrolled: true });
  })
);

// POST /api/courses/:id/lessons/:lessonId/progress
router.post(
  "/:id/lessons/:lessonId/progress",
  authenticate,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { watchedSeconds, completed } = req.body as { watchedSeconds?: number; completed?: boolean };
    const done = completed ?? true;

    await query(
      `INSERT INTO lesson_progress (user_id, lesson_id, course_id, completed, watched_seconds)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, lesson_id) DO UPDATE SET
         completed = EXCLUDED.completed,
         watched_seconds = GREATEST(lesson_progress.watched_seconds, EXCLUDED.watched_seconds),
         updated_at = NOW()`,
      [req.user!.id, req.params.lessonId, req.params.id, done, watchedSeconds ?? 0]
    );

    // Recompute course completion.
    const { rows } = await query<{ lesson_count: number; done: number }>(
      `SELECT c.lesson_count,
              (SELECT COUNT(*) FROM lesson_progress lp
               WHERE lp.user_id=$1 AND lp.course_id=$2 AND lp.completed)::int AS done
       FROM courses c WHERE c.id=$2`,
      [req.user!.id, req.params.id]
    );
    const stat = rows[0];
    const isComplete = stat && stat.lesson_count > 0 && stat.done >= stat.lesson_count;
    if (isComplete) {
      await query(
        "UPDATE enrollments SET completed_at = COALESCE(completed_at, NOW()) WHERE course_id=$1 AND user_id=$2",
        [req.params.id, req.user!.id]
      );
    }
    ok(res, { completed: done, courseComplete: Boolean(isComplete), doneLessons: stat?.done ?? 0 });
  })
);

// ─────────────────────── creator authoring ───────────────────────

// POST /api/courses
router.post(
  "/",
  authenticate,
  creatorRoles,
  asyncHandler(async (req: AuthedRequest, res) => {
    const b = req.body as { title?: string; description?: string; category?: string; accessLevel?: string; thumbnailUrl?: string };
    if (!b.title) throw badRequest("title required");
    const access = ["free", "premium", "ultra"].includes(b.accessLevel ?? "") ? b.accessLevel : "free";
    const { rows } = await query(
      `INSERT INTO courses (creator_id, title, slug, description, category, access_level, thumbnail_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, title, slug, is_published, access_level`,
      [req.user!.id, b.title, slugify(b.title), b.description ?? null, b.category ?? null, access, b.thumbnailUrl ?? null]
    );
    ok(res, { course: rows[0] }, 201);
  })
);

// PATCH /api/courses/:id
router.patch(
  "/:id",
  authenticate,
  creatorRoles,
  asyncHandler(async (req: AuthedRequest, res) => {
    await loadOwnedCourse(req.params.id, req);
    const b = req.body as { title?: string; description?: string; category?: string; accessLevel?: string; thumbnailUrl?: string; isPublished?: boolean };
    const { rows } = await query(
      `UPDATE courses SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         category = COALESCE($3, category),
         access_level = COALESCE($4, access_level),
         thumbnail_url = COALESCE($5, thumbnail_url),
         is_published = COALESCE($6, is_published),
         updated_at = NOW()
       WHERE id = $7
       RETURNING id, title, slug, is_published, access_level`,
      [b.title ?? null, b.description ?? null, b.category ?? null, b.accessLevel ?? null, b.thumbnailUrl ?? null, b.isPublished ?? null, req.params.id]
    );
    ok(res, { course: rows[0] });
  })
);

// POST /api/courses/:id/modules
router.post(
  "/:id/modules",
  authenticate,
  creatorRoles,
  asyncHandler(async (req: AuthedRequest, res) => {
    await loadOwnedCourse(req.params.id, req);
    const b = req.body as { title?: string; position?: number };
    if (!b.title) throw badRequest("title required");
    const { rows } = await query(
      "INSERT INTO course_modules (course_id, title, position) VALUES ($1,$2,$3) RETURNING id, title, position",
      [req.params.id, b.title, b.position ?? 0]
    );
    ok(res, { module: rows[0] }, 201);
  })
);

// POST /api/courses/:id/lessons
router.post(
  "/:id/lessons",
  authenticate,
  creatorRoles,
  asyncHandler(async (req: AuthedRequest, res) => {
    await loadOwnedCourse(req.params.id, req);
    const b = req.body as {
      moduleId?: string; title?: string; videoId?: string; content?: string;
      durationSeconds?: number; position?: number; isPreview?: boolean;
    };
    if (!b.title) throw badRequest("title required");
    const lesson = await transaction(async (c) => {
      const r = await c.query(
        `INSERT INTO lessons (course_id, module_id, title, video_id, content, duration_seconds, position, is_preview)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id, module_id, title, video_id, position, is_preview`,
        [req.params.id, b.moduleId ?? null, b.title, b.videoId ?? null, b.content ?? null, b.durationSeconds ?? null, b.position ?? 0, b.isPreview ?? false]
      );
      await c.query("UPDATE courses SET lesson_count = lesson_count + 1, updated_at = NOW() WHERE id = $1", [req.params.id]);
      return r.rows[0];
    });
    ok(res, { lesson }, 201);
  })
);

export default router;
