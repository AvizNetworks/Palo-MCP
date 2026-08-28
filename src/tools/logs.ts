import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeLogQuery, formatResponse, resolveTarget, isApiError } from "../api/client.js";
import { nlogsSchema, logQuery, logHoursSchema, firewallName } from "../schemas/panos.js";

function registerLogTool(
  server: McpServer,
  name: string,
  logType: string,
  description: string,
  queryHint: string
) {
  server.tool(
    name,
    description,
    {
      nlogs: nlogsSchema,
      hours: logHoursSchema,
      query: logQuery.describe(queryHint),
      firewall: firewallName,
    },
    { title: name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), readOnlyHint: true, destructiveHint: false },
    async ({ nlogs, hours, query, firewall }) => {
      const target = resolveTarget(firewall);
      if (isApiError(target)) return formatResponse(target);
      const result = await executeLogQuery(
        logType,
        nlogs || 20,
        query,
        target,
        hours
      );
      return formatResponse(result);
    }
  );
}

export function registerLogsTools(server: McpServer) {
  registerLogTool(
    server,
    "get_traffic_logs",
    "traffic",
    "[READ-ONLY] Retrieves traffic logs from the PanOS log API. Use hours for a time window (e.g. 24 = last 24h) and optional query filter.",
    "Optional extra filter (e.g., '( action eq deny )')"
  );

  registerLogTool(
    server,
    "get_threat_logs",
    "threat",
    "[READ-ONLY] Retrieves threat logs from the PanOS log API. Use hours for a time window and optional query filter.",
    "Optional extra filter (e.g., '( severity eq critical )')"
  );

  registerLogTool(
    server,
    "get_system_logs",
    "system",
    "[READ-ONLY] Retrieves system logs from the PanOS log API. Use hours for a time window (e.g. 24 = last 24h) and optional query filter.",
    "Optional extra filter (e.g., '( subtype eq commit )')"
  );

  registerLogTool(
    server,
    "get_config_logs",
    "config",
    "[READ-ONLY] Retrieves configuration change logs from the PanOS log API. Use hours for a time window and optional query filter.",
    "Optional extra filter"
  );

  registerLogTool(
    server,
    "get_url_filter_logs",
    "url",
    "[READ-ONLY] Retrieves URL filtering logs from the PanOS log API. Use hours for a time window and optional query filter.",
    "Optional extra filter (e.g., '( action eq block )')"
  );
}
