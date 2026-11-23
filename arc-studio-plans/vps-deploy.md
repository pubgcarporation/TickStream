## Implementation Plan: TickStream on your own VPS

### Summary
Run all of TickStream on your VPS: the website, API, media worker, settlement worker, Postgres, Redis and the video files. One Docker Compose stack with Caddy in front for HTTPS. No Cloudflare Workers, D1 or Pages, so no rewrite. App code stays unchanged.

### Architecture
- Blockchain: Arc Testnet and USDC, unchanged. Payments still go through Circle Gateway nanopayments.
- Contract: none involved. The four contracts in `contracts/` stay unused by the app.
- Services (VPS):
  - Caddy serves the built website, handles HTTPS, forwards `/api` to the API. Only ports 80 and 443 are open.
  - API, media worker, settlement worker: existing three services using the existing Dockerfiles.
  - Postgres and Redis stay on the private Docker network, not published.
  - Videos stored on a Docker volume on the VPS disk (`STORAGE_DRIVER=local`).
- Frontend: existing Vite app built inside Docker. API address is `/api` on the same origin, so no code changes.
- Wallet and login: Privy app ID passed as a build argument. The live domain must be added to Privy allowed domains.
- Cloudflare: optional, DNS only. Keep the proxy (orange cloud) off for uploads and video, because its proxy limits upload size.

### Files to Create/Modify
1. `tickstream/infrastructure/docker/docker-compose.prod.yml`: production stack. Postgres, Redis, API, both workers, web. Only web publishes ports. Healthchecks, restart policies, log-size limits, one-shot step that sets write permission on the video volume.
2. `tickstream/infrastructure/docker/web.Dockerfile`: builds the website, serves it with Caddy.
3. `tickstream/infrastructure/docker/Caddyfile`: HTTPS for the domain (or plain HTTP on the IP), `/api` forwarding with streaming, fallback to `index.html`.
4. `tickstream/infrastructure/docker/.env.example`: domain, database password, session secret, Gateway URL, admin addresses, Privy app ID. Real values stay on the server only.
5. `tickstream/infrastructure/docker/backup.sh`: database dump and videos archive into `backups/`.
6. `.dockerignore` (project root): keeps `node_modules`, `.env` and local data out of the build.
7. `tickstream/.gitignore`: add `backups`.
8. `tickstream/docs/deployment.md`: "Deploy on a single VPS" guide: install, first start, firewall, updates, backups, restore, post-deploy checks.

### Build Sequence
1. Add the compose file, web Dockerfile, Caddyfile and env template.
2. Add the backup script and gitignore changes.
3. Update the deployment guide with exact commands.
4. Safety checks in order: `docker compose config` with example values; backup script syntax check; confirm the dev preview and local API still work; re-run lint and typecheck.
5. On the VPS, run `docker compose -f docker-compose.prod.yml up -d --build`, then check `ps` and API logs. A production website build cannot be run in the preview sandbox (out of memory), so the first VPS build is the real test.

### Done When
- [ ] `docker compose -f docker-compose.prod.yml config` passes with example values.
- [ ] Only ports 80 and 443 are published. Postgres, Redis and the API are not reachable from outside.
- [ ] `.env.example` lists every required value and contains no secrets.
- [ ] `backup.sh` passes a syntax check and writes both a database dump and a videos archive.
- [ ] Guide covers firewall (22, 80, 443), HTTPS, updates, backups and restore.
- [ ] No app source files changed; lint and typecheck still pass.
- [ ] On the VPS: site loads over HTTPS, a creator can upload a video, it encodes, and it plays after payment.

## Ready to build?
