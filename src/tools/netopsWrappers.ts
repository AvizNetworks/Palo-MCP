import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeOpCommand, formatResponse, resolveTarget, isApiError } from "../api/client.js";
import { firewallName, xmlEscape } from "../schemas/panos.js";

function vsysName(): string {
  const vsys = (process.env.PANOS_VSYS || "vsys1").trim() || "vsys1";
  return xmlEscape(vsys);
}

/** Aviz NetOps wrappers for PAN-OS calls missing (or raw) in upstream Palo-MCP. */
export function registerNetopsWrapperTools(server: McpServer) {
  server.tool(
    "get_interface_counters",
    "[READ-ONLY] Retrieves packet, byte, drop, and error counters for all interfaces. Executes: show counter interface all.",
    { firewall: firewallName },
    { title: "Get Interface Counters", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await executeOpCommand(
        "<show><counter><interface>all</interface></counter></show>",
        target
      );
      return formatResponse(result);
    }
  );

  server.tool(
    "get_rule_hit_counts",
    "[READ-ONLY] Retrieves runtime hit counts for local security policy rules. Executes: show rule-hit-count vsys security all.",
    { firewall: firewallName },
    { title: "Get Rule Hit Counts", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const vsys = vsysName();
      const cmd =
        "<show><rule-hit-count><vsys><vsys-name>" +
        `<entry name="${vsys}"><rule-base><entry name="security">` +
        "<rules><all/></rules></entry></rule-base></entry>" +
        "</vsys-name></vsys></rule-hit-count></show>";
      const result = await executeOpCommand(cmd, target);
      return formatResponse(result);
    }
  );

  server.tool(
    "get_environmentals",
    "[READ-ONLY] Retrieves hardware temperature, fan, and power-supply readings. Executes: show system environmentals.",
    { firewall: firewallName },
    { title: "Get Environmentals", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await executeOpCommand(
        "<show><system><environmentals></environmentals></system></show>",
        target
      );
      return formatResponse(result);
    }
  );

  server.tool(
    "get_ntp_and_clock",
    "[READ-ONLY] Retrieves firewall clock and NTP synchronization state. Executes: show clock and show ntp.",
    { firewall: firewallName },
    { title: "Get NTP And Clock", readOnlyHint: true, destructiveHint: false },
    async ({ firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const [clock, ntp] = await Promise.all([
        executeOpCommand("<show><clock></clock></show>", target),
        executeOpCommand("<show><ntp></ntp></show>", target),
      ]);
      if (!clock.success) return formatResponse(clock);
      if (!ntp.success) return formatResponse(ntp);
      return formatResponse({
        success: true,
        data: { clock: clock.data, ntp: ntp.data },
      });
    }
  );
}
