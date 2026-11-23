# API reference

The browser reaches the API under `/api` (the dev server proxies it to port 3001 and strips the prefix). Routes below
are shown without the prefix. Send the sign-in token as `Authorization: Bearer <token>`.

## Sign-in

| Method and path | Purpose |
| --- | --- |
| `POST /auth/nonce` | `{ address }` returns the message to sign. |
| `POST /auth/verify` | `{ address, signature }` returns `{ token, user }`. |
| `GET /auth/me` | Current user. |
| `POST /auth/logout` | Revokes the token. |

## Catalogue

| Method and path | Purpose |
| --- | --- |
| `GET /videos` | Ready videos. Query: `sort` (new, trending, price), `category`, `q`, `limit`, `offset`. |
| `GET /videos/:id` | One video. |
| `GET /videos/:id/thumbnail` | Preview image. |
| `GET /users/:username` | Creator profile and videos. |
| `PATCH /users/me` | Update username, display name, bio. |

## Creators

| Method and path | Purpose |
| --- | --- |
| `POST /videos` | Create a video record: title, description, category, `priceMicro` (USDC base units per second). |
| `PUT /videos/:id/source` | Upload the video file as the request body. |
| `PATCH /videos/:id`, `DELETE /videos/:id` | Edit or remove. |
| `GET /me/videos` | All of the creator's videos, with status. |
| `GET /creator/earnings` | Totals, per-video earnings, 14-day series. |
| `GET /creator/payments` | Recent payments and their status. |

## Playback

| Method and path | Purpose |
| --- | --- |
| `POST /videos/:id/sessions` | Start a session: `payer`, `capMicro`, `chunkSeconds`, optional `startSecond`. |
| `GET /sessions/:id` | Session state; also a heartbeat. |
| `POST /sessions/:id/grant` | x402 payment for the next interval. Returns 402 with the price, then 200 after payment. |
| `POST /sessions/:id/seek` | Jump to a second that is not unlocked yet. |
| `DELETE /sessions/:id` | End the session. |
| `GET /play/:id/playlist.m3u8`, `/play/:id/key`, `/play/:id/seg/:n` | Paid, session-bound playback. |
| `GET /me/history` | The viewer's paid sessions. |
