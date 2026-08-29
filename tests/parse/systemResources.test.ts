import { describe, it, expect } from "vitest";
import { parseSystemResources } from "../../src/parse/systemResources.js";

const SAMPLE = `top - 14:54:19 up 84 days,  9:53,  0 users,  load average: 5.37, 5.54, 5.58
Tasks: 195 total,   7 running, 188 sleeping,   0 stopped,   0 zombie
%Cpu(s): 65.1 us,  2.0 sy,  0.0 ni, 32.9 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st
MiB Mem :   5026.9 total,    691.6 free,   2858.9 used,   1476.4 buff/cache
MiB Swap:   5961.0 total,   5904.8 free,     56.3 used.   1337.9 avail Mem

  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND
 5971       20   0  120212   6044   3336 R 100.0   0.1 121510:09 pan_task
 5972       20   0  120212   6140   3428 R 100.0   0.1 121512:07 pan_task
 5974       20   0  120212   6360   3652 R 100.0   0.1 121504:20 pan_task
 5978       20   0  120212   6104   3376 R 100.0   0.1 121328:48 pan_task
 5979       20   0  145260  31328   3516 R 100.0   0.6 121508:10 pan_task
   10       20   0       0      0      0 S   0.0   0.0  71:17.60 rcuc/0
   11       20   0       0      0      0 S   0.0   0.0  32:14.66 rcuc/1
   16       20   0       0      0      0 S   0.0   0.0  28:51.85 rcuc/2
   21       20   0       0      0      0 S   0.0   0.0  30:46.65 rcuc/3
   26       20   0       0      0      0 S   0.0   0.0  28:25.42 rcuc/4
   31       20   0       0      0      0 S   0.0   0.0  29:38.02 rcuc/5
   36       20   0       0      0      0 S   0.0   0.0  74:38.41 rcuc/6
   41       20   0       0      0      0 S   0.0   0.0  73:31.80 rcuc/7
`;

describe("parseSystemResources", () => {
  it("labels system CPU separately from pan_task and RAM", () => {
    const parsed = parseSystemResources(SAMPLE);

    expect(parsed.parse_ok).toBe(true);
    expect(parsed.system_cpu).toMatchObject({
      scope: "all_cores_combined",
      user_pct: 65.1,
      idle_pct: 32.9,
      busy_pct: 67.1,
    });
    expect(parsed.memory).toMatchObject({
      scope: "ram",
      used_pct: 56.9,
    });
    expect((parsed.memory as { used_pct: number }).used_pct).not.toBe(
      (parsed.system_cpu as { user_pct: number }).user_pct
    );

    const top = parsed.top_processes as Array<{ command: string; percent_cpu: number }>;
    expect(top[0].command).toBe("pan_task");
    expect(top[0].percent_cpu).toBe(100);
    expect(top.slice(0, 5).every((item) => item.percent_cpu >= 90)).toBe(true);
    expect(parsed.observed_logical_cpus).toBe(8);
    expect((parsed.presentation_rules as string[]).join(" ")).toContain("memory.used_pct is RAM");

    const summary = parsed.labeled_summary as Record<string, unknown>;
    expect(summary["CPU - User"]).toBe("65.1%");
    expect(summary["Overall CPU Utilization"]).toContain("67.1%");
    expect(summary["Memory - Used"]).toContain("56.9%");
    expect(summary["Memory - Used"]).toContain("2858.9 MiB");
    const topCpu = summary.top_cpu_processes as Array<{ command: string }>;
    expect(topCpu[0].command).toBe("pan_task");
  });

  it("keeps an excerpt when parse fails", () => {
    const parsed = parseSystemResources("not a top dump");
    expect(parsed.parse_ok).toBe(false);
    expect(parsed.parse_error).toBeTruthy();
  });
});
