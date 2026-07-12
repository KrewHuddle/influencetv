# Influence TV Network — Scheduling & Playout Gap Report

Read-only audit of `apex/` linear-channel scheduling + playout, 2026-07-12.
Companion doc: [playout-feature-reference.md](playout-feature-reference.md) — the category feature map this is scored against.

**Stack facts** (corrections to common assumptions):
- Influence TV lives in `apex/`; **raw `pg` (node-postgres), not Drizzle**. Express + TypeScript, Next.js web.
- `tapestry/` has **zero linear-TV code** — unrelated app.
- An OTT app already exists: **Fire TV React Native app at `packages/firetv/`**.
- Stripe Connect confirmed active (destination charges, `users.stripe_account_id`, `payouts`).

## 1. Checklist summary

| Feature | Status | Evidence |
|---|---|---|
| **Ingest & assets** | | |
| Bulk upload | PARTIAL | Single-video multipart ≤50GB + presigned flow (`api/src/routes/uploads.ts`); no bulk importer |
| Transcode/normalization | **BUILT** | BullMQ worker, 4-rung HLS ladder (1080/720/480/360) + 1080p fixed-GOP mezzanine (`workers/transcodeWorker.ts`) |
| MRSS/API ingest | MISSING | `youtube_embeds` table exists, no ingest UI/feed |
| Metadata tagging | **BUILT** | genre, tags[] (20), type, rating enums (`migrations/005_content.sql`) |
| **Scheduling** | | |
| Drag-drop grid | MISSING | Form + list only (`admin/schedule/page.tsx`) |
| Calendar view | PARTIAL | Per-day list w/ date picker, no week grid |
| Dayparting / repeating blocks | MISSING | No recurrence rules anywhere |
| Loop channels | PARTIAL | Auto-fill `loop` mode materializes rows (500 max, 7-day window) — not a true loop channel (`routes/schedule.ts:103`) |
| Smart playlists | MISSING | Manual video checklist in auto-fill only |
| TZ-correct now-playing | **BUILT** | All TIMESTAMPTZ, `NOW()` resolution, Redis-cached (`schedule.ts:267`); single-TZ network, no per-channel tz |
| **Filler & continuity** | | |
| Auto gap-fill | **BUILT** | Random ready video when gap >30s, 5-min cap (`PlayoutEngine.ts:142`) |
| No-dead-air guarantee | PARTIAL | Gaps <30s = 2s-sleep loop (dead air); filler is *random* content (could be premium/wrong-genre); `channels.filler_playlist_id` exists but **unused** |
| Overlap validation | **BUILT** | Postgres GIST exclusion constraint `tstzrange &&` per channel — DB-enforced (`006_channels.sql`) |
| **Output** | | |
| HLS | **BUILT** | nginx-rtmp → `/var/www/hls/{slug}` → DO Spaces CDN |
| DASH | MISSING | HLS only |
| ABR ladder | PARTIAL | VOD: 4 rungs. **Linear playout: single 2000k baseline-profile rendition** (`streaming/nginx.conf` vod app) — master.m3u8 advertises 3 variants that don't exist for playout channels |
| SRT / outbound RTMP push | MISSING | RTMP ingest only |
| Low-latency | MISSING | No LL-HLS (fine for linear) |
| **Ads/monetization** | | |
| SCTE-35 cues | MISSING | Code comment: "later production upgrade" (`PlayoutEngine.ts:190`) |
| SSAI | MISSING | Ads broadcast-spliced for all viewers (working, crude); no per-viewer insertion |
| Ad-break scheduling | **BUILT** | `is_ad_break` items, periodic breaks in auto-fill, AdDecisionEngine pacing (least-served-first), budget/flight/impression caps, immutable `ad_impressions` ledger + `/api/ads/report` |
| **Branding/graphics** | | |
| Channel bug / lower-thirds / slates / blackout | MISSING | Zero ffmpeg overlay filters; no slate asset. (App-layer ProductOverlay/HaggleOverlay are web-only, not in stream) |
| **Multi-channel** | | |
| N channels parallel | **BUILT** | One PlayoutEngine per channel, all started on boot (`PlayoutManager.ts`) |
| Per-channel config | PARTIAL | genre/premium/stream keys; no per-channel filler, tz, or ladder |
| **Distribution** | | |
| Own apps | **BUILT** | Next.js web + **Fire TV RN app** (`packages/firetv/`) |
| YouTube/Facebook simulcast | MISSING | No outbound push |
| OTT/CTV | PARTIAL | Fire TV only; no Roku/Samsung/LG |
| FAST syndication | MISSING | No XMLTV, no MRSS, no SCTE-35 |
| **Reliability** | | |
| Monitoring | **BUILT** | Prometheus `/metrics` + `playout_channels_up`, 10s heartbeats (Redis TTL 30s), Sentry |
| Alerting | PARTIAL | Metrics exist; no alert pipeline wired |
| Failover/redundancy | MISSING | Single streaming droplet = SPOF; supervisor self-heals engines (15s), not the host |
| Playout-vs-schedule verification | PARTIAL | Heartbeat carries `itemId`; no as-run log |
| **Analytics** | | |
| Per-channel/content viewership | PARTIAL | Socket-presence `viewer_count` (snapshot), `videos.view_count`; no watch-time, no time series |
| Device/geo | MISSING | Nothing |
| **Security** | | |
| DRM | MISSING | Likely N/A (creator content) |
| Geo-blocking | MISSING | Nothing |
| Premium access control | PARTIAL | `channels.requires_premium` is **UI-only — HLS path fully public** (public-read ACL, CORS *, no tokens) |
| **EPG** | | |
| Exportable EPG | PARTIAL | JSON guide, 12h hardcoded lookahead (`channels.ts:66`), consumer grid on `/live`; no XMLTV, no 7-day horizon |

