import { describe, it, expect } from "vitest";
import { normalizeLicenses } from "../../src/parse/licenses.js";

describe("normalizeLicenses", () => {
  it("extracts license entries", () => {
    const normalized = normalizeLicenses({
      licenses: {
        entry: [
          { feature: "Threat Prevention", expired: "no" },
          { feature: "PAN-DB URL Filtering", expired: "no" },
        ],
      },
    });
    expect(normalized.count).toBe(2);
    expect(normalized.has_entries).toBe(true);
    expect((normalized.licenses as Array<Record<string, unknown>>)[0].feature).toBe(
      "Threat Prevention"
    );
  });

  it("handles empty license response", () => {
    const normalized = normalizeLicenses({ licenses: {} });
    expect(normalized.count).toBe(0);
    expect(normalized.has_entries).toBe(false);
  });
});
