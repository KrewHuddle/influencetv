# Influence TV — Ops / Infra Roadmap (Phase 2b + Phase 6)

Status: planning. These phases are **not code-verifiable in the dev env** — they need the real DigitalOcean servers. This doc sequences the work, names the exact files/commands, and defines done-criteria so each item can ship as its own change + verification.

Live topology today (built manually in DO, not via terraform state):

| Component | Current | Single point of failure? |
|---|---|---|
| API droplet `itvn-api` 45.55.94.10 | 1× s-2vcpu-4gb, pm2 (api/web/worker/playout) | **Yes** |
| Streaming droplet `itvn-streaming` 167.71.82.184 | 1× nginx-rtmp + ffmpeg playout | **Yes** |
| Load balancer `itvn-lb` 138.197.55.55 | :80/:443 → :3000 both droplets | LB is HA |
| Managed Postgres `itvn-postgres` pg16 | 1 node db-s-1vcpu-1gb | **Yes (no standby)** |
| Managed Redis/Valkey8 `itvn-redis` | 1 node | **Yes** |
| Spaces itvn-videos/uploads/assets + CDN | cdn.influencetvnetwork.com | Spaces = HA |
| Observability | `/health` only | No metrics/logs/alerts |

---

## Phase 2b — Broadcast reliability (streaming-env work)

Goal: linear playout survives crashes, boundaries don't dead-air, ad splice is verified on real ffmpeg, and there's a failover story.

### 2b.0 — PREREQ: restart apex-playout with current code + run droplet tests
Blocks everything. The control-plane / heartbeat / kill / ad-splice code (Phases 1b/2a) is deployed but the **running** `apex-playout` process on the streaming droplet predates it.
- Runbook already in repo: `docs/PLAYOUT-TEST.md`.
- Do: SSH/console `itvn-streaming` → `pm2 restart apex-playout` (confirm it points at latest `/root/apex`) → verify via `/api/admin/playout/status`:
  1. heartbeats appear (`playout:heartbeat:{id}` TTL30 refreshing),
  2. admin kill actually SIGTERMs ffmpeg (was no-op pre-2a),
  3. scheduled ad-break (fixture row on drama ch) splices creative + HLS discontinuity + `impressions_served` jumps by viewer_count,
  4. supervisor auto-restarts a killed engine.
- **Done when:** all 4 pass and results logged back into memory.

### 2b.1 — Mezzanine rendition (kill `-c copy` of raw uploads) — ✅ CODE BUILT (droplet-verify pending)
Problem: PlayoutEngine streamed raw user uploads with `-c copy` → codec/keyframe variance → discontinuity artifacts, and uploads bucket has **24h TTL** so source can vanish mid-playout.
- ✅ `014_mezzanine.sql` adds nullable `videos.s3_mezzanine_key`.
- ✅ `transcodeWorker.ts` step 6.5: encodes normalized 1080p H.264-High/AAC, fixed 2s GOP (`-g 48 -sc_threshold 0 +faststart`) → uploads to **assets** Space (permanent) at `mezzanine/{videoId}.mp4` → persisted on the video row.
- ✅ `PlayoutEngine.sourceFor()` prefers mezzanine (assets bucket) over raw upload (uploads bucket); `downloadVOD` is now bucket-aware; program + gap-filler + ad-filler paths all use it. `-c copy` is now safe on the normalized main path. Pre-existing videos fall back to the original until re-transcoded.
- **Tradeoff flagged:** the extra mezzanine encode adds CPU to the transcode worker (concurrency=2 on the API droplet) — reinforces the need for 6.3 (transcode scaling).
- **Not done (needs droplet ffmpeg):** re-transcode a video, confirm `mezzanine/{id}.mp4` lands in assets, schedule it linear, watch a clean boundary, and confirm playout survives past the uploads 24h TTL. Ad creatives + original fallback still `-c copy` (unnormalized) — acceptable, noted.

