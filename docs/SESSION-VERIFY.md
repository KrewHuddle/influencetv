# Session Verification + Deploy Checklist

Covers everything built this session (all files-only, **not committed**): 6.1 observability, Sentry, 2b.1 mezzanine, 6.3 transcode extraction, 6.4 product-image NSFW, 6.4 text-moderation ML. Per the write-only workflow, **you** run install / typecheck / build / migrate / deploy.

Run top to bottom. Steps are grouped: **A** local build gate → **B** security scans → **C** migration → **D** local smoke → **E** deploy → **F** activation (optional keys) → **G** droplet-only tests still pending.

---

## New dependencies (installed by `pnpm install`)

| Package | pkg | Purpose |
|---|---|---|
| `pino`, `pino-http`, `prom-client` | api | structured logs + `/metrics` |
| `pino-pretty` (dev) | api | pretty dev logs (`pnpm dev \| pino-pretty`) |
| `@sentry/node` | api | error tracking |
| `@anthropic-ai/sdk` | api | text-moderation classifier |
| `@sentry/react` | web | client error tracking |
| `@sentry/react-native` | firetv | RN error tracking |

## New migration
- `packages/api/src/db/migrations/014_mezzanine.sql` — adds nullable `videos.s3_mezzanine_key`.

## New env vars — all optional, all have code fallbacks (features stay inert until set)

| Var | Where | Effect |
|---|---|---|
| `LOG_LEVEL` | api | pino level (default info-prod/debug-else) |
| `METRICS_TOKEN` | api | if set, `/metrics` requires `Authorization: Bearer <token>` |
| `SENTRY_DSN` | api, firetv | enables Sentry |
| `SENTRY_TRACES_SAMPLE_RATE` | api | default 0.1 |
| `NEXT_PUBLIC_SENTRY_DSN` | web | enables web Sentry (build-time inlined) |
| `TRANSCODE_CONCURRENCY` | worker | parallel ffmpeg jobs (default 2) |
| `RUN_TRANSCODE_IN_MAIN_WORKER` | api host | set `false` once a dedicated transcode droplet runs |
| `WORKER_METRICS_PORT` | worker | exposes worker `/health`+`/metrics` |
| `ANTHROPIC_API_KEY` | api | **activates** AI text moderation |
| `MODERATION_MODEL` | api | override classifier model (e.g. `claude-haiku-4-5`) |

---

## A — Local build gate

```sh
cd ~/Documents/Mogulcom-Apps/apex
pnpm install
pnpm --filter @apex/shared build
pnpm --filter @apex/api build        # tsc 0 errors expected
pnpm --filter @apex/web build        # 30+ routes, 0 errors
pnpm --filter @apex/firetv lint      # tsc --noEmit (RN not compiled)
pnpm --filter @apex/api test         # jest 6/6
```

**Watch items (can't compile here — verify at this step):**
1. `aiModeration.ts` uses `output_config: { format: { type:"json_schema", schema } }` on `messages.create`. If tsc rejects it, switch to `client.messages.parse` + `zodOutputFormat` (zod already a dep). See `docs` note in memory.
2. prom-client async gauges use closure-assigned `.collect` (already applied to dodge `noImplicitThis`).
3. `@sentry/*` version pins resolve (`@sentry/node ^8.47`, `@sentry/react ^8.47`, `@sentry/react-native ^6.5`, `@anthropic-ai/sdk ^0.72`) — bump if the registry rejects.

## B — Security scans (per global rules: money + user-input + fetch/SSRF code)

```sh
semgrep --config=auto \
  packages/api/src/routes/ads.ts \
  packages/api/src/routes/shop.ts \
  packages/api/src/services/moderation.ts \
  packages/api/src/services/aiModeration.ts
osv-scanner -r .            # after new deps; report high/critical
```
The `fetch(userUrl)` in `moderation.ts` may flag — the CDN/Spaces host-allowlist above it is the intentional SSRF mitigation.

## C — Migration (live managed Postgres)

```sh
pnpm --filter @apex/api db:migrate   # applies 014_mezzanine (idempotent)
```
Auto-migrate also runs on deploy, so this is optional pre-check.

## D — Local smoke (boot API against Docker pg/valkey :5433/:6380)

```sh
# /metrics served, series present:
curl -s localhost:3000/metrics | grep -E 'http_requests_total|transcode_queue_depth|playout_channels_up'
# structured JSON logs on requests (pino), /health + /metrics skipped from logs
# standalone transcode worker boots + drains on Ctrl-C:
pnpm --filter @apex/api worker:transcode
```

---

## E — Deploy (push to main → GH Actions auto-deploy)

Auto-deploy is green. Merge/push runs test → deploy-api → deploy-streaming, and auto-migrate. After deploy:
```sh
curl -s https://influencetvnetwork.com/health           # {status:ok,...}
curl -s https://influencetvnetwork.com/metrics | head    # if METRICS_TOKEN unset
```

## F — Activation (optional — set keys on droplet `.env`, then redeploy/restart)

- **Sentry:** set `SENTRY_DSN` (api) in `/root/apex/.env`; `gh secret set NEXT_PUBLIC_SENTRY_DSN` for web (build-time). `pm2 restart apex-api` + rerun deploy for web.
- **AI text moderation:** add `ANTHROPIC_API_KEY` (+ optional `MODERATION_MODEL=claude-haiku-4-5`) to `/root/apex/.env`; `pm2 restart apex-api apex-worker`. Then test a subtly-toxic post → expect `400 CONTENT_REJECTED`.
- **Transcode extraction (6.3 full):** provision a CPU-opt droplet (Node20 + ffmpeg + repo + build), `.env` w/ same DB/Redis/Spaces creds + `TRANSCODE_CONCURRENCY=<cores>` + `WORKER_METRICS_PORT=9101`; **add its IP to managed pg + redis trusted sources**; pm2 `worker:transcode`; then set `RUN_TRANSCODE_IN_MAIN_WORKER=false` on the API host + `pm2 restart apex-worker`. Point Prometheus at `:9101/metrics`.
- **Observability stack:** stand up Prometheus + Grafana (scrape `/metrics` on api LB + worker droplet) — no code change, ops task.

## G — Droplet-only tests still pending (need `apex-playout` restarted with current code)

Runbook: `docs/PLAYOUT-TEST.md`. On `itvn-streaming`: `pm2 restart apex-playout`, then verify via `/api/admin/playout/status`:
1. heartbeats appear, 2. admin kill actually SIGTERMs ffmpeg, 3. scheduled ad-break splices creative + HLS discontinuity + impressions jump by viewer_count, 4. supervisor auto-restarts.
Plus **2b.1 mezzanine**: re-transcode a video → confirm `mezzanine/{id}.mp4` in assets Space → schedule linear → clean boundary → survives uploads 24h TTL.

---

## Prod fixtures (left in place for testing)
Acme ad campaign `cb457764`, ad-break row on drama channel, course `9e35b447` (camera-basics-101-2mqz), Influence Tee tagged on seed video `5d325edc` @30s. Seed admin: `admin@influencetvnetwork.com` / `Admin123!` (rotate — still default).
