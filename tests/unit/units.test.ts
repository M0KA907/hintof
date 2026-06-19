import { describe, expect, test } from "vitest";
import { normalizeUnit } from "../../src/model/units";

describe("units", () => {
  test("normalizes common spellings", () => {
    expect(normalizeUnit("tablespoon")).toBe("tbsp");
    expect(normalizeUnit("tablespoons")).toBe("tbsp");
    expect(normalizeUnit("Tbsp.")).toBe("tbsp");
    expect(normalizeUnit("teaspoon")).toBe("tsp");
    expect(normalizeUnit("cups")).toBe("cups");
  });

  test("does not alter unknown units", () => {
    expect(normalizeUnit("sprig")).toBe("sprig");
  });

  test("empty returns undefined", () => {
    expect(normalizeUnit("")).toBeUndefined();
    expect(normalizeUnit("  ")).toBeUndefined();
  });
});
