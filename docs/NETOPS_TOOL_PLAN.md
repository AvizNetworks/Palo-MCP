# NetOps tool plan (Step 1)

Pinned upstream: **apius-tech/Palo-MCP** `1.3.29` @ `4c2cea5`.

Goal: same NetOps coverage as the lab demo, via community tools + a few
custom wrappers. Chat gets an **allowlist**, not the full 117-tool catalog.
No Panorama.

## Coverage vs current Aviz demo tools

| Our demo tool | Community tool | Source |
| --- | --- | --- |
| `get_firewall_info` | `get_firewall_info` | Community |
| `get_ha_status` | `get_ha_status` | Community |
| `get_active_sessions` | `get_active_sessions` | Community |
| `get_system_resources` | `get_system_resources` (raw `top`) | **Custom wrapper** (labeled CPU/RAM/`pan_task`) |
| `get_interfaces` | `get_interfaces` | Community |
| `get_interface_counters` | — | **Custom wrapper** |
| `get_zones` | `get_zones` | Community |
| `get_routing_table` | `get_routing_table` | Community |
| `get_security_rules` | `get_security_rules` | Community |
| `get_nat_rules` | `get_nat_rules` | Community |
| `get_rule_hit_counts` | — | **Custom wrapper** |
| `get_address_objects` | `get_address_objects` | Community |
| `get_service_objects` | `get_service_objects` | Community |
| `get_traffic_logs` | `get_traffic_logs` | Community |
| `get_threat_logs` | `get_threat_logs` | Community |
| `get_environmentals` | — | **Custom wrapper** |
| `get_licenses` | `get_licenses` | Community |
| `get_content_versions` | `get_content_versions` | Community |
| `get_ntp_and_clock` | — | **Custom wrapper** |
| `get_system_logs` | `get_system_logs` | Community |
| `get_config_logs` | `get_config_logs` | Community |
| `create_security_rule` | `add_security_rule` | Community + **agent confirm** |
| `commit_firewall_config` | `commit` | Community + **agent confirm** |

## Chat allowlist

Community reads + wrappers + two writes (`add_security_rule`, `commit`).
See `ncp-sdk-agent/ncp.toml`.

## Custom wrappers (in this fork)

Registered by `src/tools/netopsWrappers.ts`; `get_system_resources` is
parsed in-place by `src/parse/systemResources.ts`.

| Wrapper | PAN-OS call | Why |
| --- | --- | --- |
| Labeled system resources | `show system resources` + parse | Community returns unstructured `top` |
| Interface counters | `show counter interface all` | Missing upstream |
| Rule hit counts | `show rule-hit-count ...` | Missing upstream |
| Environmentals | `show system environmentals` | Missing upstream |
| NTP + clock | `show clock` + `show ntp` | Missing upstream |

## Explicitly not allowlisted

- All `panorama_*` tools
- `delete_*`, `set_config`, `delete_config`, `run_op_command`
- Broad object/VPN/admin write tools until product asks for them

## Confirm-before-write

Upstream `add_security_rule` / `commit` have **no** confirmation token.
Until we add server-side guards in this fork, the **agent** must:

1. Preview / explain the change
2. Wait for explicit user yes
3. Only then call the write tool
4. Keep commit as a separate confirmed step

Prefer creating rules **disabled** unless the user asks otherwise.
