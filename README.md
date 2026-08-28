# NCP Palo Alto MCP

Aviz Networks fork of [apius-tech/Palo-MCP](https://github.com/apius-tech/Palo-MCP) for use as an
NCP **Local MCP** connector (same pattern as `nexus-dashboard-mcp`).

## Why this repo

- **Upstream:** community PAN-OS MCP (pinned; do not float on `main`)
- **NCP:** package as `aviz/ncp-paloalto-mcp` and start via Local MCP tab
- **NetOps surface:** agent allowlist of useful tools only — not all 117 tools
- **Gaps:** custom XML wrappers for interface counters, rule hit counts,
  labeled CPU/RAM, environmentals, and NTP (see `docs/NETOPS_TOOL_PLAN.md`)

## Upstream pin

| Field | Value |
| --- | --- |
| Upstream | https://github.com/apius-tech/Palo-MCP |
| Version | 1.3.29 |
| Commit | `4c2cea57677ee2a204e01eff8705229c14b2134b` |

```bash
git fetch upstream
git log -1 upstream/main   # or a release tag
```

## LocalMCP

Endpoints expected by ncp-api:

| Path | Method | Purpose |
| --- | --- | --- |
| `/mcp/sse` | GET | MCP SSE stream |
| `/mcp/messages?sessionId=…` | POST | JSON-RPC messages |
| `/health` | GET | Container health |

Env vars match what ncp-api injects for Palo Alto LocalMCP
(`PANOS_HOST`, `PANOS_API_KEY` or username/password, `PANOS_VERIFY_TLS`,
`MCP_API_TOKEN`, `MCP_TRANSPORT=sse`, port `8001`).

**TLS:** `PANOS_VERIFY_TLS` defaults to `true` in this fork. Lab self-signed
firewalls should set `false` explicitly (ncp-api already passes connector
`verify_ssl`).

### Image

ncp-api starts `aviz/ncp-paloalto-mcp:${PALOALTO_MCP_IMAGE_TAG}` (default
`community-dev`). This is **not** `DATA_CONNECTORS_IMAGE_TAG` — the Kafka
API collector stays on `aviz/ncp-firewall-collector:<shared-tag>`.

```bash
docker build -t aviz/ncp-paloalto-mcp:community-dev .
```

Do **not** retag over `:v1.7.0` / `:v1.8.0` (those were the retired Python POC).

Local stdio (unchanged upstream behavior):

```bash
npm ci && npm start
```

## Agent

Custom agent package: `ncp-sdk-agent/` (`panos-mcp-agent` 0.2.0).
Allowlist is community tool names plus Aviz wrappers. Writes are
`add_security_rule` and `commit` with agent-side confirm-before-call.

```bash
ncp validate ncp-sdk-agent
ncp pack ncp-sdk-agent
ncp onboard ncp-sdk-agent
```

Chat with `/panos-mcp-agent` on a project that has the Palo Alto Local MCP
connector assigned.

## Status

- **Step 1 (done):** tool coverage map → `docs/NETOPS_TOOL_PLAN.md`
- **Step 2 (done):** LocalMCP SSE entrypoint + Dockerfile + TLS defaults
- **Step 3 (done):** ncp-api uses `PALOALTO_MCP_IMAGE_TAG` (not the POC image)
- **Step 4 (done):** agent allowlist + confirm-before-write
- **Step 5 (done):** custom gap wrappers in this fork
- **Step 6:** lab chat validation

## Not in scope (for now)

- Panorama tools
- Shipping all write/delete/`run_op_command` tools to chat
- Replacing the Kafka API collector path

## License

MIT (same as upstream Palo-MCP). Upstream README preserved at
`docs/UPSTREAM_README.md`.
