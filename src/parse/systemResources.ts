export const PRESENTATION_RULES = [
  "system_cpu is the only overall CPU figure. Report user_pct / idle_pct from there.",
  "top_processes[].percent_cpu is per-core. Several pan_task rows at ~90-100 is normal PAN-OS data-plane behavior, including when active sessions are 0.",
  "Do not average process percent_cpu into overall CPU, and do not call that an incident by itself.",
  "memory.used_pct is RAM. Never label it as CPU.",
  "Do not assume core count from the hardware model. Use observed_logical_cpus only if present.",
  "Do not recommend reboot or config changes unless the user asks for remediation.",
];

const LOAD_RE = /load average:\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/i;
const CPU_RE = /%Cpu\(s\):\s*([\d.]+)\s*us,\s*([\d.]+)\s*sy,\s*([\d.]+)\s*ni,\s*([\d.]+)\s*id/i;
const MEM_RE =
  /MiB Mem\s*:\s*([\d.]+)\s*total,\s*([\d.]+)\s*free,\s*([\d.]+)\s*used,\s*([\d.]+)\s*buff\/cache/i;
const SWAP_RE = /MiB Swap:\s*([\d.]+)\s*total,\s*([\d.]+)\s*free,\s*([\d.]+)\s*used/i;
const RCUC_RE = /rcuc\/(\d+)/g;
const PROC_RE = /^\s*(\d+)\s+.*?\s([RSDZTW])\s+([\d.]+)\s+([\d.]+)\s+(\S+)\s+(\S+)\s*$/;

export function asText(data: unknown): string {
  if (data == null) return "";
  if (typeof data === "string") return data;
  if (typeof data === "number" || typeof data === "boolean") return String(data);
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj["#text"] === "string") return obj["#text"];
    if (typeof obj.data === "string") return obj.data;
  }
  return "";
}

function pct(used: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((used / total) * 1000) / 10;
}

export function parseSystemResources(
  raw: unknown,
  processLimit = 8
): Record<string, unknown> {
  const text = asText(raw);
  const lines = text.split(/\r?\n/);
  const parsed: Record<string, unknown> = {
    parse_ok: false,
    presentation_rules: PRESENTATION_RULES,
    header: lines.slice(0, 6).join("\n").trim(),
  };

  const load = LOAD_RE.exec(text);
  const cpu = CPU_RE.exec(text);
  const mem = MEM_RE.exec(text);
  const swap = SWAP_RE.exec(text);
  if (!load || !cpu || !mem) {
    parsed.parse_error = "Could not parse top header; see header/raw_excerpt";
    parsed.raw_excerpt = lines.slice(0, 12).join("\n");
    return parsed;
  }

  const userPct = Number(cpu[1]);
  const systemPct = Number(cpu[2]);
  const nicePct = Number(cpu[3]);
  const idlePct = Number(cpu[4]);
  const memTotal = Number(mem[1]);
  const memFree = Number(mem[2]);
  const memUsed = Number(mem[3]);
  const memCache = Number(mem[4]);

  const processes: Array<Record<string, unknown>> = [];
  for (const line of lines) {
    const match = PROC_RE.exec(line);
    if (!match) continue;
    processes.push({
      pid: Number(match[1]),
      percent_cpu: Number(match[3]),
      percent_mem: Number(match[4]),
      command: match[6],
    });
    if (processes.length >= processLimit) break;
  }

  const rcuc = [...text.matchAll(RCUC_RE)].map((m) => Number(m[1]));
  const observed = rcuc.length ? Math.max(...rcuc) + 1 : null;

  parsed.parse_ok = true;
  parsed.load_average = {
    "1min": Number(load[1]),
    "5min": Number(load[2]),
    "15min": Number(load[3]),
  };
  parsed.system_cpu = {
    user_pct: userPct,
    system_pct: systemPct,
    nice_pct: nicePct,
    idle_pct: idlePct,
    busy_pct: Math.round((userPct + systemPct + nicePct) * 10) / 10,
    scope: "all_cores_combined",
  };
  parsed.memory = {
    total_mib: memTotal,
    used_mib: memUsed,
    free_mib: memFree,
    buff_cache_mib: memCache,
    used_pct: pct(memUsed, memTotal),
    scope: "ram",
  };
  parsed.top_processes = processes;
  parsed.observed_logical_cpus = observed;

  if (swap) {
    const swapTotal = Number(swap[1]);
    const swapUsed = Number(swap[3]);
    parsed.swap = {
      total_mib: swapTotal,
      free_mib: Number(swap[2]),
      used_mib: swapUsed,
      used_pct: pct(swapUsed, swapTotal),
    };
  }

  parsed.labeled_summary = buildLabeledSummary(parsed);
  return parsed;
}

function buildLabeledSummary(parsed: Record<string, unknown>): Record<string, unknown> {
  const cpu = parsed.system_cpu as Record<string, number>;
  const mem = parsed.memory as Record<string, number>;
  const load = parsed.load_average as Record<string, number>;
  const top = (parsed.top_processes as Array<Record<string, unknown>>) ?? [];

  const memUsedPct = mem.used_pct as number;
  const memFreePct = pct(mem.free_mib, mem.total_mib);
  const memCachePct = pct(mem.buff_cache_mib, mem.total_mib);

  return {
    "CPU - User": `${cpu.user_pct}%`,
    "CPU - System": `${cpu.system_pct}%`,
    "CPU - Idle": `${cpu.idle_pct}%`,
    "Overall CPU Utilization": `${cpu.busy_pct}% (user + system + nice)`,
    "Memory - Used": `${memUsedPct}% (≈ ${mem.used_mib} MiB of ${mem.total_mib} MiB)`,
    "Memory - Free": `${memFreePct ?? "n/a"}% (≈ ${mem.free_mib} MiB)`,
    "Memory - Buff/Cache": `${memCachePct ?? "n/a"}% (≈ ${mem.buff_cache_mib} MiB)`,
    "Load Average (1/5/15 min)": `${load["1min"]}, ${load["5min"]}, ${load["15min"]}`,
    observed_logical_cpus: parsed.observed_logical_cpus,
    top_cpu_processes: top.map((p) => ({
      pid: p.pid,
      command: p.command,
      percent_cpu: p.percent_cpu,
      percent_mem: p.percent_mem,
    })),
  };
}
