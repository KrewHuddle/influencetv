#!/usr/bin/env bash
# Build the HLS master playlist for a live ingest, then notify the API.
# Invoked by nginx exec_publish with the stream key as $1.
# Install to /usr/local/bin/apex-create-master.sh (chmod +x).
set -euo pipefail

NAME="${1:?stream key required}"
HLS_DIR="/var/www/hls/${NAME}"
API_BASE="${API_BASE:-http://localhost:3000}"

mkdir -p "${HLS_DIR}"

# 2 variants matching the nginx ladder (2-vCPU droplet; re-add the 1080p
# variant together with its nginx encode block after a droplet resize).
cat > "${HLS_DIR}/master.m3u8" <<EOF
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=1280x720
720p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=600000,RESOLUTION=854x480
480p/index.m3u8
EOF

# Tell the API the master playlist is ready (publishes hls_output_url).
curl -fsS -X POST "${API_BASE}/api/streams/ready/${NAME}" >/dev/null 2>&1 || true
