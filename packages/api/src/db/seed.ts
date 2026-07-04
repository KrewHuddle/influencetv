import bcrypt from "bcryptjs";
import { Pool, PoolClient } from "pg";
import { env } from "../config/env";

const HLS_1 = "https://cdn.apex.tv/seed/drama-ep1/master.m3u8";
const HLS_2 = "https://cdn.apex.tv/seed/news-brief/master.m3u8";
const THUMB = "https://cdn.apex.tv/seed/thumb-placeholder.jpg";

async function insertUser(
  c: PoolClient,
  opts: {
    email: string;
    role: string;
    plan?: string;
    displayName: string;
    username: string;
    passwordHash: string;
  }
): Promise<string> {
  const { rows } = await c.query<{ id: string }>(
    `INSERT INTO users
       (email, email_verified, password_hash, role, subscription_plan, display_name, username)
     VALUES ($1, true, $2, $3::user_role, $4::subscription_plan, $5, $6)
     ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
     RETURNING id`,
    [
      opts.email,
      opts.passwordHash,
      opts.role,
      opts.plan ?? "free",
      opts.displayName,
      opts.username,
    ]
  );
  return rows[0].id;
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: env.DATABASE_URL });

  try {
    const { rows: existing } = await pool.query<{ count: string }>(
      "SELECT COUNT(*)::int AS count FROM users WHERE role = 'super_admin'"
    );
    if (Number(existing[0].count) > 0) {
      // eslint-disable-next-line no-console
      console.log("Seed skipped — super_admin already exists.");
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const adminHash = await bcrypt.hash("Admin123!", 12);
      const userHash = await bcrypt.hash("Password1!", 12);

      // ── staff ──
      const adminId = await insertUser(client, {
        email: "admin@apex.tv",
        role: "super_admin",
        plan: "ultra",
        displayName: "Apex Admin",
        username: "apex_admin",
        passwordHash: adminHash,
      });
      await insertUser(client, {
        email: "manager@apex.tv",
        role: "channel_manager",
        displayName: "Channel Manager",
        username: "channel_manager",
        passwordHash: userHash,
      });
      await insertUser(client, {
        email: "mod@apex.tv",
        role: "moderator",
        displayName: "Moderator",
        username: "moderator",
        passwordHash: userHash,
      });

      // ── creators ──
      const creator1 = await insertUser(client, {
        email: "creator1@apex.tv",
        role: "creator",
        plan: "ultra",
        displayName: "Nova Fields",
        username: "novafields",
        passwordHash: userHash,
      });
      const creator2 = await insertUser(client, {
        email: "creator2@apex.tv",
        role: "creator",
        plan: "ultra",
        displayName: "Rex Marlow",
        username: "rexmarlow",
        passwordHash: userHash,
      });

      // ── channels ──
      const channels: Array<{ id: string; slug: string; name: string }> = [];
      for (const [name, slug, genre] of [
        ["Apex Drama", "drama", "Drama"],
        ["Apex News", "news", "News"],
        ["Apex Entertainment", "entertainment", "Entertainment"],
      ]) {
        const { rows } = await client.query<{ id: string }>(
          `INSERT INTO channels
             (name, slug, description, genre, status, created_by, stream_key)
           VALUES ($1,$2,$3,$4,'active',$5, encode(gen_random_bytes(32),'hex'))
           ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [name, slug, `${name} — 24/7 broadcast`, genre, adminId]
        );
        channels.push({ id: rows[0].id, slug, name });
      }

      // ── videos (ready) ──
      const { rows: v1 } = await client.query<{ id: string }>(
        `INSERT INTO videos
           (creator_id, title, description, type, rating, status, duration_seconds,
            hls_url, thumbnail_url, genre, published_at)
         VALUES ($1,'Drama Ep. 1','Pilot episode.','episode','TV-14','ready',3600,
                 $2,$3,'Drama', NOW())
         RETURNING id`,
        [creator1, HLS_1, THUMB]
      );
      const { rows: v2 } = await client.query<{ id: string }>(
        `INSERT INTO videos
           (creator_id, title, description, type, rating, status, duration_seconds,
            hls_url, thumbnail_url, genre, published_at)
         VALUES ($1,'Evening News Brief','Top stories.','episode','PG','ready',1800,
                 $2,$3,'News', NOW())
         RETURNING id`,
        [creator2, HLS_2, THUMB]
      );
      const videoIds = [v1[0].id, v2[0].id];

      // ── schedule (3 entries, 1/2/3h out, non-overlapping on Drama) ──
      const dramaId = channels[0].id;
      for (let i = 0; i < 3; i++) {
        await client.query(
          `INSERT INTO schedule
             (channel_id, video_id, title, start_time, end_time, created_by)
           VALUES ($1,$2,$3, NOW() + ($4 || ' hours')::interval,
                              NOW() + ($5 || ' hours')::interval, $6)`,
          [
            dramaId,
            videoIds[i % videoIds.length],
            `Scheduled block ${i + 1}`,
            (i + 1).toString(),
            (i + 2).toString(),
            adminId,
          ]
        );
      }

      // ── patron tiers (1 per creator) ──
      for (const creatorId of [creator1, creator2]) {
        await client.query(
          `INSERT INTO patron_tiers
             (creator_id, name, description, price_cents, perks, position)
           VALUES ($1,'Supporter','Early access + badge',499,
                   '["early_access","badge"]'::jsonb,1)`,
          [creatorId]
        );
      }

      // ── products (3 physical, 2 digital) approved ──
      const products: Array<[string, boolean, number]> = [
        ["Apex Tee", false, 2500],
        ["Apex Hoodie", false, 5500],
        ["Enamel Pin Set", false, 1200],
        ["Digital Wallpaper Pack", true, 500],
        ["Behind-the-Scenes PDF", true, 900],
      ];
      for (const [title, isDigital, price] of products) {
        await client.query(
          `INSERT INTO products
             (seller_id, title, description, category, is_digital,
              base_price_cents, inventory_count, status, requires_shipping, thumbnail_url)
           VALUES ($1,$2,$3,'merch',$4,$5, $6, 'approved', $7, $8)`,
          [
            creator1,
            title,
            `${title} — official Apex merch`,
            isDigital,
            price,
            isDigital ? 0 : 100,
            !isDigital,
            THUMB,
          ]
        );
      }

      // ── communities (one per channel) ──
      for (const ch of channels) {
        await client.query(
          `INSERT INTO communities (type, entity_id, name, description)
           VALUES ('channel', $1, $2, $3)`,
          [ch.id, `${ch.name} Community`, `Discuss ${ch.name}.`]
        );
      }

      await client.query("COMMIT");
      // eslint-disable-next-line no-console
      console.log("✅ Seed complete.");
      // eslint-disable-next-line no-console
      console.log("   admin@apex.tv / Admin123!  (all others: Password1!)");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Seed failed:", err);
  process.exit(1);
});
