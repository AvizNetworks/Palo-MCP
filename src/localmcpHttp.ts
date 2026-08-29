import http from "node:http";
import { URL } from "node:url";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { createPanosMcpServer, SERVER_VERSION } from "./createServer.js";

const SSE_PATH = "/mcp/sse";
const MESSAGES_PATH = "/mcp/messages";

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function unauthorized(res: http.ServerResponse): void {
  res.writeHead(401, { "Content-Type": "text/plain" });
  res.end("Unauthorized");
}

function checkMcpAuth(req: http.IncomingMessage): boolean {
  const expected = (process.env.MCP_API_TOKEN || "").trim();
  if (!expected) return true;

  const header = req.headers.authorization || "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : header.trim();
  return token === expected;
}

/**
 * NCP LocalMCP HTTP+SSE transport.
 * Compatible with ncp-api mcp_client (GET /mcp/sse, POST /mcp/messages?sessionId=...).
 */
export async function startLocalMcpHttp(): Promise<void> {
  const host = process.env.MCP_BIND_HOST || "0.0.0.0";
  const port = Number(process.env.MCP_PORT || process.env.MCP_SERVER_PORT || "8001");
  const enforceAuth = Boolean((process.env.MCP_API_TOKEN || "").trim());

  const transports = new Map<string, SSEServerTransport>();

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      const path = url.pathname;

      if (req.method === "GET" && path === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, version: SERVER_VERSION, transport: "sse" }));
        return;
      }

      if (enforceAuth && !checkMcpAuth(req)) {
        unauthorized(res);
        return;
      }

      if (req.method === "GET" && path === SSE_PATH) {
        const transport = new SSEServerTransport(MESSAGES_PATH, res, {
          enableDnsRebindingProtection: false,
        });
        const sessionId = transport.sessionId;
        transports.set(sessionId, transport);
        transport.onclose = () => {
          transports.delete(sessionId);
        };

        const mcp = createPanosMcpServer();
        await mcp.connect(transport);
        return;
      }

      if (req.method === "POST" && path === MESSAGES_PATH) {
        const sessionId = url.searchParams.get("sessionId");
        if (!sessionId) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Missing sessionId");
          return;
        }
        const transport = transports.get(sessionId);
        if (!transport) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Session not found");
          return;
        }

        const raw = await readBody(req);
        let parsed: unknown = undefined;
        if (raw) {
          try {
            parsed = JSON.parse(raw);
          } catch {
            res.writeHead(400, { "Content-Type": "text/plain" });
            res.end("Invalid JSON body");
            return;
          }
        }
        await transport.handlePostMessage(req, res, parsed);
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    } catch (error) {
      process.stderr.write(
        `[ncp-paloalto-mcp] request error: ${error instanceof Error ? error.message : String(error)}\n`
      );
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Internal server error");
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const authNote = enforceAuth ? "MCP_API_TOKEN required" : "no MCP auth token set";
      process.stderr.write(
        `[ncp-paloalto-mcp] LocalMCP SSE listening on http://${host}:${port}${SSE_PATH} (${authNote})\n`
      );
      resolve();
    });
  });
}