## 2. What's solid

- **Schedule integrity at the DB layer**: GIST exclusion constraint makes double-booking impossible.
- **Playout supervision chain**: heartbeat → supervisor auto-restart → pm2 → `playout_channels_up` gauge.
- **Mezzanine discipline**: fixed-GOP 1080p normalized asset per video, preferred by playout.
- **Ad plumbing end-to-end**: eligibility → pacing → break fill → impression ledger → revenue report.
- **Auto-fill scheduler**: loop/shuffle/periodic-ad-break bulk placement, collision-aware.
- **Own-app distribution**: web player w/ tune-in sync + Fire TV app.

## 3. Critical gaps (block reliable 24/7 regardless of path)

1. **Single-droplet SPOF, no alerting pipeline.** Every channel dies with one host; nothing pages you.
2. **Filler is random** — any `ready` video, incl. premium/patron/tonal mismatch. `filler_playlist_id` never read.
3. **No slate.** Failure mode = frozen/empty HLS window. (Slate must be a looping MP4 so segments keep advancing.)
4. **Sub-30s gaps are literal dead air** (2s poll loop pushes nothing).
5. **Linear output = single 2000k baseline rendition** + phantom master-playlist variants.
6. **No as-run log** — can't prove what aired (ad billing, FAST compliance).

## 4. Distribution gaps (FAST path)

In order: (1) SCTE-35 cues — biggest blocker, no cues = no carriage; (2) XMLTV/JSON EPG w/ 7–14 day horizon (requires recurrence to actually schedule that far); (3) redundant monitored origin; (4) proper linear ABR ladder; (5) syndication partner (Amagi/Wurl/Frequency; Roku has self-serve). **Own-app path blocked by none of these.**

## 5. Monetization gaps

- Own-app linear: monetized today (broadcast splice + ledger). Impressions = concurrent-viewer snapshot, not verified views — won't pass external ad-network audit.
- No SSAI → no per-viewer targeting/frequency caps, no programmatic demand.
- No SCTE-35 → third parties can't monetize the feed.
- VOD: preroll+midroll works; house campaigns only (no VAST).

## 6. Build vs buy (solo/bootstrapped)

| Gap | Call | Rationale |
|---|---|---|
| Scheduler UX (calendar/drag-drop, recurrence) | **BUILD** | Pure frontend over existing APIs |
| Filler playlists + slate | **BUILD** | Schema column exists; slate = looping MP4 + fallback branch |
| Alerting | **BUILD (glue)** | Grafana Cloud/UptimeRobot on metrics + synthetic manifest checks (verify segments advance, not just HTTP 200) |
| Linear ABR ladder | **BUILD** | nginx vod-app ladder or pre-ladder at mezzanine; budget droplet CPU |
| Redundancy | **BUILD lite now, BUY later** | Second droplet + health-checked DNS; multi-region = vendor territory |
| Channel bug | **BUILD** | Burn at mezzanine (zero playout CPU); stream-baked per-channel bug needs playout re-encode |
| XMLTV/MRSS export | **BUILD** | Thin serializers, ~day each |
| SCTE-35 | **BUY/DEFER** | Only for FAST; via playout service (Veset/FastPix) or distributor (Amagi/Wurl) |
| SSAI | **BUY** | AWS MediaTailor or distributor-bundled; never build solo |
| Watch-time analytics | **BUILD lite** | Player heartbeat → table → series (Mux Data = buy option) |
| DASH/DRM/geo | **SKIP** | HLS accepted everywhere; creator content needs no DRM |

## 7. Punch list

**P0 — trustworthy 24/7 channel (own-app path)**
| Item | Effort |
|---|---|
| Wire `filler_playlist_id`: curated per-channel filler, exclude premium/patron from `pickFiller()` | S |
| Looping slate MP4 for <30s gaps + no-filler failures (kill dead-air sleep loop) | S |
| Alerting: synthetic manifest check per channel (segments advancing) + alarm on `playout_channels_up` drop | S |
| Real 3-rung linear ABR, main profile, honest master manifest | M |
| Decide premium enforcement: signed/tokenized HLS (breaks CDN caching) vs accept UI-only gating | M (if enforced) |

**P1 — operator QoL + monetization depth**
| Item | Effort |
|---|---|
| Calendar/drag-drop schedule UI + PATCH reorder | M |
| Recurrence/dayparting + true loop channels (pointer wraps, no 500-row cap) | M |
| As-run log | S |
| Watch-time heartbeats + historical viewership | M |
| Channel bug burned at mezzanine; per-channel branding config | S–M |
| EPG horizon 7–14 days + XMLTV export | S |
| Smart playlists (saved genre/tag filters → auto-fill) | S |
| Frequency caps / asset-usage view | S |
| Watch-folder/S3 bulk ingest | S |

**P2 — FAST readiness (start when a distribution conversation is live)**
| Item | Effort |
|---|---|
| SCTE-35 cue insertion (via playout service or distributor) | L (buy) |
| SSAI (MediaTailor or distributor-bundled) | M–L |
| Origin redundancy w/ failover | M–L |
| MRSS export; syndication partner integration | M |
| Roku self-serve channel app | M |

## Open questions (gate any code)

1. **Which path is first money** — embedded channels in own apps, or FAST carriage (pulls SCTE-35/redundancy/EPG-export forward)?
2. **Premium linear**: stream-level enforcement (signed HLS, breaks CDN cacheability) or app-level gating with tolerated leakage?
3. **Scale + uptime target**: channel count in 12 months + tolerated downtime (decides droplet sizing for ABR re-encode, second origin timing, DIY-vs-service)?
