# TickStream

Pay-per-second video streaming. Viewers pay in USDC for the seconds that play; creators set a price per second.

## Tech stack

- Web: React 18, Vite, TypeScript, Tailwind CSS, wagmi v2, viem v2, ConnectKit, hls.js
- Services (run with Bun): API, media worker, settlement worker in `tickstream/apps/*`
- Data: PostgreSQL and Redis in Docker (`bun run stack:up`), SQL schema in `tickstream/packages/database/migrations`
- Payments: x402 over Circle Gateway nanopayments (`@circle-fin/x402-batching`), Arc Testnet (chain 5042002), USDC
- Media: ffmpeg (bundled via ffmpeg-static), AES-128 encrypted HLS, private storage (local or Cloudflare R2)

## Key files

- `src/App.tsx`: routes. Pages in `src/pages`, player in `src/components/player`.
- `src/components/player/usePaidPlayback.ts`: session, payments and HLS playback.
- `src/lib/spending-wallet.ts`: browser spending key and Gateway client.
- `tickstream/apps/api/src`: routes by module (auth, videos, uploads, playback, payments, earnings, users).
- `tickstream/packages/payment-sdk/src/x402-server.ts`: 402 requirements and Gateway settlement.
- `tickstream/packages/shared/src`: env, db, redis, storage, pricing, constants, types (imported as `@shared/*`).
- `tickstream/docs`: architecture, payment flow, playback flow, security, API reference, deployment.

## Rules

- Amounts are integers in USDC base units (6 decimals). Use `@/onchain-money` and `@/onchain-facts` in the web app.
- The server decides what is paid and unlocked. Never trust amounts or playback state from the browser.
- No secrets in code or in URLs. The sign-in token travels in the `Authorization` header.
- Build any link a user copies with `buildShareLink` from `src/lib/share.ts`, and keep path-based routing.

## To run

```bash
bun install
bun run stack:up
bun run seed
bun run stack
bun run dev
```
