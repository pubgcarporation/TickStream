# Security

| Risk | Measure |
| --- | --- |
| Direct file download | Sources and segments live in private storage. There is no public MP4 or segment URL. |
| Sharing a stream link | Playlist, key and segment requests need the viewer's sign-in token and a live session for that wallet. |
| Faked playback timer | Delivery is decided by the server from payments it has accepted. The page's clock is never trusted. |
| Edited page code | Amounts owed, caps and unlocked segments live only on the server. |
| Replayed payment | Each signed authorization has a unique nonce, stored with a unique constraint. |
| Several tabs | One active session per wallet. A new session ends the previous one. |
| Downloading ahead | Segments unlock one interval at a time, and requests far ahead of playback are refused. |
| Payment failure | When a payment is rejected, no new segments are unlocked and playback stops. |
| Extracting segments | Segments are AES-128 encrypted. The key is only served to a paying session. |
| Screen recording | Cannot be prevented. A moving label with the viewer's wallet and session id makes leaks traceable. |

## Community safety

- Comments and reports require a signed-in wallet and are rate limited. A wallet can report an item once.
- Creators can remove comments on their videos. Administrators review reports and can take videos down or restore them.
- Administrator access is a list of wallet addresses in server configuration, never something a browser can claim.
- Withdrawals are signed by the creator's own wallet. The server only forwards intents for the signed-in address.

## Known limits

- A paying viewer's player receives the decryption key, so a determined person can extract it. Licensed DRM would
  raise the bar and is not included.
- The watermark is an overlay in the page. A burned-in per-viewer watermark would need server-side re-encoding.
- The spending key is stored in the browser. It is meant to hold small amounts.

## Secrets

`.env` is never committed. `SESSION_SECRET`, the database and Redis URLs, and R2 credentials are read from the
environment. The demo creator key is written to `tickstream/.data`, which is ignored by git.
