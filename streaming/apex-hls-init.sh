#!/bin/bash
# Ensure the per-channel HLS output directories exist before ffmpeg (exec_push)
# writes segments — ffmpeg will not create them, so a missing dir means nginx
# accepts the RTMP publish but produces no HLS. Called via exec_publish for both
# the live (ingest) and vod (linear playout) rtmp apps. $1 = stream name.
set -e
name="$1"
base="/var/www/hls/${name}"
mkdir -p "${base}" "${base}/1080p" "${base}/720p" "${base}/480p"
chown -R www-data:www-data "${base}" 2>/dev/null || true
chmod -R 755 "${base}" 2>/dev/null || true
