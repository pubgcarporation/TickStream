# Builds the website and serves it with Caddy, which also forwards /api to the API.
FROM oven/bun:1.3 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ARG VITE_PRIVY_APP_ID=""
ENV VITE_PRIVY_APP_ID=$VITE_PRIVY_APP_ID
RUN bun run build

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
