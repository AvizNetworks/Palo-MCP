import { describe, it, expect } from "vitest";
import {
  extractJobId,
  buildLogTimeQuery,
  normalizeLogResults,
} from "../../src/parse/logResults.js";

describe("logResults", () => {
  it("extracts job id from string or object", () => {
    expect(extractJobId("410")).toBe("410");
    expect(extractJobId({ id: "411", status: "FIN" })).toBe("411");
    expect(extractJobId(null)).toBeNull();
  });

  it("builds receive_time query for hours lookback", () => {
    const q = buildLogTimeQuery(24);
    expect(q).toMatch(/receive_time geq/);
    expect(q).toMatch(/^\( receive_time geq '/);
  });

  it("normalizes log entries and count", () => {
    const normalized = normalizeLogResults({
      "@_count": "2",
      "@_progress": "100",
      entry: [
        { subtype: { "#text": "auth" }, msg: { "#text": "login ok" } },
        { subtype: "commit", msg: "committed" },
      ],
    });
    expect(normalized.count).toBe(2);
    expect(normalized.has_entries).toBe(true);
    expect(normalized.entries).toHaveLength(2);
    expect((normalized.entries as Array<Record<string, unknown>>)[0].subtype).toBe("auth");
  });

  it("handles empty log result", () => {
    const normalized = normalizeLogResults({ "@_count": "0", "@_progress": "100" });
    expect(normalized.count).toBe(0);
    expect(normalized.has_entries).toBe(false);
    expect(normalized.entries).toEqual([]);
  });
});
