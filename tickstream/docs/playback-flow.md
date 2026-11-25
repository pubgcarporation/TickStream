# Playback flow

1. `POST /videos/:id/sessions` creates a session. Starting a session ends any other active session for the same wallet,
   so one wallet watches in one place at a time.
2. The player pays the first two seconds (see `payment-flow.md`). The server then lists only the paid segments in the
   playlist. Unpaid segments are not in the playlist and are refused if requested directly.
3. The player loads `GET /play/:session/playlist.m3u8`. The playlist grows by one segment per payment. Segment and key
   requests carry the viewer's sign-in token and the session id.
4. Each time a new second starts playing, the player pays for the following one. If the video is paused, it
   does not pay.
5. Jumping ahead to video that is not unlocked starts a new playlist window at that point. Skipped video is never billed,
   and segments already paid for in the session stay unlocked.
6. Closing the tab, pausing for long, or ending the session stops payments. A session with no activity for 90 seconds is
   dropped.

## Free preview and resuming

- A creator can make the first 5 to 60 seconds free. A session that starts from the beginning unlocks those segments
  without a payment. Payments begin when the preview is about to run out.
- The page saves the viewer's position every 20 seconds and when they leave. The next visit offers "Resume at".

## What the page shows

- **Cost so far** is price per second times the seconds that actually played.
- **Paid ahead** is what has been paid beyond what has played.
- **Your cap** is enforced by the server.
