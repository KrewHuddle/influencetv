# Cloud Playout & Scheduling Software — Complete Feature Reference

A module-by-module map of everything the category leaders (Amagi, Veset, FastPix, Muvi, Noisypeak, Viloud, plus the broadcast incumbents) ship. For each feature area: **what it is**, **how the UX/UI works**, and **how it functions** under the hood. Where useful, a short *Build note* ties it back to Influence TV's `apex/` stack (Node/Express, raw `pg`, nginx-rtmp → DO Spaces, one `PlayoutEngine` per channel).

> Companion doc: [playout-gap-report.md](playout-gap-report.md) — the audited state of this repo scored against this reference (2026-07-12).

---

## 0. How the category is architected

Every serious playout product is really four layers plus cross-cutting services. Amagi literally sells them as separate products; smaller tools bundle them into one UI. Understanding the seams is what lets you build some layers and buy others.

| Layer | Amagi's name | What it owns |
|---|---|---|
| 1. Ingest & asset management | (MAM) | Getting content in, normalizing it, tagging it |
| 2. Scheduling & planning | PLANNER | Turning a library into a program grid / EPG |
| 3. Playout engine | CLOUDPORT | Resolving "what plays now," muxing the linear signal, graphics |
| 4. Distribution & monetization | THUNDERSTORM + delivery | Ad insertion, packaging, pushing to platforms |

Cross-cutting the whole stack: **EPG**, **analytics**, **reliability/QC**, **access control**, and the **admin/API surface**.

The mental model for the linear signal: a *scheduler* produces a time-ordered playlist → a *playout engine* reads the playlist against a wall clock and emits a continuous A/V stream (with graphics burned in and ad cues signaled) → a *packager* segments that into ABR renditions → a *CDN* delivers it → optionally an *SSAI* service stitches personalized ads at the edge.

---

## 1. Content ingest & asset management (MAM)

### 1.1 Bulk & automated ingest
**What it is:** Getting large volumes of video in without hand-uploading one file at a time.

**UX/UI:** A drop zone plus a *watch-folder* / connector panel. Operators point the system at an S3 bucket, FTP/SFTP, an MRSS feed URL, or a Google Drive/Dropbox folder, and assets flow in automatically. Leaders show an ingest queue with per-file status (received → transcoding → QC → ready), thumbnails generated on arrival, and error badges on rejects. Drag-and-drop of many files at once is table stakes; Easy On Air lets you drag straight from the OS file browser into a playlist.

**How it functions:** A poller or webhook detects new files, drops a job on a queue, a transcode worker normalizes each asset, a QC pass validates it, and metadata is written to the catalog. MRSS/API ingest parses an XML/JSON feed on a schedule and pulls new items by GUID so nothing is ingested twice.

*Build note (apex):* You have single-file multipart ≤50GB + BullMQ transcode. The gap is a **bulk importer** and **MRSS ingest** — a poller that reads a feed, dedupes by GUID, and enqueues existing transcode jobs. Small serializer + worker, reuses everything you have.

### 1.2 Transcode & normalization
**What it is:** Converting arbitrary source files into a consistent, playout-friendly mezzanine plus delivery renditions.

**UX/UI:** Mostly invisible — a progress bar and a "ready" state. Advanced tools expose per-channel encoding profiles (resolution, codec, GOP, audio loudness target) in settings.

**How it functions:** Two-stage. First a *mezzanine* — one normalized master per asset with fixed GOP, constant frame rate, standardized audio loudness (EBU R128 / -23 LUFS), consistent color/scan. Fixed GOP matters because it lets the playout engine cut between items on clean boundaries without re-encoding. Second, an *ABR ladder* — multiple bitrate/resolution rungs for adaptive delivery.

*Build note (apex):* Your 4-rung VOD ladder + fixed-GOP 1080p mezzanine is exactly right and is the expensive part vendors charge for. The problem is on the *linear* side — playout emits a single 2000k baseline rendition while the master playlist advertises phantom variants. Fixing that is the ABR task in your P0.

