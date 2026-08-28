import { z } from "zod";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import { getKey, setKey, isKeychainAvailable, initKeychain } from "./keychain.js";

export interface FirewallEntry {
  name: string;
  host: string;
  api_key: string;
  verify_ssl: boolean;
}

const firewallFileEntrySchema = z.object({
  name: z.string().min(1).max(63),
  host: z.string().min(1),
  api_key: z.string().optional(),
  verify_ssl: z.boolean().optional(),
});

const firewallConfigSchema = z.object({
  firewalls: z.array(firewallFileEntrySchema).min(1),
});

function sanitizeHost(host: string): string {
  return host.replace(/^https?:\/\//, "").replace(/\/+$/, "").trim();
}

function parseEnvBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === "") return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

/** Runtime-only firewall (NCP LocalMCP env); does not write firewalls.json. */
export function setRuntimeFirewall(entry: FirewallEntry): void {
  const host = sanitizeHost(entry.host);
  entries = [{ name: entry.name, host, verify_ssl: entry.verify_ssl }];
  keyMap.clear();
  keyMap.set(entry.name, entry.api_key);
}

/**
 * Seed a single firewall from NCP container env (PANOS_*).
 * Prefer API key; otherwise keygen with username/password.
 * TLS verify defaults to true (lab can set PANOS_VERIFY_TLS=false).
 */
export async function ensureNcpEnvFirewall(): Promise<void> {
  if (entries.length > 0) return;

  const host = sanitizeHost(process.env.PANOS_HOST ?? "");
  if (!host) return;

  const verify_ssl = parseEnvBool(process.env.PANOS_VERIFY_TLS, true);
  let api_key = (process.env.PANOS_API_KEY ?? "").trim();

  if (!api_key) {
    const username = (process.env.PANOS_USERNAME ?? "").trim();
    const password = process.env.PANOS_PASSWORD ?? "";
    if (username && password) {
      const { generateApiKey } = await import("../api/client.js");
      const result = await generateApiKey(host, username, password, verify_ssl);
      if (!result.success || !result.data?.key) {
        throw new Error(
          `PAN-OS keygen failed: ${result.error || "no key returned"}`
        );
      }
      api_key = String(result.data.key);
      process.stderr.write("[ncp-paloalto-mcp] Generated API key from PANOS_USERNAME/PASSWORD\n");
    }
  }

  if (!api_key) return;

  setRuntimeFirewall({ name: "env", host, api_key, verify_ssl });
  process.stderr.write(
    `[ncp-paloalto-mcp] Using firewall env host=${host} verify_ssl=${verify_ssl}\n`
  );
}

let entries: Array<{ name: string; host: string; verify_ssl: boolean }> = [];
const keyMap = new Map<string, string>();

const defaultConfigPath = join(homedir(), ".config", "panos-mcp", "firewalls.json");

export function getConfigPath(): string {
  return process.env.PANOS_FIREWALLS_CONFIG ?? defaultConfigPath;
}

