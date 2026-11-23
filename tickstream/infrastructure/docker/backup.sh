#!/usr/bin/env bash
# Saves the database and the uploaded videos into ./backups. Run it from this folder on the server.
set -euo pipefail
cd "$(dirname "$0")"
stamp="$(date +%Y%m%d-%H%M%S)"
mkdir -p backups
compose=(docker compose -f docker-compose.prod.yml)

"${compose[@]}" exec -T postgres pg_dump -U postgres -d tickstream | gzip > "backups/db-$stamp.sql.gz"
docker run --rm -v tickstream_data:/data:ro -v "$PWD/backups:/backup" busybox:1.37 tar czf "/backup/videos-$stamp.tar.gz" -C /data .
echo "Saved backups/db-$stamp.sql.gz and backups/videos-$stamp.tar.gz"
