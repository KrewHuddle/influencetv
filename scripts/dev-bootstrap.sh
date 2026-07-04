#!/usr/bin/env bash
# Local dev bootstrap: start infra containers, install deps, migrate + seed DB.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "▶ Starting Docker services (postgres, valkey, localstack)…"
docker-compose up -d

echo "▶ Installing workspace dependencies…"
pnpm install

echo "▶ Waiting for Postgres…"
until docker exec apex-postgres pg_isready -U apex -d apex_dev >/dev/null 2>&1; do
  sleep 1
done

echo "▶ Running migrations + seed…"
pnpm --filter @apex/api db:reset || echo "  (migrations land in Prompt 02)"

echo "✅ Dev environment ready. Run 'pnpm dev' to start API + web."