export async function loadFirewallConfig(): Promise<void> {
  entries = [];
  keyMap.clear();

  await initKeychain();

  const configPath = getConfigPath();

  let raw: string;
  try {
    raw = readFileSync(configPath, "utf-8");
  } catch {
    return;
  }

  const parsed = firewallConfigSchema.parse(JSON.parse(raw));
  const fileEntries = parsed.firewalls.map((e) => ({
    name: e.name,
    host: sanitizeHost(e.host),
    api_key: e.api_key,
    verify_ssl: e.verify_ssl ?? false,
  }));

  // Auto-migrate plaintext api_key fields to OS keychain
  if (isKeychainAvailable()) {
    const toMigrate = fileEntries.filter((e) => e.api_key);
    if (toMigrate.length > 0) {
      try {
        for (const e of toMigrate) {
          await setKey(e.name, e.api_key!);
        }
        const cleaned = { firewalls: fileEntries.map(({ name, host }) => ({ name, host })) };
        writeFileSync(configPath, JSON.stringify(cleaned, null, 2) + "\n");
        process.stderr.write(
          `[panos-mcp] Migrated ${toMigrate.length} API key(s) to system keychain\n`
        );
      } catch (err) {
        process.stderr.write(
          `[panos-mcp] ERROR: Migration failed — ${String(err)}. Keys remain in plaintext.\n`
        );
      }
    }
  }

  entries = fileEntries.map(({ name, host, verify_ssl }) => ({ name, host, verify_ssl }));

  // Load keys into memory
  for (const e of entries) {
    if (isKeychainAvailable()) {
      const fileEntry = fileEntries.find((f) => f.name === e.name);
      const key = (await getKey(e.name)) ?? fileEntry?.api_key ?? null;
      if (key) {
        keyMap.set(e.name, key);
      } else {
        process.stderr.write(
          `[panos-mcp] WARNING: No keychain entry for firewall "${e.name}" — it will be unavailable\n`
        );
      }
    } else {
      // Fallback: read api_key directly from file entry
      const fileEntry = fileEntries.find((f) => f.name === e.name);
      if (fileEntry?.api_key) keyMap.set(e.name, fileEntry.api_key);
    }
  }
}

export function resolveFirewall(name?: string): FirewallEntry | null {
  if (name) {
    const e = entries.find((e) => e.name === name);
    if (!e) return null;
    const key = keyMap.get(e.name);
    if (!key) return null;
    return { ...e, api_key: key };
  }

  if (entries.length === 1) {
    const e = entries[0];
    const key = keyMap.get(e.name);
    if (!key) return null;
    return { ...e, api_key: key };
  }

  if (entries.length > 1) return null;

  // No config entries — fall back to env vars
  const host = sanitizeHost(process.env.PANOS_HOST ?? "");
  const api_key = (process.env.PANOS_API_KEY ?? "").trim();
  // Aviz/NCP default: verify TLS unless explicitly disabled (lab self-signed).
  if (host && api_key) {
    return {
      name: "env",
      host,
      api_key,
      verify_ssl: parseEnvBool(process.env.PANOS_VERIFY_TLS, true),
    };
  }

  return null;
}

export function isMultiFirewall(): boolean {
  return entries.length > 1;
}

export function getFirewallEntries(): Array<{ name: string; host: string; verify_ssl: boolean }> {
  return entries;
}

export async function saveFirewallEntry(entry: FirewallEntry): Promise<void> {
  await initKeychain();
  entry = { ...entry, host: sanitizeHost(entry.host) };
  const configPath = getConfigPath();
  mkdirSync(dirname(configPath), { recursive: true, mode: 0o700 });

  let config: { firewalls: Array<{ name: string; host: string; api_key?: string }> };
  try {
    const raw = readFileSync(configPath, "utf-8");
    config = JSON.parse(raw);
    if (!Array.isArray(config.firewalls)) config = { firewalls: [] };
  } catch {
    config = { firewalls: [] };
  }

  if (isKeychainAvailable()) {
    await setKey(entry.name, entry.api_key);
    const fileEntry = { name: entry.name, host: entry.host };
    const idx = config.firewalls.findIndex((e) => e.name === entry.name);
    if (idx >= 0) config.firewalls[idx] = fileEntry;
    else config.firewalls.push(fileEntry);
  } else {
    const idx = config.firewalls.findIndex((e) => e.name === entry.name);
    if (idx >= 0) config.firewalls[idx] = { name: entry.name, host: entry.host, api_key: entry.api_key };
    else config.firewalls.push({ name: entry.name, host: entry.host, api_key: entry.api_key });
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });

  // Update in-memory state directly (avoids re-reading file and keychain)
  const memIdx = entries.findIndex((e) => e.name === entry.name);
  if (memIdx >= 0) entries[memIdx] = { name: entry.name, host: entry.host, verify_ssl: entry.verify_ssl };
  else entries.push({ name: entry.name, host: entry.host, verify_ssl: entry.verify_ssl });
  keyMap.set(entry.name, entry.api_key);
}
