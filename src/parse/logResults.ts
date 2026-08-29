/** Normalize PAN-OS log API poll payloads for agents and UIs. */

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

export function extractJobId(job: unknown): string | null {
  if (job == null) return null;
  if (typeof job === "string" || typeof job === "number") return String(job);
  if (typeof job === "object") {
    const obj = job as Record<string, unknown>;
    const id = obj.id ?? obj["#text"];
    if (id != null) return String(id);
  }
  return null;
}

export function formatPanOsLogTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/** Build PAN-OS log query filter for a relative hours lookback. */
export function buildLogTimeQuery(hours: number, extraQuery?: string): string {
  const since = new Date(Date.now() - hours * 3_600_000);
  const timePart = `( receive_time geq '${formatPanOsLogTime(since)}' )`;
  const extra = extraQuery?.trim();
  if (!extra) return timePart;
  return `( ${timePart} and ${extra} )`;
}

export function normalizeLogResults(raw: unknown): Record<string, unknown> {
  const root = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const countRaw = root["@_count"] ?? root["@count"];
  const count = countRaw != null ? Number(countRaw) : null;
  const entries = asArray(root.entry).map((entry) => flattenLogEntry(entry));

  return {
    count: Number.isFinite(count) ? count : entries.length,
    progress: root["@_progress"] ?? root["@progress"] ?? null,
    entries,
    has_entries: entries.length > 0,
  };
}

function flattenLogEntry(entry: unknown): Record<string, unknown> {
  if (!entry || typeof entry !== "object") return { value: entry };
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry as Record<string, unknown>)) {
    if (value && typeof value === "object" && "#text" in (value as object)) {
      out[key] = (value as Record<string, unknown>)["#text"];
    } else {
      out[key] = value;
    }
  }
  return out;
}