### 1.3 Metadata, catalog & rights
**What it is:** The searchable database of everything, plus the rules governing what can air when.

**UX/UI:** A library grid with filters (genre, type, rating, tags, duration), search, and per-asset detail panels. Rights management shows *availability windows* (this film can only air Jun 1–Aug 31) and *territory* restrictions, and the scheduler throws a warning if you try to place an asset outside its window. Amagi PLANNER surfaces this as an automated warning system to avoid rights violations.

**How it functions:** A relational catalog with assets, tags, ratings, and a rights table keyed by asset → window (start/end) → territory. The scheduler validates placements against rights at insert time.

*Build note (apex):* You have `genre`, `tags[]`, `type`, `rating`. Rights windows are absent — worth adding only if you license third-party content; for creator-owned content it's N/A.

---

## 2. Scheduling & programming (the PLANNER layer)

This is the richest UX surface in the whole category and where most of the "wow" lives. It's also almost entirely frontend-over-APIs, which makes it the highest-ROI thing to build in-house.

### 2.1 The schedule grid / timeline
**What it is:** The visual canvas where a day (or week) of programming is assembled.

**UX/UI:** Two dominant paradigms, and good tools offer both:
- **Calendar/timeline view** — a vertical or horizontal time axis (like Google Calendar for your channel). Assets are blocks sized proportional to their duration; you drag them into slots, and they snap to the item before them. FastPix describes it as "scroll through your schedule across days and weeks."
- **Playlist/rundown view** — a spreadsheet-like ordered list with columns for start time, title, duration, type, and ad-break flags. Better for precision and bulk edits.

Core interactions users expect: drag-to-reorder, drag-an-edge-to-trim, click-to-insert, multi-select, copy/paste a block or a whole day, and a "now line" showing the wall-clock position against the grid. Gaps render as visible empty space (often red); overlaps are blocked or flagged. A running total shows whether the day is under- or over-filled versus 24 hours.

**How it functions:** The grid is a view over schedule rows (`channel_id`, `asset_id`, `start`, `end`, `type`, `is_ad_break`). Durations come from asset metadata. Drag operations recompute start/end for the moved item and cascade downstream items. The critical invariant is *no overlaps* — the best tools enforce it at the database layer, not just the UI.

*Build note (apex):* You have a form + per-day list, and — better than most — a **Postgres GIST exclusion constraint** that makes double-booking physically impossible. That's a stronger foundation than the vendor UIs sit on. The missing piece is purely the **drag-drop calendar frontend** + a PATCH endpoint to reorder. This is a BUILD, never a buy — a vendor would replace your whole stack just to hand you a nicer grid.

### 2.2 Rule-based / pattern scheduling
**What it is:** Scheduling a whole series or week in a few clicks instead of placing episodes one at a time. This is the feature that separates real broadcast tools from toy schedulers.

**UX/UI:** A rules dialog with fields like Amagi's:
- **Programs/Day** — how many episodes to place per day
- **Schedule Pattern** — daily / weekly / weekends-only / monthly / custom
- **Scheduling Date** — start and (optional) end of the run

Set "one episode daily at 9pm" and the system fills that slot across the whole series automatically. Two axes matter: **horizontal** scheduling (the same slot across many days) and **vertical** / binge scheduling (back-to-back episodes in one block).

**How it functions:** A rule is stored as a template (asset-set + slot + recurrence + date range). A generator expands the rule into concrete schedule rows, walking the asset set in order, respecting the recurrence, and stopping at the end date or when the set is exhausted. Re-running or editing the rule regenerates the affected rows.

*Build note (apex):* **MISSING** and it's your biggest scheduling gap. No recurrence anywhere means someone has to hand-place 14 days to satisfy a FAST EPG horizon. Build a recurrence/dayparting engine that expands templates into your existing schedule rows — P1, medium effort, and it unblocks the whole "schedule far enough ahead" problem.

### 2.3 Loop channels & auto-fill
**What it is:** A channel that runs a library on repeat indefinitely, with no manual scheduling.

