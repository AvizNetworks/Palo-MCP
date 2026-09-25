# Aviz NCP LocalMCP image for the Palo-MCP fork.
# Build with a NON-lab tag so the running demo (v1.7.0 Python POC) is untouched:
#   docker build -t aviz/ncp-paloalto-mcp:community-dev .
#
# Do NOT retag over aviz/ncp-paloalto-mcp:v1.7.0 until lab cutover (Step 6).
#
# Security: Alpine instead of Debian bookworm-slim (drops the unpatched
# perl/util-linux/ncurses/systemd/zlib Debian findings), production
# node_modules are resolved in the build stage, and npm/npx/corepack/yarn are
# removed from the runtime image (nothing runs them; CMD is plain `node`).

FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
# Skip lifecycle scripts; compile explicitly, then drop dev dependencies.
RUN npm ci --ignore-scripts && npm run build && npm prune --omit=dev --ignore-scripts

FROM node:22-alpine

RUN apk upgrade --no-cache \
    && apk add --no-cache ca-certificates \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
       /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
       /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg

WORKDIR /app
COPY package.json package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY scripts/start-localmcp.sh ./scripts/start-localmcp.sh
RUN chmod +x ./scripts/start-localmcp.sh

ENV LOCAL_MCP_MODE=true \
    MCP_TRANSPORT=sse \
    MCP_BIND_HOST=0.0.0.0 \
    MCP_PORT=8001 \
    MCP_SERVER_PORT=8001 \
    PANOS_VERIFY_TLS=true \
    PANOS_VSYS=vsys1 \
    NODE_ENV=production

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "scripts/start-localmcp.sh"]
