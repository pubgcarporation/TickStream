# How TickStream works

TickStream sells video by the second. A viewer pays in USDC only for the seconds that play. A creator sets a price per
second, uploads a video, and is paid as people watch. It runs on Arc Testnet with test USDC.

## The people

- **Viewer.** Browses videos, adds money to a spending balance, watches, and can tip.
- **Creator.** Uploads videos, sets prices, sees analytics and earnings, and withdraws to their own wallet.
- **Admin.** A wallet address listed in the server settings. Can take videos down and see payments and users.

## The two wallets

1. **Main wallet.** The person's identity. With email or Google login, Privy creates an embedded wallet in the browser.
   With an existing wallet such as MetaMask, nothing new is created. Creator earnings go to this address.
2. **Spending wallet.** A small signing key made from a free signature by the main wallet (asked twice the first time,
   once per visit after that). It is held in memory, never saved in the browser, and gives the same address on any
   device. It signs payments silently so playback never stops for a pop-up. Funds are held in Circle Gateway under this
   address, so keep only what you plan to spend there. Wallets that cannot sign the same message twice fall back to a
   key stored in the browser.

## Life of a viewing

1. **Sign in.** The main wallet signs a message and the server gives back a sign-in token.
2. **Add money.** The main wallet approves USDC and deposits it into Circle Gateway for the spending address.
3. **Open a video.** The page shows the price per second, the free preview if any, and a session budget.
4. **Start a session.** The viewer picks a budget and a billing step (2, 6, 10, 20 or 30 seconds). The server records the
   price, budget and step. Starting a new session ends any other one for the same wallet.
5. **Pay each step.** The server asks for exactly price x seconds, paid to the creator. The spending wallet signs that
   exact amount. Circle Gateway accepts it. Only then does the server unlock the next video segments.
6. **Play.** The playlist grows as steps are paid. About half a step before the paid video runs out, the player pays for
   the next step. Pause, close the tab or end the session and payments stop.
7. **Settlement.** Gateway batches many small payments into onchain transfers. The settlement worker marks each payment
   settled. Creators see it as Batching, then Settled.

The server decides what is owed and what is unlocked. The page's timer is never trusted, and the budget is enforced by
the server.

## Tips

A tip is a one-off payment to the creator of a video, 0.01 to 100 USDC with an optional note. It uses the same signed
payment path, paid from the spending balance. The creator sees it in Studio with a Tip badge, and it counts toward
earnings and analytics.

## Uploading a video

1. The creator creates the video, then uploads the file to private storage.
2. The media worker checks the file, re-encodes it to H.264 and AAC (720p at most), cuts it into 2-second segments, and
   encrypts them with a fresh key per video. It also makes a thumbnail.
3. The video is marked Live and appears on Home and Explore.

Files are never public. Segments and the key are only served to a signed-in wallet with a live, paid session.

## What creators see

- **Overview and Earnings.** Totals, the last 14 days, recent payments, and the payout balance in Gateway.
- **Analytics.** Views, paying viewers, average watch time and completion, and earnings for each video.
- **Withdraw.** The creator signs with their own wallet to move earnings out of Gateway.

## The parts

| Part | Job |
| --- | --- |
| Website (Vercel) | Browse, watch, studio and wallet screens. |
| API (VPS) | Sign-in, videos, sessions, payments, tips, earnings, analytics. |
| Media worker (VPS) | Turns uploads into encrypted video segments. |
| Settlement worker (VPS) | Matches payments to Gateway transfers and closes idle sessions. |
| Postgres | Users, videos, sessions and payments. |
| Redis | Sign-in tokens, live sessions, replay guards, job queue, rate limits. |
| Circle Gateway | Holds balances and settles payments onchain. |

## Contracts

TickStream has no contract of its own in the live payment path. Circle's Gateway contracts hold the money. The four
contracts in `contracts/` are optional and not connected.
