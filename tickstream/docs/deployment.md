# Deployment

## Local development

```bash
bun install
bun run stack:up      # Postgres and Redis in Docker
bun run seed          # optional: five generated demo clips
bun run stack         # API, media worker and settlement worker
bun run dev           # web client
```

## Environment

Names only. Put values in `.env`.

| Name | Used by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | all services | Postgres connection string. |
| `REDIS_URL` | all services | Redis connection string. |
| `SESSION_SECRET` | API | Random secret for the server. |
| `API_PORT` | API | Port to listen on (default 3001). |
| `GATEWAY_API_URL` | API, settlement worker | Circle Gateway API base URL. Testnet: the testnet host. |
| `STORAGE_DRIVER` | API, media worker | `local` or `r2`. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | API, media worker | Needed when `STORAGE_DRIVER=r2`. |
| `ADMIN_ADDRESSES` | API | Comma-separated wallet addresses allowed into the admin console. |
| `CORS_ORIGINS` | API | Website addresses allowed to call the API from a browser, comma-separated. Needed when the site is hosted on another domain. |
| `VITE_API_URL` | website (build time) | The API's full address. Leave unset to use `/api` on the same site, as the dev server does. |
| `TRUST_PROXY` | API | Set to `1` only behind a proxy you control, so rate limits use the real client address. |
| `FFMPEG_PATH`, `FFPROBE_PATH` | media worker | Optional. Defaults to the bundled binaries. |

## Containers (development)

`bun run stack:up` starts only Postgres and Redis. The `app` profile in `infrastructure/docker/docker-compose.yml`
also builds the API and workers, but it publishes the database ports, so use it on a developer machine only.

## Deploy everything on one VPS (no domain needed)

The website, API, both workers, Postgres, Redis and the video files all run on one server with
`infrastructure/docker/docker-compose.prod.yml`. A Caddy container serves the website and forwards `/api` to the API,
so the site and API share one address.

Needs: a Linux server with Docker and the Compose plugin (4 GB RAM and 40 GB disk is the practical minimum).

```
Browser ──> http(s)://<server>   (Caddy: website, and /api -> API -> Postgres, Redis, videos on disk)
```

### Steps

1. Install Docker (docs.docker.com/engine/install), then `sudo systemctl enable --now docker`.
2. `git clone https://github.com/pubgcarporation/TickStream.git && cd TickStream/tickstream/infrastructure/docker`
3. `cp .env.example .env`, then fill it in (see the comments inside). With no domain, set `SITE_ADDRESS` to your IP with
   dashes plus `.sslip.io` (IP 203.0.113.5 becomes `203-0-113-5.sslip.io`). That is a free name that points at your IP and
   gets real HTTPS. Leave it empty for plain HTTP on the IP (wallet and login features may not work without HTTPS).
4. `docker compose -f docker-compose.prod.yml up -d --build`. The first build takes several minutes.
5. `docker compose -f docker-compose.prod.yml ps`: every service should be running and `api` healthy.
6. Open `https://<SITE_ADDRESS>/health/ready`. It should answer `{"ok":true,...}`, then open the site itself.

### Firewall

Allow only ports 22, 80 and 443. With ufw: `sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable`.
Postgres, Redis and the API are not published, so the stack itself never opens them.

If your domain is on Cloudflare, use DNS only (grey cloud). Cloudflare's proxy limits upload size, and videos can be large.

### Update

- Pull the new code on the VPS, then run the same `up -d --build` command. Data survives rebuilds.

### Backup and restore

`./backup.sh` (run from `infrastructure/docker`) writes `backups/db-<time>.sql.gz` and `backups/videos-<time>.tar.gz`.
Copy them off the server regularly, for example with a nightly cron job plus `rsync` or `rclone`.

Restore the database: `gunzip -c backups/db-<time>.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d tickstream`.
Restore videos: `docker run --rm -v tickstream_data:/data -v "$PWD/backups:/backup" busybox:1.37 tar xzf /backup/videos-<time>.tar.gz -C /data`.

### After deploying, check

- The website loads and the video list appears. If it stays empty, open the browser console and check the failing `/api` request.
- A creator can sign in, upload a video, and see it move from Encoding to Live.
- A signed-in viewer with test USDC in the spending balance can start a video and watch the meter run.
- `docker compose -f docker-compose.prod.yml logs --tail 50 api media-worker settlement-worker` shows no errors.

## Production notes

- Keep the site on HTTPS. If you host the website elsewhere, set `CORS_ORIGINS` and `VITE_API_URL` and keep them limited to your own addresses.
- With R2 instead of local disk, use a private bucket. Do not enable public access.
- Run the media worker and settlement worker as separate processes. They share Postgres and Redis with the API.
- This build targets Arc Testnet. Moving to mainnet means new chain facts, a production Gateway endpoint, and your own
  review of every address and permission before real funds are involved.
