/**
 * Idempotent enrichment so the Creator Hub (/creator/[username]) shows real
 * data across every pillar for a seeded creator (novafields).
 *
 * The base seed (db/seed.ts) already gives novafields videos, products, and a
 * patron tier, but channels were owned by the admin and courses didn't exist
 * yet. This script:
 *   1. reassigns the Drama channel to novafields  → lights up Channels + the
 *      channel-linked Community in the hub
 *   2. publishes a course with a module + lessons → lights up Learn
 *
 * Safe to run repeatedly. Run on a host that can reach the prod DB:
 *   pnpm --filter @apex/api exec tsx src/scripts/seedCreatorHub.ts
 */
import { query, transaction } from "../config/database";

const CREATOR_EMAIL = "creator1@influencetvnetwork.com"; // username: novafields
const CHANNEL_SLUG = "drama";
const COURSE_SLUG = "camera-confidence-101";

async function main() {
  const { rows } = await query<{ id: string; username: string }>(
    "SELECT id, username FROM users WHERE email = $1",
    [CREATOR_EMAIL]
  );
  const creator = rows[0];
  if (!creator) {
    throw new Error(
      `Creator ${CREATOR_EMAIL} not found — run db/seed.ts first.`
    );
  }
  const cid = creator.id;

  await transaction(async (c) => {
    // 1. give the creator a channel so hub.channels + hub.community populate
    const ch = await c.query<{ id: string }>(
      `UPDATE channels SET created_by = $1 WHERE slug = $2 RETURNING id`,
      [cid, CHANNEL_SLUG]
    );
    if (!ch.rows[0]) {
      throw new Error(`Channel '${CHANNEL_SLUG}' not found.`);
    }

    // 2. published course (idempotent by unique slug)
    const course = await c.query<{ id: string }>(
      `INSERT INTO courses
         (creator_id, title, slug, description, category, access_level, is_published)
       VALUES ($1, 'Camera Confidence 101', $2,
               'Own the lens: framing, presence, and on-camera energy for creators.',
               'education', 'free', true)
       ON CONFLICT (slug) DO UPDATE
         SET creator_id = EXCLUDED.creator_id, is_published = true
       RETURNING id`,
      [cid, COURSE_SLUG]
    );
    const courseId = course.rows[0].id;

    // module (idempotent by course_id + title)
    const modTitle = "Getting Started";
    let mod = (
      await c.query<{ id: string }>(
        "SELECT id FROM course_modules WHERE course_id = $1 AND title = $2",
        [courseId, modTitle]
      )
    ).rows[0];
    if (!mod) {
      mod = (
        await c.query<{ id: string }>(
          "INSERT INTO course_modules (course_id, title, position) VALUES ($1, $2, 0) RETURNING id",
          [courseId, modTitle]
        )
      ).rows[0];
    }

    // lessons (idempotent by course_id + title)
    const lessons: Array<[string, string, boolean]> = [
      ["Meet the Lens", "Why the camera changes how you show up — and how to relax into it.", true],
      ["Framing & Light", "Simple rules for flattering framing and soft, even light.", false],
      ["On-Camera Energy", "Match your energy to the format so you read as present, not stiff.", false],
    ];
    for (let i = 0; i < lessons.length; i++) {
      const [title, content, preview] = lessons[i];
      const exists = (
        await c.query(
          "SELECT 1 FROM lessons WHERE course_id = $1 AND title = $2",
          [courseId, title]
        )
      ).rows[0];
      if (!exists) {
        await c.query(
          `INSERT INTO lessons
             (course_id, module_id, title, content, duration_seconds, position, is_preview)
           VALUES ($1, $2, $3, $4, 300, $5, $6)`,
          [courseId, mod.id, title, content, i, preview]
        );
      }
    }

    // keep lesson_count in sync
    await c.query(
      `UPDATE courses SET lesson_count =
         (SELECT COUNT(*) FROM lessons WHERE course_id = $1) WHERE id = $1`,
      [courseId]
    );
  });

  // eslint-disable-next-line no-console
  console.log(
    `✅ Enriched hub for @${creator.username}: reassigned '${CHANNEL_SLUG}' channel + published '${COURSE_SLUG}'.`
  );
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("❌ seedCreatorHub failed:", err);
  process.exit(1);
});
