import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { Pool } from "pg";
import { env } from "../config/env";

const MIGRATIONS_DIR = join(__dirname, "migrations");

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function appliedSet(pool: Pool): Promise<Set<string>> {
  const { rows } = await pool.query<{ filename: string }>(
    "SELECT filename FROM _migrations"
  );
  return new Set(rows.map((r) => r.filename));
}

async function reset(pool: Pool): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("⚠️  Resetting schema (DROP SCHEMA public CASCADE)…");
  await pool.query("DROP SCHEMA IF EXISTS public CASCADE");
  await pool.query("CREATE SCHEMA public");
  await pool.query("GRANT ALL ON SCHEMA public TO public");
}

async function main(): Promise<void> {
  const shouldReset = process.argv.includes("--reset");
  const pool = new Pool({ connectionString: env.DATABASE_URL });

  try {
    if (shouldReset) {
      await reset(pool);
      // eslint-disable-next-line no-console
      console.log("✅ Reset complete.");
      return;
    }

    await ensureMigrationsTable(pool);
    const done = await appliedSet(pool);

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    let ran = 0;
    for (const file of files) {
      if (done.has(file)) continue;
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(
          "INSERT INTO _migrations (filename) VALUES ($1)",
          [file]
        );
        await client.query("COMMIT");
        ran++;
        // eslint-disable-next-line no-console
        console.log(`✅ ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        // eslint-disable-next-line no-console
        console.error(`❌ ${file} failed — rolled back.`);
        console.error(err);
        process.exit(1);
      } finally {
        client.release();
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      ran === 0 ? "Nothing to migrate — up to date." : `Applied ${ran} migration(s).`
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Migration runner crashed:", err);
  process.exit(1);
});
