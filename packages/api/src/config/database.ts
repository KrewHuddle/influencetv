import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import { env } from "./env";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  min: 2,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("Unexpected PG pool error:", err);
});

const SLOW_QUERY_MS = 1000;

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const res = await pool.query<T>(text, params as never[]);
  const duration = Date.now() - start;
  if (duration > SLOW_QUERY_MS) {
    // eslint-disable-next-line no-console
    console.warn(`[slow query ${duration}ms] ${text.slice(0, 120)}`);
  }
  return res;
}

export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function assertDbConnection(): Promise<void> {
  try {
    await pool.query("SELECT 1");
    // eslint-disable-next-line no-console
    console.log("✅ PostgreSQL connected");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("❌ Cannot connect to PostgreSQL:", err);
    process.exit(1);
  }
}

export async function isDbConnected(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
