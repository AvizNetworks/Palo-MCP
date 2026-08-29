#!/bin/sh
# NCP LocalMCP entrypoint. SSE on :8001 for aviz-shared-network.
# Does not touch the Kafka API collector path.
set -eu

export LOCAL_MCP_MODE="${LOCAL_MCP_MODE:-true}"
export MCP_TRANSPORT="${MCP_TRANSPORT:-sse}"
export MCP_BIND_HOST="${MCP_BIND_HOST:-0.0.0.0}"
export MCP_PORT="${MCP_PORT:-${MCP_SERVER_PORT:-8001}}"
export MCP_SERVER_PORT="${MCP_SERVER_PORT:-8001}"

echo "LocalMCP: starting ncp-paloalto-mcp on ${MCP_BIND_HOST}:${MCP_PORT} (${MCP_TRANSPORT})"
exec node /app/dist/index.js
