import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerFirewallTools } from "./tools/firewalls.js";
import { registerSystemTools } from "./tools/system.js";
import { registerNetworkTools } from "./tools/network.js";
import { registerSecurityTools } from "./tools/security.js";
import { registerObjectsTools } from "./tools/objects.js";
import { registerNatTools } from "./tools/nat.js";
import { registerUserIdTools } from "./tools/userid.js";
import { registerAdminTools } from "./tools/admin.js";
import { registerVpnTools } from "./tools/vpn.js";
import { registerPanoramaTools } from "./tools/panorama.js";
import { registerLogsTools } from "./tools/logs.js";
import { registerThreatTools } from "./tools/threat.js";
import { registerCertificatesTools } from "./tools/certificates.js";
import { registerLicensesTools } from "./tools/licenses.js";
import { registerConfigTools } from "./tools/config.js";
import { registerUtilityTools } from "./tools/utility.js";
import { registerNetopsWrapperTools } from "./tools/netopsWrappers.js";

const SERVER_VERSION = "1.3.29";

/** Create a fully registered PAN-OS MCP server (one instance per SSE session). */
export function createPanosMcpServer(): McpServer {
  const server = new McpServer({
    name: "panos-mcp",
    version: SERVER_VERSION,
  });

  // Wrap all tool handlers to catch unexpected errors cleanly
  const _tool = server.tool.bind(server);
  (server.tool as any) = function (...args: any[]) {
    const last = args.length - 1;
    const handler = args[last];
    args[last] = async (...hArgs: any[]) => {
      try {
        return await handler(...hArgs);
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    };
    return (_tool as (...a: any[]) => any)(...args);
  };

  registerFirewallTools(server);
  registerSystemTools(server);
  registerNetworkTools(server);
  registerSecurityTools(server);
  registerObjectsTools(server);
  registerNatTools(server);
  registerUserIdTools(server);
  registerAdminTools(server);
  registerVpnTools(server);
  registerPanoramaTools(server);
  registerLogsTools(server);
  registerThreatTools(server);
  registerCertificatesTools(server);
  registerLicensesTools(server);
  registerConfigTools(server);
  registerUtilityTools(server);
  registerNetopsWrapperTools(server);

  return server;
}

export { SERVER_VERSION };
