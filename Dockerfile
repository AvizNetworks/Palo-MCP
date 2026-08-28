# Aviz NCP LocalMCP image for the Palo-MCP fork.
# Build with a NON-lab tag so the running demo (v1.7.0 Python POC) is untouched:
#   docker build -t aviz/ncp-paloalto-mcp:community-dev .
#
# Do NOT retag over aviz/ncp-paloalto-mcp:v1.7.0 until lab cutover (Step 6).

FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
# Skip lifecycle scripts; compile explicitly.
RUN npm ci --ignore-scripts && npm run build

FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts \
    && apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

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
