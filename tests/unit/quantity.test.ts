import { describe, expect, test } from "vitest";
import {
  parseQuantity,
  reduce,
  renderQuantity,
  scaleQuantity,
  servingsFactor
} from "../../src/model/quantity";

describe("quantity", () => {
  test("parses unicode, ascii, decimal, mixed", () => {
    expect(parseQuantity("½")?.kind).toBe("single");
    expect(parseQuantity("1/2")?.kind).toBe("single");
    expect(parseQuantity("0.5")?.kind).toBe("single");
    expect(parseQuantity("1 1/2")?.kind).toBe("single");
    expect(parseQuantity("1½")?.kind).toBe("single");
    expect(parseQuantity(".5")?.kind).toBe("single");
    expect(parseQuantity("3")?.kind).toBe("single");
  });

  test("parses ranges", () => {
    const r = parseQuantity("2-3");
    expect(r?.kind).toBe("range");
    const en = parseQuantity("2–3");
    expect(en?.kind).toBe("range");
  });

  test("garbage returns null without throwing", () => {
    expect(parseQuantity("abc")).toBeNull();
    expect(parseQuantity("")).toBeNull();
    expect(parseQuantity("1/0")).toBeNull();
  });

  test("reduces rationals", () => {
    expect(reduce({ n: 4, d: 8 })).toEqual({ n: 1, d: 2 });
  });

  test("renders unicode and ascii", () => {
    const half = { kind: "single" as const, value: { n: 1, d: 2 } };
    expect(renderQuantity(half, "unicode")).toBe("½");
    expect(renderQuantity(half, "ascii")).toBe("1/2");
    const mixed = { kind: "single" as const, value: { n: 3, d: 2 } };
    expect(renderQuantity(mixed, "unicode")).toBe("1½");
    expect(renderQuantity(mixed, "ascii")).toBe("1 1/2");
  });

  test("scales singles and ranges", () => {
    const half = { kind: "single" as const, value: { n: 1, d: 3 } };
    const scaled = scaleQuantity(half, 2);
    expect(renderQuantity(scaled, "unicode")).toBe("⅔");
    const range = {
      kind: "range" as const,
      min: { n: 2, d: 1 },
      max: { n: 3, d: 1 }
    };
    const scaledRange = scaleQuantity(range, 1.5);
    expect(renderQuantity(scaledRange, "ascii")).toBe("3–5");
  });

  test("servings factor", () => {
    expect(servingsFactor(4, 6)).toBe(1.5);
    expect(servingsFactor(0, 6)).toBeNull();
    expect(servingsFactor(4, 0)).toBeNull();
  });
});
