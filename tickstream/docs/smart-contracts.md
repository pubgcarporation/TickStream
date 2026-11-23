# Smart contracts

Live payments do not use a custom contract. Funds are held and moved by Circle Gateway:

- Viewers deposit USDC into the Gateway Wallet contract for their spending address.
- Each payment is a signed USDC authorization that Gateway settles in batches.

## Optional contracts

The project root `contracts/` holds four contracts for possible later use. Nothing in the app calls them yet.

| Contract | Purpose |
| --- | --- |
| `TickStreamEscrow` | Viewers deposit USDC and can always withdraw what they have not spent. An operator charges per session. |
| `CreatorVault` | Holds creators' earned USDC. Creators withdraw their own balance. |
| `PaymentRegistry` | Records a receipt for every charge, with totals per creator and per video. |
| `RevenueDistributor` | Lets a creator split earnings among up to 10 collaborators, who each claim their own share. |

None of them charge a platform fee. Build with `forge build`.
