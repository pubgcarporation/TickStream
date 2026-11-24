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

## Deploy: website on Vercel, everything else on your VPS

The website (the Vite app in the project root) is hosted on Vercel. The API, both workers, Postgres, Redis and the
video files run on your VPS with `infrastructure/docker/docker-compose.prod.yml`. A Caddy proxy on the VPS gives the
API HTTPS. The browser talks to the API directly, so the API has its own domain and a list of allowed websites.

```
Browser ──> https://tickstream.example.com   (Vercel: the website)
        └─> https://api.example.com          (VPS: Caddy -> API -> Postgres, Redis, videos on disk)
```

Needs: a Linux server with Docker and the Compose plugin (4 GB RAM and 40 GB disk is the practical minimum), a domain
for the API whose DNS A record points at the server, and a Vercel account.

### 1. The API on the VPS

1. Install Docker (docs.docker.com/engine/install) and make sure it starts at boot: `sudo systemctl enable --now docker`.
2. Get the code onto the server (`git clone`, or upload the project) and `cd tickstream/infrastructure/docker`.
3. `cp .env.example .env`, then fill it in:
   - `API_DOMAIN`: the API's domain, for example `api.example.com`. The website needs HTTPS, so do not leave it empty in production.
   - `CORS_ORIGINS`: the website's address(es), comma-separated, no trailing slash, for example
     `https://tickstream.example.com,https://tickstream.vercel.app`.
   - `POSTGRES_PASSWORD` and `SESSION_SECRET`: each from `openssl rand -hex 32`.
   - `ADMIN_ADDRESSES`: wallet addresses allowed into the admin console.
4. `docker compose -f docker-compose.prod.yml up -d --build`. The first build takes several minutes.
5. Check `docker compose -f docker-compose.prod.yml ps` (all services running, `api` healthy) and open
   `https://<API_DOMAIN>/health/ready`. It should answer `{"ok":true,...}`.

### 2. The website on Vercel

1. Import the repository in Vercel. `vercel.json` already sets the Vite build (`bun install`, `bun run build`, output `dist`)
   and sends every page path to `index.html`.
2. Add these environment variables in the Vercel project settings (Production), then redeploy:
   - `VITE_API_URL`: the API's address, for example `https://api.example.com` (no trailing slash).
   - `VITE_PRIVY_APP_ID`: your Privy app ID, only if you use Privy login.
3. Add the website's address to `CORS_ORIGINS` on the VPS (including any preview address you will use), then
   `docker compose -f docker-compose.prod.yml up -d` to apply it.
4. In the Privy dashboard, add the website's address under allowed domains, or login is blocked.

`VITE_` values are baked into the site at build time, so change them in Vercel and redeploy.

### Firewall

Allow only ports 22, 80 and 443. With ufw: `sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable`.
Postgres, Redis and the API are not published, so the stack itself never opens them.

If the API's domain is on Cloudflare, use DNS only (grey cloud). Cloudflare's proxy limits upload size, and videos can be large.

### More API copies (optional)

`docker-compose.prod.yml` runs two copies of the API (`api` and `api2`) and Caddy shares requests between them. They keep
no state of their own, so either can answer any request, and a copy that stops answering is skipped. To add more on a
bigger server, copy the `api2` block as `api3`, add `api3:3001` to the `reverse_proxy` line in `Caddyfile`, and add it to
the proxy's `depends_on`. A copy needs roughly one CPU core under load.

### Update

- API and workers: pull the new code on the VPS, then run the same `up -d --build` command. Data survives rebuilds.
- Website: push to the repository and Vercel redeploys.

### Backup and restore

`./backup.sh` (run from `infrastructure/docker`) writes `backups/db-<time>.sql.gz` and `backups/videos-<time>.tar.gz`.
Copy them off the server regularly, for example with a nightly cron job plus `rsync` or `rclone`.

Restore the database: `gunzip -c backups/db-<time>.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d tickstream`.
Restore videos: `docker run --rm -v tickstream_data:/data -v "$PWD/backups:/backup" busybox:1.37 tar xzf /backup/videos-<time>.tar.gz -C /data`.

### After deploying, check

- The website loads and the video list appears. If it stays empty, open the browser console: a blocked request
  usually means the website's address is missing from `CORS_ORIGINS` or `VITE_API_URL` is wrong.
- A creator can sign in, upload a video, and see it move from Encoding to Live.
- A signed-in viewer with test USDC in the spending balance can start a video and watch the meter run.
- `docker compose -f docker-compose.prod.yml logs --tail 50 api media-worker settlement-worker` shows no errors.

## Production notes

- Keep both the website and the API on HTTPS, and keep `CORS_ORIGINS` limited to your own website addresses.
- With R2 instead of local disk, use a private bucket. Do not enable public access.
- Run the media worker and settlement worker as separate processes. They share Postgres and Redis with the API.
- This build targets Arc Testnet. Moving to mainnet means new chain facts, a production Gateway endpoint, and your own
  review of every address and permission before real funds are involved.
