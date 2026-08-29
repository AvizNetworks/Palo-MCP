import { z } from "zod";

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const configXpath = z
  .string()
  .startsWith("/config")
  .describe("XPath to a configuration location (must start with '/config')");

export const deviceGroup = z
  .string()
  .min(1)
  .describe("Name of the device group");

export const nlogsSchema = z
  .number()
  .int()
  .min(1)
  .max(5000)
  .optional()
  .describe("Number of logs to retrieve (default: 20, max: 5000)");

export const xmlElement = z
  .string()
  .min(1)
  .startsWith("<")
  .describe("XML element string (must start with '<')");

export const xmlCommand = z
  .string()
  .min(1)
  .startsWith("<")
  .describe("XML operational command (must start with '<')");

export const commitDescription = z
  .string()
  .max(512)
  .optional()
  .describe("Optional commit description/comment");

export const partialAdmin = z
  .string()
  .min(1)
  .max(63)
  .optional()
  .describe("Commit only changes made by this admin user");

export const logQuery = z
  .string()
  .max(2048)
  .optional()
  .describe("Filter query for log retrieval");

export const logHoursSchema = z
  .number()
  .int()
  .min(1)
  .max(168)
  .optional()
  .describe(
    "Optional lookback window in hours. Builds a receive_time filter (e.g. 24 = last 24 hours)."
  );

export const firewallName = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().min(1).max(63).optional()
).describe(
  "Optional named firewall target. For NCP LocalMCP leave unset — the connector already targets one firewall. Only pass a name when multiple firewalls are configured."
);

export const firewallHost = z
  .string()
  .min(1)
  .describe("Firewall hostname or IP address");

export const username = z
  .string()
  .min(1)
  .describe("PanOS admin username");

export const password = z
  .string()
  .min(1)
  .describe("PanOS admin password");

export const saveName = z
  .string()
  .min(1)
  .max(63)
  .optional()
  .describe("If provided, save the firewall entry to firewalls.json under this name");
