FROM oven/bun:1.3 AS app
WORKDIR /app
ENV NODE_ENV=production

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY tsconfig.json ./
COPY src/onchain-facts.ts src/onchain-money.ts ./src/
COPY tickstream/tsconfig.json ./tickstream/tsconfig.json
COPY tickstream/packages ./tickstream/packages
COPY tickstream/apps/settlement-worker ./tickstream/apps/settlement-worker

USER bun
CMD ["bun", "run", "tickstream/apps/settlement-worker/src/index.ts"]