**UX/UI:** A toggle: "loop this playlist 24/7." Sub-options for shuffle vs. sequential, and "insert an ad break every N minutes." Some tools let you loop a *block* (e.g., a 3-hour rotation) rather than the whole library.

**How it functions:** Two implementations. The cheap one *materializes* rows — writes out N days of looped playlist into the schedule table (your approach: 500-row / 7-day cap). The elegant one is a *true loop channel* — the playout engine holds a playlist pointer and wraps around at the end with no pre-written rows, so the channel runs forever without regenerating. True loops also make EPG generation cheaper because the guide is computed from the loop definition, not from materialized rows.

*Build note (apex):* You have materialized auto-fill (loop/shuffle/periodic-ad-break, collision-aware). Good enough to launch. The upgrade to a *true* loop channel (pointer that wraps, no 500-row ceiling) pairs naturally with the recurrence work in 2.2.

### 2.4 Smart playlists
**What it is:** Playlists defined by a filter rather than a hand-picked list — "all comedy under 30 min, rated PG" auto-populates and stays current as you add content.

**UX/UI:** A filter builder (genre = X, tag includes Y, duration < Z, rating in {...}) with a live preview count. The playlist updates automatically as matching assets are ingested.

**How it functions:** The "playlist" is stored as a query, not a set of IDs. At schedule/fill time the query runs against the catalog and returns current matches. FastPix builds "smart playlists using filters like genre, age, or region."

*Build note (apex):* **MISSING** but easy — you already have `genre`/`tags[]`. A saved-filter feeding your auto-fill selector is an S-effort P1.

### 2.5 Frequency caps & rights warnings
**What it is:** Guardrails that stop you over-airing a title or violating a license.

**UX/UI:** Set "max twice per week" on an asset; a red dot warns when you exceed it. An Asset Usage tab shows how often each program is scheduled over a window so you can avoid oversaturation. Rights violations surface as inline warnings at the moment of placement.

**How it functions:** A counter aggregates scheduled placements per asset per rolling window and compares against the cap; the UI decorates over-scheduled items. Rights checks compare placement time against the asset's availability window.

### 2.6 AI / auto scheduling
**What it is:** One-click schedule generation from your library and some goals.

**UX/UI:** "Auto-generate schedule" button; pick a library, a daypart strategy, and let ML fill the grid, then hand-edit. Amagi's Smart Scheduler markets exactly this.

**How it functions:** A model (or heuristics) sequences assets to balance variety, respect frequency caps and rights, hit ad-load targets, and match dayparts (kids in morning, primetime features at night), outputting normal schedule rows you can override.

---

## 3. Playout engine (the CLOUDPORT layer)

### 3.1 The playout runtime
**What it is:** The process that reads the schedule against a real clock and produces the actual continuous linear signal.

**UX/UI:** A "master control" style live monitor per channel — a preview of what's on air *now*, what's *next*, a countdown to the next transition, current-item metadata, and manual override controls (skip, hold, cut to live, cut to slate). Operators mostly watch; the engine runs itself.

**How it functions:** A loop that, every tick, asks "given `NOW()`, what schedule item covers this instant?", ensures that asset's frames are flowing to the output (RTMP/SDI/SRT), and handles the transition to the next item at its boundary. It caches the resolved now-playing so every viewer request doesn't hit the database. Frame-accurate engines cut on exact GOP boundaries; looser ones tolerate a few frames of slop.

*Build note (apex):* You have this — one `PlayoutEngine` per channel, `NOW()` resolution, Redis-cached, TIMESTAMPTZ throughout. Solid. Single-timezone only (no per-channel tz), which is fine until you regionalize.

### 3.2 Filler & continuity (no dead air)
**What it is:** The guarantee that *something appropriate* is always on air, even when the schedule has a hole or an asset fails.

**UX/UI:** Per-channel settings for a **filler playlist** (what to play in gaps) and a **slate** (a branded "we'll be right back" / "technical difficulties" card). Operators expect that a gap never produces a frozen player.

