# TickStream

Every second counts. Watch anything and pay only for the seconds you watch, in USDC, with no subscription. Creators set a
price per second, upload a video, and get paid as viewers watch.

## What it does

- Browse and search videos, each with a clear price per second.
- Watch with a live cost meter, a spending cap you choose, and payment one second at a time with one second paid ahead. Pausing stops the meter.
- Add money to a spending balance from your wallet and move unused money back.
- Creators upload videos, set prices, and see earnings and payments in a studio.
- Videos are encrypted, delivered only after payment, and limited to one active viewing session per wallet.
- Creators can offer a free preview, and viewers can resume where they left off.
- Comments, following, and related videos.
- Creators get analytics (paying viewers, watch time, completion) for today, the last 7 to 365 days, this or last month, or any date range they pick, can edit their videos, and can withdraw earnings to their wallet.
- An admin console for takedowns, payments and users.

## Tech stack

- Web: React, Vite, TypeScript, Tailwind CSS, wagmi, viem, hls.js
- API and workers: Node-style HTTP server run with Bun, PostgreSQL, Redis, ffmpeg
- Payments: x402 with Circle Gateway nanopayments, on Arc Testnet (USDC)
- Storage: local folder or Cloudflare R2 (private bucket)

## Development

Prerequisites: [Bun](https://bun.sh) and Docker.

```bash
bun install
bun run stack:up        # start Postgres and Redis
bun run seed            # optional: add five generated demo clips
bun run stack           # start the API and both workers
bun run dev             # start the web client
bun run check           # lint and typecheck
```

### Environment variables

Names only. See `tickstream/docs/deployment.md` for details.

- `DATABASE_URL`: Postgres connection string
- `REDIS_URL`: Redis connection string
- `SESSION_SECRET`: server secret
- `API_PORT`: API port (default 3001)
- `GATEWAY_API_URL`: Circle Gateway API base URL
- `STORAGE_DRIVER`: `local` or `r2`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`: needed for `r2`
- `ADMIN_ADDRESSES`: wallet addresses allowed into the admin console (comma-separated)
- `VITE_PRIVY_APP_ID` (optional): public app ID from dashboard.privy.io. Turns on email and Google login with an embedded wallet.
- `TRUST_PROXY`: set to `1` only when the API sits behind a proxy you control
- `FFMPEG_PATH`, `FFPROBE_PATH`, `MAX_UPLOAD_BYTES`: optional overrides

## Project layout

The web client is in `src/`. Services, shared packages, docs and infrastructure are in `tickstream/`.
