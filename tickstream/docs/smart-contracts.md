# Smart contracts

TickStream needs no custom contract in this version. Funds are held and moved by Circle Gateway:

- Viewers deposit USDC into the Gateway Wallet contract for their spending address.
- Each payment is a signed USDC authorization that Gateway settles in batches.

The Solidity files in `contracts/src` are empty placeholders for possible later work (a creator vault, revenue
splitting). Nothing in the app uses them.