**How it functions:** When the engine detects a gap or a missing/failed asset, it falls through a priority chain: designated filler playlist → genre-matched free content → slate loop. The slate is a short MP4 looped so HLS segments keep advancing (a frozen output = stale segments = broken players). Critically, filler selection must *exclude* premium/wrong-genre content.

*Build note (apex):* This is your **#1 P0 risk**. Filler is currently random (can surface premium/patron content); `filler_playlist_id` exists but is never read; sub-30s gaps run a 2s sleep loop = literal dead air; there's no slate. Wire the column, add a slate MP4 fallback, and kill the sleep loop. Both are S-effort and they're the difference between a channel you can trust unattended and one you can't.

### 3.3 Live & event playout
**What it is:** Cutting a live source (sports, an event, a webcam) into the linear channel, then back to VOD.

**UX/UI:** A "cut to live" control, a live-source picker (RTMP/SRT input, a scheduled live window), and the ability to schedule a live event as a placeholder block that the engine joins at air time. Viloud lets you interrupt the linear signal at any moment for live content. Amagi DYNAMIC spins up live infrastructure automatically per the event schedule and tears it down after.

**How it functions:** A live input is registered as a special schedule item pointing at an ingest endpoint rather than a file. At the window, the engine switches its source to the live feed; on end (or signal loss) it falls back to schedule/slate. Elastic tools provision the encoder/infra on demand and release it when the event ends to avoid paying for idle capacity.

*Build note (apex):* You have RTMP *ingest*; the gap is treating a live feed as a first-class schedulable source with graceful fallback. Medium effort, only needed when you actually do live.

### 3.4 Multi-channel & regionalization
**What it is:** Running many channels from one library, and splitting a channel into regional variants (different ads, different content per territory, local language).

**UX/UI:** A channel list/dashboard; "clone channel"; per-region overrides (swap these ad breaks, black out this program in this territory, different EPG). Amagi does this from a common engine reusing automation rules.

**How it functions:** Channels share the asset catalog and scheduling rules; a region is a channel variant with an override layer (ad map, blackout list, language track, tz). The playout engine applies overrides at emit time.

*Build note (apex):* You run N channels in parallel (one engine each) — good. Per-channel config is thin (no per-channel filler/tz/ladder). Regionalization is a later concern.

---

## 4. Graphics & branding

**What it is:** On-screen furniture — channel logo "bug," lower-thirds, promo banners, countdown clocks, picture-in-picture squeezebacks, "up next" bumpers, slates.

**UX/UI:** A graphics/template manager where you upload a logo or design an HTML5 template, position it (drag onto a preview frame, set corner + margin + opacity), and schedule it (always-on bug vs. timed lower-third vs. event-triggered). Leaders support animated and data-driven graphics — Amagi ranges from static logo to dynamic HTML5 templates and PiP; a graphic can be powered by metadata so an "up next" banner updates itself. FastPix pitches interactive graphics that link to promotions.

**How it functions:** Two placement strategies with very different cost profiles:
- **Burned at mezzanine/transcode time** — the bug is composited into the asset once, costs zero playout CPU, but is fixed per asset.
- **Composited at playout** — an ffmpeg overlay filter (or a compositor) draws graphics onto the live signal in real time; flexible (per-channel bug, live data) but re-encodes and costs CPU per channel.

Data-driven graphics render from templates + a metadata feed (now/next, sports scores, tickers).

*Build note (apex):* **MISSING** in-stream (your `ProductOverlay`/`HaggleOverlay` are web-app only, not baked into the HLS). Cheapest path: burn a channel bug at the mezzanine stage for owned channels (zero playout CPU). Per-channel stream-baked bugs need a playout re-encode — decide when you actually need distinct bugs per channel. S–M effort, P1.

---

## 5. Ad insertion & monetization (the THUNDERSTORM layer)

The revenue engine, and the area with the most technical depth. Four distinct capabilities that people constantly conflate:

