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
| `TRUST_PROXY` | API | Set to `1` only behind a proxy you control, so rate limits use the real client address. |
| `FFMPEG_PATH`, `FFPROBE_PATH` | media worker | Optional. Defaults to the bundled binaries. |

## Containers

`bun run stack:up` starts only Postgres and Redis. To run everything in containers, export the variables above
and run `docker compose -f tickstream/infrastructure/docker/docker-compose.yml --profile app up -d --build`.
The API listens on port 3001. Serve the web client from the same origin or proxy `/api` to it.

## Production notes

- Put the API behind HTTPS and serve the web client from the same origin, or proxy `/api` to it.
- Use a private R2 bucket. Do not enable public access.
- Run the media worker and settlement worker as separate processes. They share Postgres and Redis with the API.
- This build targets Arc Testnet. Moving to mainnet means new chain facts, a production Gateway endpoint, and your own
  review of every address and permission before real funds are involved.
