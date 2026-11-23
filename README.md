# TickStream

Pay-per-second video streaming on Arc. Viewers pay in USDC only for the seconds they watch, with no subscription. The project is at the planning stage: the `tickstream/` folder holds the empty monorepo layout (web app, API, media and settlement workers, shared packages, contracts, infrastructure, docs).

Built with [Arc Studio](https://studio.arc.io)

## Tech stack

- Arc Testnet with USDC
- React, Vite, TypeScript, Tailwind CSS, wagmi, viem
- Planned: Node.js API, PostgreSQL, Redis, Cloudflare R2, x402 payments

## Development

Prerequisites: [Bun](https://bun.sh).

```bash
bun install
bun run dev      # start the app
bun run check    # lint and typecheck
```

### Environment variables

None.