### 5.1 Ad-break scheduling / decisioning
**What it is:** Deciding *where* breaks go and *which* ads fill them.

**UX/UI:** Rules to auto-insert breaks (every N minutes, or at segment boundaries in the content), a campaign manager (flights, budgets, impression caps, targeting), and pacing controls so a campaign spends evenly. Amagi PLANNER auto-inserts breaks at segment level per rules instead of hand-placing hundreds.

**How it functions:** A break scheduler marks break positions in the schedule; an ad decision engine selects ads per break using pacing (least-served-first), budget/flight windows, and frequency caps, then writes an impression to an immutable ledger for billing/reporting.

*Build note (apex):* **BUILT and genuinely good** — `is_ad_break` items, `AdDecisionEngine` with least-served-first pacing, budget/flight/impression caps, immutable `ad_impressions` ledger, `/api/ads/report`. The money loop exists end-to-end. Weakness: impressions are counted from a concurrent-viewer snapshot, not verified views — fine internally, won't pass an external ad network's audit.

### 5.2 SCTE-35 signaling
**What it is:** The industry-standard *markers* embedded in the stream that say "an ad break starts here, N seconds long." The lingua franca of ad insertion.

**UX/UI:** Mostly automatic — the break rules from 5.1 emit SCTE-35 cues. Advanced UIs let you place or edit cue points on the timeline.

