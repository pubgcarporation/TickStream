# Security

| Risk | Measure |
| --- | --- |
| Direct file download | Sources and segments live in private storage. There is no public MP4 or segment URL. |
| Sharing a stream link | Playlist, key and segment requests need the viewer's sign-in token and a live session for that wallet. |
| Faked playback timer | Delivery is decided by the server from payments it has accepted. The page's clock is never trusted. |
| Edited page code | Amounts owed, caps and unlocked segments live only on the server. |
| Replayed payment | Each signed authorization has a unique nonce, stored with a unique constraint. |
| Several tabs | One active session per wallet. A new session ends the previous one. |
| Downloading ahead | Segments unlock one at a time as they are paid, and an unpaid segment is never served. |
| Payment failure | When a payment is rejected, no new segments are unlocked and playback stops. |
| Extracting segments | Segments are AES-128 encrypted. The key is only served to a paying session. |
| Screen recording | Cannot be prevented. A moving label with the viewer's wallet and session id makes leaks traceable. |

## Community safety

- Comments require a signed-in wallet and are rate limited.
- Creators can remove comments on their videos. Administrators can take videos down or restore them.
- Administrator access is a list of wallet addresses in server configuration, never something a browser can claim.
- Withdrawals are signed by the creator's own wallet. The server only forwards intents for the signed-in address.

## Known limits

- A paying viewer's player receives the decryption key, so a determined person can extract it. Licensed DRM would
  raise the bar and is not included.
- There is no on-screen watermark, so a screen recording cannot be traced to a viewer. A burned-in per-viewer watermark would need server-side re-encoding.
- The spending key is made from a free signature by the viewer's main wallet and held in memory only, so it is not
  written to the browser's storage. Anyone who can run script on the site while it is unlocked could still use it, so
  it is meant to hold small amounts. Older keys saved in the browser keep working until their balance is moved back,
  and wallets that cannot sign the same message twice get a stored key instead.

## Secrets

`.env` is never committed. `SESSION_SECRET`, the database and Redis URLs, and R2 credentials are read from the
environment. The demo creator key is written to `tickstream/.data`, which is ignored by git.
