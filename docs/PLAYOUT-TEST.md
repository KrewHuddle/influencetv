# Playout / Broadcast Verification Runbook

The linear-broadcast code is complete but **can't be verified in CI** (no ffmpeg/RTMP there). Run this on the **streaming droplet** (the host running the `apex-playout` pm2 process) to verify it live.

## 0. Pick up the new code

```bash
cd /root/apex
git pull origin main          # auto-deploy already does this, but be sure
pnpm install --frozen-lockfile
pnpm --filter @apex/api build
pm2 restart apex-playout       # loads control plane + heartbeats + ad splice + supervisor
pm2 logs apex-playout --lines 40
```

## 1. Heartbeats appear

In the admin console → **Broadcast → Playout** (`/admin/playout`), or:

```bash
curl -s https://influencetvnetwork.com/api/admin/playout/status \
  -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>"
```
Expect one entry per running channel with `running: true` and a small `lastSeenMs`.

## 2. Kill actually stops ffmpeg (was a no-op before)

From `/admin/playout` press **Kill** on a live channel (or POST `/api/admin/channels/:id/kill`).
On the droplet, confirm the channel's ffmpeg process is gone:
```bash
pgrep -af "rtmp://localhost/vod" | grep <slug>   # should disappear
```

## 3. Scheduled ad break splices a real ad

Prereq: an active ad campaign with a **ready** creative video (fixture `Acme Test` / campaign `cb457764` already exists in prod).

1. Admin console → **Broadcast → Programming** (`/admin/schedule`): pick a channel, schedule an **Ad Break** a couple minutes out (a fixture row already exists on the `drama` channel).
2. Watch the channel's HLS output during the break window:
   ```bash
   curl -s https://cdn.influencetvnetwork.com/hls/<slug>/master.m3u8
   # then a media playlist — look for #EXT-X-DISCONTINUITY at the break boundary
   ```
3. Confirm the ad creative plays, then the program resumes.
4. Confirm impressions were counted:
   ```bash
   curl -s https://influencetvnetwork.com/api/ads/report \
     -H "Authorization: Bearer <SUPER_ADMIN_TOKEN>"
   # impressions_served should jump by the concurrent viewer count
   ```

## 4. Supervisor self-heals

Kill the ffmpeg of a running channel by hand (not via the admin Kill, which stops the engine):
```bash
pkill -f "rtmp://localhost/vod/<slug>"
```
Within ~15s the supervisor should restart that channel's engine (watch `pm2 logs apex-playout`, and the stream resumes).

## Notes
- `channels.viewer_count` becomes real once viewers connect via socket (join-channel) — presence tracking is in `sockets/index.ts`.
- Ad breaks with no eligible campaign fall back to filler (never dead air).
- Frame-accurate SCTE-35 splicing is a later upgrade; this uses per-session ffmpeg pushes + nginx-rtmp discontinuities.
