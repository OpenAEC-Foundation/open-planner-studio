# syntax=docker/dockerfile:1
# Container van de headless API (docs/headless-api.md). Bouwen vanuit de ROOT van de repo:
#
#   docker build -f headless/server/Dockerfile -t open-planner-api .
#   docker run --rm -p 8080:8080 -e OPS_API_TOKEN=<token> open-planner-api
#
# Stap 1 bouwt het kernpakket reproduceerbaar uit de broncode (npm ci op de lockfile,
# scripts/build-core.mjs). Stap 2 bevat alleen Node, het gebouwde pakket en de twee serverbestanden.
# Geen token, geen configuratie en geen secrets in de image: alles via omgevingsvariabelen.
# node:22-bookworm-slim, vastgepind op de digest van de multi-platform-index (opgezocht 2026-10-21).
# Bijwerken: nieuwe digest van die tag opzoeken en hier zetten (zie docs/headless-api.md).
ARG NODE_IMAGE=node:22-bookworm-slim@sha256:3ed98443660ff48413b5af19ecefce3b9d50845a901a43420d47cc63a9fddbe9

FROM ${NODE_IMAGE} AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY LICENSE LICENSE.GPL ./
COPY scripts/build-core.mjs scripts/
COPY scripts/lib/third-party-notices.mjs scripts/lib/
COPY src/ src/
RUN node scripts/build-core.mjs --out /out/core

FROM ${NODE_IMAGE} AS runtime
LABEL org.opencontainers.image.title="Open Planner Studio headless API" \
      org.opencontainers.image.source="https://github.com/OpenAEC-Foundation/open-planner-studio" \
      org.opencontainers.image.licenses="LGPL-3.0-or-later"
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080
WORKDIR /app
# Eigendom root, alleen-lezen voor de gebruiker `node`: de server schrijft niets naar schijf.
COPY --from=build /out/core /app/node_modules/@openaec/open-planner-core
COPY headless/server/server.mjs headless/server/worker.mjs /app/
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --start-interval=2s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
STOPSIGNAL SIGTERM
CMD ["node", "server.mjs"]