**How it functions:** SCTE-35 messages are inserted into the transport stream / HLS manifest (`#EXT-X-CUE-OUT`/`CUE-IN` or DateRange tags) at break boundaries. Downstream systems (your own or a third party's) read these cues to know where to insert ads. Frame-accurate conditioning of the splice point is deep broadcast plumbing.

*Build note (apex):* **MISSING** (a code comment literally defers it). This is the **single biggest FAST blocker** — FAST platforms run their own SSAI and need your cues to monetize; no cues = no carriage. But it's only needed for the FAST path. When that's real, get it from a playout service (Veset/FastPix) or a distributor (Amagi/Wurl) rather than building splice conditioning yourself. BUY/DEFER.

### 5.3 SSAI / DAI (server-side / dynamic ad insertion)
**What it is:** Stitching a *different, personalized* ad into each viewer's stream at the CDN edge, seamlessly, so it can't be ad-blocked.

**UX/UI:** Integration config, not day-to-day UI — connect an ad server (VAST/VMAP tag URL), set ad-load rules, view fill-rate and revenue analytics. Amagi THUNDERSTORM markets avoiding ad blockers and boosting fill rates.

**How it functions:** At an SCTE-35 cue, the SSAI service calls an ad decision server (VAST response), transcodes the returned ad to match the stream's exact rendition profile, and splices it into that viewer's manifest so playback is seamless. Server-side beacons fire verified impression/quartile events. This is what unlocks *programmatic* demand.

*Build note (apex):* **MISSING** — your ads are broadcast-spliced for all viewers (crude but working). SSAI is a **BUY** every time: AWS MediaTailor (usage-priced, no fixed fee) or bundled with a FAST distributor. Never build solo. Requires 5.2 (SCTE-35) to exist first.

### 5.4 VOD / preroll-midroll & programmatic fill
**What it is:** Ads in on-demand content and filling unsold inventory via ad exchanges.

**UX/UI:** Preroll/midroll toggles per asset, VAST tag configuration, waterfall setup (direct-sold → programmatic fallback).

**How it functions:** A client or server ad SDK requests a VAST tag at playback/cue points; direct-sold campaigns serve first, programmatic fills the rest. Requires VAST integration and server-side beacons for verified counting.

*Build note (apex):* VOD preroll+midroll works but house-campaigns only — no VAST/programmatic, so revenue is capped at your own direct deals. VAST integration is the unlock when you want exchange demand.

---

## 6. EPG (Electronic Program Guide)

**What it is:** The now/next/later guide — consumed by viewers in-app *and* exported to downstream platforms who need to know your schedule.

**UX/UI:** Two faces. *Viewer-facing:* a grid or "now playing / up next" strip in the player with titles, thumbnails, descriptions, and progress. *Operator-facing:* an export panel — pick a format (XMLTV, JSON, CSV, XLS) and a horizon (7–14 days), get a file or a live URL.

**How it functions:** The guide is computed from the schedule table over a lookahead window. Viewer EPG is served as JSON to the player; syndication EPG is serialized to **XMLTV** (the standard FAST/OTT platforms ingest) covering a multi-day horizon. Note the dependency: a 14-day EPG requires you to *have* 14 days scheduled — which requires recurrence (2.2).

*Build note (apex):* **PARTIAL** — you serve a JSON guide with a 12h hardcoded lookahead and a consumer grid on `/live`. Two gaps: extend the horizon to 7–14 days, and add an **XMLTV export endpoint** (thin serializer over existing schedule + videos, ~a day). Both P1; both are prerequisites for FAST.

---

## 7. Output, packaging & delivery

**What it is:** Turning the playout signal into adaptive streams every device can play, delivered globally.

**UX/UI:** Per-channel output settings — formats (HLS/DASH), the ABR ladder (which rungs), DVR/catch-up window, and CDN config. Often a "distribution endpoints" list showing where the channel publishes.

**How it functions:**
- **ABR ladder** — the signal is encoded into multiple rungs (e.g., 1080p/720p/480p/360p) so players step down on bad networks. The master manifest must advertise *exactly* the variants that exist, using **main** profile (baseline is legacy and lower quality).
- **Packaging** — HLS (`.m3u8` + segments) is universally accepted; DASH is common in Europe/Android-heavy contexts. SRT/RTMP push sends the channel to external targets (a FAST distributor, YouTube, Facebook).
- **CDN** — segments served from edge nodes to cut latency and buffering; a built-in CDN is considered essential.
- **Latency** — standard HLS (~10–30s) is fine for linear; LL-HLS only matters for near-live interactivity.

*Build note (apex):* HLS via nginx-rtmp → DO Spaces CDN is **BUILT**. The **critical defect** is the linear ABR: a single 2000k baseline rendition while the master playlist advertises 3 phantom variants — mobile/poor-network viewers get nothing to step down to and some players choke. Fix: real 3-rung ladder for playout channels, main profile, honest manifest. DASH/DRM/geo are **SKIP** unless a licensor demands them — HLS gets you everywhere you're going.

---

## 8. Distribution & syndication

**What it is:** Getting your channel onto the platforms where audiences actually are — your own apps, plus external FAST services (Roku Channel, Samsung TV Plus, Pluto, Tubi, LG).

**UX/UI:** A "publish to" list with per-destination toggles and status. Each destination has its own spec (format, EPG type, ad signaling), which the tool auto-conforms to — Amagi automatically tailors content to each platform's tech specs and updates them when requirements change.

**How it functions:** Each destination gets a conformed output: the right package (HLS/DASH), an EPG in their format (usually XMLTV), and SCTE-35 cues for their SSAI. Delivery is via HLS pull, SRT/RTMP push, or an MRSS content feed. Samsung/LG generally require a syndication partner (Amagi/Wurl/Frequency); Roku has a self-serve path.

**The FAST checklist (what platforms demand, in order):**
1. **SCTE-35** cues in the stream (biggest blocker — no cues, no ad revenue, no carriage)
2. **XMLTV/JSON EPG** with a 7–14 day horizon
3. **Redundant, monitored origin** with an uptime story
4. **Proper linear ABR ladder**
5. Usually a **syndication partner** deal

*Build note (apex):* Own-app distribution (Next.js web + Fire TV RN app) is **BUILT**. FAST syndication is **MISSING** across the board (no XMLTV, MRSS, or SCTE-35). None of it blocks the own-app path — so only start §8/§5.2/§5.3 work when a distribution conversation is actually live.

---

## 9. Reliability, QC & monitoring

**What it is:** The machinery that keeps 24/7 channels actually running 24/7 and proves what aired.

**UX/UI:** A NOC-style dashboard — every channel's up/down state, current item, output health (segment freshness), and alerts. Automated QC flags errors (black frames, silence, missing assets) before and during air. Amagi advertises 99.99% uptime and automated QC that surfaces errors for the team to fix.

**How it functions:**
- **Monitoring** — heartbeats from each engine, a "channel up" metric, and synthetic checks that fetch the CDN manifest and verify segments are advancing (not just HTTP 200).
- **Alerting** — thresholds route to email/SMS/Slack/PagerDuty when a channel drops or output goes stale.
- **Redundancy/failover** — multi-AZ or dual-origin so one host dying doesn't take channels off air; Amagi DYNAMIC uses a multi-AZ redundancy model.
- **As-run log** — the engine records what *actually* aired and when, for ad-billing disputes and compliance. Playout-vs-schedule reconciliation compares intended vs. emitted.

*Build note (apex):* Monitoring is **BUILT** (Prometheus `playout_channels_up`, 10s heartbeats, Sentry) but three gaps bite: **no alerting pipeline** (metrics exist, nobody's watching — a channel dies silently), **single-droplet SPOF** (every channel dies with one host), and **no as-run log**. Alerting is an S-effort P0 (UptimeRobot/Grafana on the manifest + metric). "Lite" redundancy (second droplet + health-checked DNS) is P0-ish ops work; true multi-region failover is where Veset/FastPix/Amagi earn their fee — defer to a FAST deal. As-run log is an S-effort P1.

---

## 10. Analytics & reporting

**What it is:** Who watched what, for how long, where, and how ads performed.

**UX/UI:** Dashboards — concurrent viewers, watch-time, completion, per-content and per-channel trends, device/geo breakdowns, and ad fill-rate/revenue. Amagi feeds viewership + ad analytics back into scheduling decisions (which programs drive viewership, avoid oversaturation).

**How it functions:** The player emits heartbeat events (start, 30s pulses, pause, stop) to an analytics pipeline; events roll up into time-series tables and dashboards. Ad analytics come from the impression ledger and (with SSAI) verified server-side beacons.

*Build note (apex):* **PARTIAL** — you have live concurrent `viewer_count` (snapshot, not historical) and `view_count`, but no watch-time heartbeats, no time series, no device/geo. Build a player heartbeat event → one table → per-channel/content series (BUILD lite, P1). Mux Data is the buy option but adds per-view cost.

---

## 11. Access control & security

**What it is:** Gating premium channels, protecting content, and restricting by territory.

**UX/UI:** Per-channel "requires premium" toggles, DRM settings, and geo-block region pickers.

**How it functions:**
- **Stream-level entitlement** — signed/tokenized HLS URLs or authenticated playlist delivery so only paid users get segments. Trade-off: signed URLs reduce CDN cacheability (cost/latency hit).
- **DRM** — Widevine/PlayReady/FairPlay encrypt segments; needed for licensed studio content, usually not for creator-owned.
- **Geo-blocking** — edge rules restrict delivery by region for rights compliance.

*Build note (apex):* `requires_premium` is **UI-only** — the HLS path is fully public (public-read ACL, CORS `*`, no tokens). This is a real decision, not an oversight to auto-fix: enforcing at stream level (signed HLS) is genuine work and *breaks CDN edge-caching* for those channels. Choose consciously — enforce, or accept app-level gating as tolerable leakage for now. DRM/geo are SKIP unless a licensor requires them.

---

## 12. Admin, roles & API

**What it is:** The operational shell — who can do what, and how the whole thing is driven programmatically.

**UX/UI:** User management with **role-based workflows** (scheduler vs. operator vs. admin — Amagi ships these), audit logs, and channel-level permissions. A settings area for encoding profiles, destinations, and branding defaults.

**How it functions:** RBAC gates every action; an audit log records changes. Crucially, everything the UI does is exposed as a **REST API** with webhooks and SDKs so schedules, channels, and playout can be controlled from external systems — Amagi DYNAMIC and FastPix both lead with full API access. This is what lets a platform like yours drive playout from its own product code rather than a vendor console.

*Build note (apex):* Your API-first posture is the right one — it's the thing that makes building (vs. buying) viable, because your scheduler UI, apps, and automation all talk to your own endpoints. Keep every new playout capability API-first.

---

## Appendix A — Build vs. buy, at a glance (solo/bootstrapped lens)

| Capability | Call | Why |
|---|---|---|
| Scheduler UX (calendar/drag-drop, recurrence, smart playlists) | **BUILD** | Pure frontend over APIs you own; a vendor replaces your whole stack to give you this |
| Filler playlists + slate | **BUILD** | Schema column already exists; slate = one looping MP4 + fallback branch |
| Alerting | **BUILD (glue)** | Grafana/UptimeRobot on `/metrics` + manifest; hours not weeks |
| Linear ABR ladder | **BUILD** | nginx ladder change or pre-ladder at mezzanine; modest CPU |
| Channel bug / branding | **BUILD** | Burn at mezzanine (zero playout CPU) for owned channels |
| XMLTV / MRSS export | **BUILD** | Thin serializers over existing schedule; ~a day each |
| Watch-time analytics | **BUILD lite** | Player heartbeat → one table → time series |
| As-run log | **BUILD** | Engine writes what/when it actually pushed |
| Redundancy / failover | **BUILD lite now, BUY later** | Second droplet is ops work; true multi-region is where vendors earn their fee |
| SCTE-35 insertion | **BUY / DEFER** | Frame-accurate splice conditioning is deep plumbing; only needed for FAST |
| SSAI / DAI | **BUY** | AWS MediaTailor or distributor-bundled; never build solo |
| DASH / DRM / geo | **SKIP** | HLS is accepted everywhere you're going; creator content doesn't need DRM |

## Appendix B — Feature checklist (copy into a tracker)

**Ingest & assets:** bulk upload · watch-folder/S3/FTP ingest · MRSS/API ingest · transcode+normalize (mezzanine) · ABR ladder · metadata/tags/ratings · rights windows · search/filter library

**Scheduling:** calendar/timeline grid · playlist/rundown view · drag-drop reorder/trim · overlap enforcement · gap visualization · rule/pattern scheduling (Programs-Day / Pattern / Date) · horizontal + vertical(binge) · loop channels (true) · auto-fill · smart playlists · frequency caps · rights warnings · AI auto-schedule

**Playout:** now/next resolution vs clock · live monitor + manual overrides · filler playlist · slate/no-dead-air · live source cut-in + fallback · elastic live infra · multi-channel · per-channel config · regionalization/blackouts · per-channel timezone

**Graphics:** channel bug · lower-thirds · promo banners · bumpers/"up next" · countdown/clock · PiP/squeezeback · HTML5/data-driven templates · burned-vs-composited placement

**Ads/monetization:** auto ad-break rules · campaign manager (flights/budget/caps) · pacing/decisioning · impression ledger · SCTE-35 signaling · SSAI/DAI · VAST/VMAP · programmatic fill · VOD preroll/midroll

**EPG:** viewer now/next/grid · JSON guide · XMLTV export · CSV/XLS export · 7–14 day horizon

**Output/delivery:** HLS · DASH · correct ABR manifest · main profile · SRT/RTMP push · CDN · DVR/catch-up window · LL-HLS (optional)

**Distribution:** own web/app · Fire TV/Roku/Samsung/LG apps · YouTube/Facebook simulcast · FAST syndication · MRSS feed · per-destination conforming

**Reliability/QC:** heartbeats · channel-up metric · synthetic manifest checks · alerting pipeline · automated QC (black/silence) · redundancy/failover · as-run log · schedule reconciliation

**Analytics:** concurrent viewers · watch-time/completion · per-content + per-channel series · device/geo · ad fill-rate/revenue

**Security:** premium entitlement (signed HLS) · DRM · geo-blocking · access control

**Admin/API:** RBAC roles · audit log · REST API · webhooks · SDKs · encoding-profile settings
