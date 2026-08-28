#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadFirewallConfig, ensureNcpEnvFirewall } from "./config/firewalls.js";
import { isKeychainAvailable } from "./config/keychain.js";
import { describeProxy } from "./api/proxy.js";
import { createPanosMcpServer } from "./createServer.js";
import { startLocalMcpHttp } from "./localmcpHttp.js";

async function bootstrap(): Promise<void> {
  await loadFirewallConfig();
  await ensureNcpEnvFirewall();

  if (!isKeychainAvailable()) {
    process.stderr.write(
      "[panos-mcp] WARNING: System keychain unavailable — API keys are stored in plaintext. " +
        "Install a keychain provider (macOS Keychain, libsecret on Linux, Windows Credential Manager) " +
        "and re-run `panos-mcp keygen` to migrate keys to secure storage.\n"
    );
  }
  const proxy = describeProxy();
  if (proxy) {
    console.error(`PanOS proxy: ${proxy}`);
  }
}

async function main(): Promise<void> {
  await bootstrap();

  const transport = (process.env.MCP_TRANSPORT || "stdio").trim().toLowerCase();
  const localMcp = ["1", "true", "yes", "on"].includes(
    (process.env.LOCAL_MCP_MODE || "").trim().toLowerCase()
  );

  if (transport === "sse" || localMcp) {
    await startLocalMcpHttp();
    return;
  }

  const server = createPanosMcpServer();
  await server.connect(new StdioServerTransport());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
