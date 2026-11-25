# Payment flow

Money moves in four stages. The browser never decides how much is owed.

1. **Add money.** The viewer's connected wallet approves USDC and deposits it into Circle Gateway on behalf of their
   spending address (a small signing key kept in the browser). That balance pays for video.
2. **Start a session.** The viewer picks a spending cap. The server records the cap, the price per second and the viewer's spending address. Every payment buys exactly one video segment: 1 second for new videos, or the length the video was encoded with for older ones.
3. **Pay each second over x402.** The player asks the server for the next segment. The server replies `402 Payment
   Required` with the exact amount (price x seconds in the segment), the creator as recipient, and the network.
   Every successful payment also returns the price of the following one, so later payments take one request, not two.
   Playback starts with the first second and the one after it paid. Each time a new second starts playing, the player pays for the one after the next, so exactly one second is always paid ahead of the one being watched. The player times its payments. If they are slow on a connection, it pays further ahead and buys several seconds in one payment (up to 6), so playback does not wait for money. On a fast connection it stays at one second.
   The spending key signs exactly that authorization. The server checks it, then settles it with Gateway.
4. **Settlement.** Gateway batches many small authorizations into onchain settlements. The settlement worker marks each
   payment settled when its transfer completes.

## Rules the server enforces

- The signed amount must equal the server's price for that segment, the recipient must be the creator, and the payer
  must be the spending address registered for the session.
- Each authorization carries a nonce. The nonce is stored with a unique constraint, so a signature can be used once.
- A payment that would pass the session cap is refused before anything is signed.
- Only after Gateway accepts a payment does the server unlock the next segments.
- The most a viewer can pay for video they did not watch is the video paid ahead (about 1 to 2 seconds).
- The last payment of a video covers only the video that is left, so a video that ends partway through a segment is never billed for the missing part.

## What creators see

Payments appear immediately as `Batching` and move to `Settled` after Gateway completes the transfer. Earnings
accrue to the creator's wallet address inside Gateway.
