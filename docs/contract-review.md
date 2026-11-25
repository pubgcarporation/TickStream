# Does TickStream need a smart contract?

Verdict: no. Every place where money or permissions are involved is already covered, and a custom contract would add
cost, delay and a trusted server key without making anything safer.

## Money paths, one by one

| Part | What it does today | Contract needed? |
| --- | --- | --- |
| Watching (`payments/grant.routes.ts`) | Server asks for the exact price of each 2-second chunk. The viewer's spending wallet signs a USDC authorization for exactly that amount, payable straight to the creator. Circle Gateway checks the signature and settles. The server rejects a wrong payer, wrong recipient or wrong amount first. A unique nonce stops replays. | No. The viewer signs every payment, and funds go to the creator's address, never through the platform. |
| Tips (`payments/tips.routes.ts`) | Same flow with a viewer-chosen amount. | No. |
| Payment checks (`payment-sdk/x402-server.ts`) | Builds the requirement and checks the signed authorization before settling. | No. |
| Settlement (`settlement-worker`) | Looks up each payment at Gateway and marks it settled or failed. Closes idle sessions. Clears unfinished uploads. | No. It only reads Gateway status. |
| Creator withdrawals (`payments/withdraw.routes.ts`, `src/lib/gateway-withdraw.ts`) | The creator signs a burn intent in their own wallet. The API forwards it only when the depositor is the signed-in wallet, and Gateway mints USDC back to the creator. | No. The creator controls the withdrawal, and Gateway already enforces it onchain. |
| Spending wallet (`src/lib/spending-wallet.ts`) | A key derived from a wallet signature pays without a pop-up per payment. | No. It is client-side key handling. |

## Everything else

| Part | Contract needed? |
| --- | --- |
| Sign-in (`auth.routes.ts`): wallet message signature, short-lived token | No. |
| Admin takedowns (`admin.routes.ts`): off-platform moderation, must be able to hide a video | No. Putting this onchain would make takedowns harder. |
| Videos, uploads, encryption, HLS delivery, media worker | No. Large files and keys belong off-chain. |
| Comments, following, categories, analytics (`StudioStats`) | No. Cheap, fast, private reads. |
| Database tables (`001_init.sql` onward) | No. |

## The four contracts in `contracts/`

Nothing in `src/`, `tickstream/apps` or `tickstream/packages` calls them. Only the deploy helper scripts in `scripts/`
mention contracts in general.

- `TickStreamEscrow`: an operator key on your server would charge viewers. Today a viewer signs each payment
  themselves, so this would be a step down in trust, and each charge would cost gas.
- `CreatorVault`: duplicates the creator's Gateway balance, which they already withdraw themselves.
- `PaymentRegistry`: only adds public receipts. Gas cost per payment, and it makes who paid whom public.
- `RevenueDistributor`: would only matter if you wanted creator revenue splits. You said you don't.

## Recommendation

Do not integrate any contract. Keep payments on Gateway. Leave `contracts/` unused, or delete the folder so nobody
assumes it is part of the product.

## How this was checked

Read in full: payment, tip, withdraw and grant routes, the payment SDK, the settlement worker, sign-in, the spending
wallet, the withdrawal helper, the database schema and the escrow contract. Admin routes were read for takedown logic.
Media, comments and UI files were judged by what they do and a search for any contract reference (none found).