### 2b.2 — Seamless program boundaries
Problem: transitions rely on SIGTERM → ~1s dead-air between programs.
- Pre-buffer next program; use HLS discontinuity + concat instead of kill-and-restart ffmpeg per program.
- Wire the unused `filler_playlist_id` → curated filler playlist for gaps instead of a single filler file.
- **Done when:** back-to-back scheduled programs transition with no black frame / audio gap on the HLS output.

### 2b.3 — Streaming failover / redundancy
Problem: 1 streaming droplet = channel goes dark if it dies. Supervisor (2a) only restarts the *process*, not the *host*.
- Options (pick with user, cost tradeoff):
  - **(a) Warm standby** streaming droplet; playout state in Redis already → a second host can take over a channel on heartbeat-miss. Needs a leader/lease per channel (Redis `SET NX` lease keyed by channel, renewed by heartbeat).
  - **(b) Origin + edge** split: nginx-rtmp origin stays 1 node but front HLS with the DO CDN / multiple edge caches so viewer delivery survives origin blips (segments cached).
- **Done when:** killing the active streaming host fails a channel over to standby within N seconds (define SLO, e.g. <30s), or CDN keeps serving last segments.

### 2b.4 — Managed DB/Redis standby
- Both managed clusters are **single-node** (`node_count=1`). Redis is **doubly critical**: the entire playout control plane lives there — heartbeats (`playout:heartbeat:{id}`), kill-stream + `apex:playout:control` pub/sub, viewer counters, cart, ad-fill. Redis down = broadcast blind + control-plane dead, not just a cache miss.
- Enable DO managed Postgres **standby node** (read replica / HA) + Redis HA/eviction+persistence policy review.
- Terraform: reflect in `infrastructure/terraform/main.tf` (currently single-node) OR document as manual DO change (live infra isn't tf-managed).
- **Done when:** DB failover tested (or at minimum standby provisioned + connection string uses the HA endpoint).

---

## Phase 6 — Production-scale hardening

### 6.1 — Observability — ✅ BASELINE BUILT (this session, API package)
Implemented in `packages/api`:
- **Structured logging**: `config/logger.ts` (pino, JSON, redacts auth/cookie). `middleware/requestLogger.ts` now pino-http (was morgan) — one JSON line/request, level scales 5xx→error/4xx→warn, skips /health+/metrics. `errorHandler` + boot logs → pino.
- **Metrics**: `config/metrics.ts` (prom-client registry + default node metrics) exposed at **`GET /metrics`**. `middleware/httpMetrics.ts` records `http_request_duration_seconds` + `http_requests_total` (labels method/route-template/status — bounded cardinality). Custom series: `http_errors_total`, `socket_connections` (gauge, sockets/index.ts inc/dec), `ad_impressions_total{placement="vod"}` (ads.ts VOD serve), async gauges `transcode_queue_depth{state}` (BullMQ backpressure signal for 6.3) and `playout_channels_up` (reads shared Redis `playout:heartbeat:*` — the streaming droplet's heartbeats).
- **Deps added** (user runs install): `pino`, `pino-http`, `prom-client` (+ `pino-pretty` dev).
- **Optional env** (both have code fallbacks): `LOG_LEVEL` (default info-prod/debug-else), `METRICS_TOKEN` (if set, `/metrics` requires `Authorization: Bearer <token>`; also restrict /metrics at firewall/LB — the LB currently routes all paths to :3000).
- **Verify:** `pnpm --filter @apex/api build` (tsc clean) → boot API → `curl localhost:3000/metrics` shows the series → hit endpoints and confirm `http_requests_total` climbs → after streaming droplet has playout running, `playout_channels_up` reflects live channels.

STILL TODO in 6.1 (not built here — need infra/SaaS decisions):
- **Scrape + dashboard**: stand up Prometheus + Grafana (or DO/SaaS equivalent) to scrape `/metrics` from both droplets; build a channel-health + traffic dashboard.
- **Log shipping**: forward pm2/pino JSON logs → a sink (Loki self-host, or Better Stack/Datadog/DO log forwarding).
- **Deeper playout metrics** (need the streaming/playout process instrumented, not just the API): current program per channel, ad-fill rate, dead-air seconds, linear ad impressions. The API currently exposes `playout_channels_up` from heartbeats only.
- **Alerts**: page on `playout_channels_up` < active channels, DB/Redis conn fail, `transcode_queue_depth{state="waiting"}` backlog, `http_errors_total` spike, cert expiry.
- **Error tracking** — ✅ BASELINE BUILT: `@sentry/node` in API (`config/sentry.ts`, inits first in index.ts, captures in errorHandler + unhandledRejection/uncaughtException/boot). `@sentry/react` client in web (`lib/sentry.ts`, init from Providers). `@sentry/react-native` in firetv (`src/lib/sentry.ts`, init in App.tsx). All **no-op until DSN set** — `SENTRY_DSN` (API/firetv), `NEXT_PUBLIC_SENTRY_DSN` (web), `SENTRY_TRACES_SAMPLE_RATE` (API, default 0.1). Web uses @sentry/react (client-only, avoids @sentry/nextjs webpack/instrumentation build coupling) → server-side Next errors NOT captured; upgrade to @sentry/nextjs later if server capture needed.
- **Done when:** a dashboard shows all channels' health + a killed channel fires an alert.

### 6.2 — CDN / multi-region HLS delivery
- **Nuance:** the DO CDN currently fronts the **videos Space (VOD assets) only** — live/linear HLS manifests+segments are served **directly off the streaming droplet's nginx on HTTP :80**, no CDN, no cache headers (`nginx.conf` sets `no-cache` on `/hls/`). That droplet is the single origin for all live viewers.
- Put the DO CDN (or a real CDN) in front of `/hls`; set proper segment cache headers (short TTL on `.m3u8`, long on `.ts`).
- Consider multi-region edge if audience is geo-spread (measure first via 6.1).
- **Done when:** HLS segments served from CDN edge, origin load drops, verified via response headers / cache hit ratio.

### 6.3 — Autoscaling transcode workers — 🟡 CODE BUILT (extraction ready; droplet provisioning pending)
Problem: `transcodeWorker` ran single-process (concurrency hardcoded 2) on the API droplet, competing with the API for CPU; a burst of uploads backs up the queue.
- ✅ **Standalone entrypoint** `workers/transcode.ts` (`pnpm --filter @apex/api worker:transcode`) runs ONLY the transcode queue → deployable on a dedicated droplet/pool. BullMQ load-balances across all workers on the queue (`bullConnection`, Redis-backed) so N instances scale horizontally.
- ✅ **Env-tunable concurrency** `TRANSCODE_CONCURRENCY` (default 2) — a beefy transcode host runs more parallel ffmpeg.
- ✅ **Zero-downtime flag** `RUN_TRANSCODE_IN_MAIN_WORKER=false` on the API host stops it transcoding once the dedicated droplet is live (default true → current single-host setup unchanged).
- ✅ **Graceful drain** on SIGTERM (`worker.close()` finishes in-flight jobs) + **worker `/health`+`/metrics`** HTTP via `WORKER_METRICS_PORT` (reuses the prom registry — `transcode_queue_depth` is the autoscale signal).
- **Deploy runbook (ops, needs a new droplet):**
  1. Provision a CPU-optimized droplet; install Node 20 + **ffmpeg** + clone repo; `pnpm install`; build `@apex/shared`+`@apex/api`.
  2. `.env` = same DB/Redis/Spaces creds as API host + `TRANSCODE_CONCURRENCY=<cores>` + optional `WORKER_METRICS_PORT=9101`.
  3. **Add the new droplet's private IP to the managed Postgres + Redis trusted sources** (firewall currently allows the API droplet only — else the worker can't reach the DB/queue).
  4. pm2 start `worker:transcode` (pm2 save + systemd), point Prometheus at `:9101/metrics`.
  5. On the API host: set `RUN_TRANSCODE_IN_MAIN_WORKER=false`, `pm2 restart apex-worker`.
- **Still TODO:** true autoscaling (spin instances on `transcode_queue_depth`); this delivers the extraction + horizontal-scale primitive, not the autoscaler.
- **Done when:** transcode runs off the API host and N uploads process in parallel without starving the API.

### 6.4 — Production moderation service — 🟡 PARTIAL (product images now wired)
Current: `services/moderation.ts` nsfwjs runs on VOD thumbnails (`transcodeWorker.ts`, 0.6 threshold, Porn/Hentai/Sexy) AND the new mezzanine path. `textModeration.ts` (banned-term regex + ≤3-link limit) wired into community posts/comments.
- ✅ **Product images NSFW-scanned** (this session): `isRemoteImageNSFW(url)` fetches + scans; wired into `shop.ts` product **create** + **PATCH** (scans first 5 images). Flagged → auto-`rejected` + `rejection_reason`; unscannable (bad format/host/fetch) → falls through to manual `pending` (non-blocking). **SSRF guard**: only fetches allowlisted CDN/Spaces hosts, `redirect:"error"`, 8s timeout, 15MB + `image/*` content-type cap.
- **Live-stream** has zero moderation (no ingest-keyframe inspection, no audio).
- ✅ **Text moderation ML upgrade** (this session): `services/aiModeration.ts` classifies posts/comments with Claude (`@anthropic-ai/sdk`, structured-output json_schema → `{flagged, categories, reason}`, model `claude-opus-4-8` default, `MODERATION_MODEL` override e.g. `claude-haiku-4-5`). Layered as a 2nd pass in `moderateContent()` behind the fast banned-term filter; wired into community post+comment create. **No-op unless `ANTHROPIC_API_KEY` set**; fail-open on API error (banned-list verdict stands); model refusal → conservatively flagged. Still TODO: a review-queue UI for flagged content + applying it to other UGC surfaces.
- No CSAM/automated-DMCA detection.
- Add a review queue UI for flagged content (admin already has product moderation tabs — extend).
- **Done when:** uploaded NSFW image is auto-flagged; abusive comment is caught above the current banned-list baseline.

### 6.5 — Security review + load/failover test
- `semgrep --config=auto` full pass, `osv-scanner -r .`, dependency bumps (multer 1.x→2.x noted, deprecated).
- Rotate seeded admin pw `admin@influencetvnetwork.com/Admin123!` (still default — do NOW, it's live).
- Confirm `PasswordAuthentication no` on droplets (SSH:22 stays open key-only for GH Actions deploy — decided).
- Load test: linear channel at target concurrency + VOD + checkout; verify ad impressions × viewers holds under load.
- **Done when:** clean security scan, admin pw rotated, load test meets SLO.

---

## Sequencing recommendation

1. **2b.0** (restart + droplet tests) — unblocks everything, zero new code, highest value.
2. **6.5 quick wins** — rotate admin pw, PasswordAuthentication check (minutes, live-security).
3. **6.1 observability** — needed to safely do the rest.
4. **2b.1 mezzanine + 2b.2 boundaries** — makes linear broadcast-grade.
5. **6.3 transcode scaling + 6.2 CDN** — scale delivery.
6. **2b.3 / 2b.4 failover** — redundancy (cost decision with user).
7. **6.4 moderation upgrade**, **6.5 load test** — pre-launch gates.

## Notes
- Live infra was built manually; `infrastructure/terraform/` is **reference IaC with no state**. Any infra change is either a manual DO console/doctl action OR a terraform import-then-apply exercise (bigger project). Decide per item.
- Tooling ready: terraform 1.15.7, doctl authed (trburns@krewhuddle.com), gh authed (KrewHuddle).
- Per no-pnpm-install-runs: I write files; user runs install/migrate/build/deploy + all droplet/DO actions.
