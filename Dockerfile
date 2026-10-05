# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# Wedding Studio — multi-stage image
#   docker build -t wedding-studio .            → production image
#   docker build --target test .                → runs the test suite
# ---------------------------------------------------------------------------
ARG NODE_VERSION=22

# 1) All dependencies (incl. dev). Native modules (better-sqlite3, sharp) ship prebuilt
#    binaries inside their npm packages, so no compiler/apt is needed and install scripts
#    are skipped (--ignore-scripts: faster, and no third-party code runs at build time).
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Behind a TLS-intercepting corporate proxy? Pass its CA without baking it into the image:
#   docker build --secret id=extra_ca,src=/path/to/proxy-ca.crt .
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npm ci --ignore-scripts --no-audit --no-fund \
 && node -e "require('better-sqlite3')(':memory:').close(); require('sharp')" \
 && echo "native modules OK"

# 2) Build the studio (Vite → dist/studio).
FROM deps AS build
COPY . .
RUN npm run build

# 3) Optional: run the test suite inside the image.
FROM build AS test
ENV NODE_ENV=test
RUN npm run template:validate && npm test

# 4) Production dependencies only (+ drop SQLite C sources and other-OS binaries, ~25MB).
FROM deps AS prod-deps
RUN npm prune --omit=dev --no-audit --no-fund \
 && cd node_modules/better-sqlite3 \
 && rm -rf deps src \
 && find prebuilds -type f ! -name "linux-$(node -p process.arch).node" -delete \
 && cd /app && node -e "require('better-sqlite3')(':memory:').close()"

# 5) Runtime image — small, non-root, no build tools.
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATA_DIR=/data \
    TEMPLATES_DIR=/app/templates
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node server ./server
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node templates ./templates
COPY --chown=node:node views ./views
COPY --chown=node:node public ./public
COPY --from=build --chown=node:node /app/dist ./dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
