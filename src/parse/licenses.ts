/** Normalize PAN-OS license info responses. */

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function flatten(value: unknown): unknown {
  if (value && typeof value === "object" && "#text" in (value as object)) {
    return (value as Record<string, unknown>)["#text"];
  }
  return value;
}

function flattenEntry(entry: unknown): Record<string, unknown> {
  if (!entry || typeof entry !== "object") return { value: entry };
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry as Record<string, unknown>)) {
    out[key] = flatten(value);
  }
  return out;
}

export function normalizeLicenses(data: unknown): Record<string, unknown> {
  if (data == null) {
    return { licenses: [], count: 0, has_entries: false };
  }

  const root = data as Record<string, unknown>;
  let entries: Record<string, unknown>[] = [];

  const licenses = root.licenses as Record<string, unknown> | undefined;
  if (licenses?.entry != null) {
    entries = asArray(licenses.entry).map(flattenEntry);
  } else if (root.entry != null) {
    entries = asArray(root.entry).map(flattenEntry);
  } else if (root.result && typeof root.result === "object") {
    return normalizeLicenses(root.result);
  }

  return {
    licenses: entries,
    count: entries.length,
    has_entries: entries.length > 0,
  };
}
