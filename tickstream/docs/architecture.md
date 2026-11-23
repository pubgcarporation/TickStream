# Architecture

TickStream sells video by the second. A viewer pays in USDC for the seconds that play and nothing else.

## Parts

| Part | Where | Job |
| --- | --- | --- |
| Web client | `src/` (project root) | Browse, watch, studio, wallet. Runs on Vite and React. |
| API | `tickstream/apps/api` | Sign-in, catalogue, playback sessions, x402 payments, earnings. Plain Node HTTP, run with Bun. |
| Media worker | `tickstream/apps/media-worker` | Turns an uploaded file into AES-128 encrypted HLS segments plus a thumbnail. |
| Settlement worker | `tickstream/apps/settlement-worker` | Matches each accepted payment to its Gateway transfer and closes idle sessions. |
| Shared code | `tickstream/packages/shared` | Environment, Postgres and Redis clients, storage drivers, pricing math, types. |
| Payment code | `tickstream/packages/payment-sdk` | Builds x402 requirements and settles signed payments through Circle Gateway. |
| Chain facts | `tickstream/packages/arc-sdk` | Arc Testnet chain, USDC and Gateway addresses, read from the generated facts module. |
| Postgres | Docker | Users, videos, playback sessions, payments. Schema in `packages/database/migrations`. |
| Redis | Docker | Sign-in tokens, live session state, replay guards, the media job queue, rate limits. |
| Storage | Local folder or Cloudflare R2 | Private source files, encrypted segments, thumbnails. Never publicly addressable. |

## Network

Arc Testnet, USDC. Gas on Arc is USDC, and viewers pay through Circle Gateway nanopayments, so a payment needs no gas
from the viewer.

## Where things differ from the first sketch

- The web client runs from the project root `src/` because the preview serves a Vite app. `apps/web` is reserved.
- The data layer is plain SQL migrations (`packages/database/migrations`) instead of Prisma.
- No custom contract is needed. USDC moves through Circle Gateway, so `contracts/` holds only planned placeholders.
- Video and DRM: segments use AES-128 encryption with per-session key delivery. Licensed DRM (Widevine, FairPlay) is
  not included.
