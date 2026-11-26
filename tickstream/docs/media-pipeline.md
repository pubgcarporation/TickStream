# Media pipeline

1. A creator creates the video record, then uploads the file with `PUT /videos/:id/source`. The file is streamed to
   private storage and a job is queued in Redis.
2. The media worker downloads the source, probes it, and rejects files with no video or an unsupported length.
3. ffmpeg re-encodes to H.264 and AAC (720p at most) and cuts 3-second MPEG-TS segments, encrypted with AES-128 using a
   fresh key and IV per video.
4. Segments and a thumbnail are written to storage. The segment list, IV and key are saved on the video record.
5. The video is marked `ready` and appears in Explore.

Storage is selected with `STORAGE_DRIVER`. `local` writes under `tickstream/.data/storage`. `r2` uses a private
Cloudflare R2 bucket through its S3-compatible API and needs `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY` and `R2_BUCKET`. Keep the bucket private: all reads go through the API after a payment check.

## Re-encoding older videos

Videos encoded with another segment length keep working (they are paid one segment at a time) but should be brought to
3 seconds. From `tickstream/infrastructure/docker`:

```bash
docker compose -f docker-compose.prod.yml exec media-worker bun run tickstream/apps/media-worker/src/reencode.ts --dry-run
docker compose -f docker-compose.prod.yml exec media-worker bun run tickstream/apps/media-worker/src/reencode.ts
```

The first command only lists them. The job re-encodes each video from its stored original into new segment files and a
new key, switches the video over in one update, then deletes the old segments. A video with no stored original is listed
as needing a re-upload.
