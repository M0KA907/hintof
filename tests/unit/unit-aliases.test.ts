import { describe, expect, it } from "vitest";
import { suggestUnitCorrection, UNIT_ALIASES } from "../../src/search/unit-aliases.ts";

describe("suggestUnitCorrection", () => {
  it("suggests a correction for a known alias", () => {
    expect(suggestUnitCorrection("tbsb")).toEqual({ from: "tbsb", to: "tbsp" });
    expect(suggestUnitCorrection("tblsp")).toEqual({
      from: "tblsp",
      to: "tbsp"
    });
    expect(suggestUnitCorrection("teaspon")).toEqual({
      from: "teaspon",
      to: "teaspoon"
    });
    expect(suggestUnitCorrection("mililiter")).toEqual({
      from: "mililiter",
      to: "milliliter"
    });
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(suggestUnitCorrection("  TBSB ")).toEqual({
      from: "tbsb",
      to: "tbsp"
    });
    expect(suggestUnitCorrection("Gramme")).toEqual({
      from: "gramme",
      to: "gram"
    });
  });

  it("returns null for a correct unit", () => {
    expect(suggestUnitCorrection("tbsp")).toBeNull();
    expect(suggestUnitCorrection("gram")).toBeNull();
    expect(suggestUnitCorrection("liter")).toBeNull();
  });

  it("returns null for unknown / arbitrary ingredient words", () => {
    expect(suggestUnitCorrection("flour")).toBeNull();
    expect(suggestUnitCorrection("chocolate")).toBeNull();
    expect(suggestUnitCorrection("")).toBeNull();
  });

  it("does not mutate the alias table", () => {
    const before = JSON.stringify(UNIT_ALIASES);
    suggestUnitCorrection("tbsb");
    suggestUnitCorrection("flour");
    expect(JSON.stringify(UNIT_ALIASES)).toBe(before);
  });

  it("covers every required alias", () => {
    for (const [from, to] of Object.entries(UNIT_ALIASES)) {
      expect(suggestUnitCorrection(from)).toEqual({ from, to });
    }
  });
});
