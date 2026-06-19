import { describe, expect, test } from "vitest";
import { parseIngredientLine, parseIngredientPaste } from "../../src/parse/ingredient-parse";

describe("ingredient-parse", () => {
  test("parses common lines", () => {
    const flour = parseIngredientLine("2 cups flour");
    expect(flour.ok).toBe(true);
    if (flour.ok) {
      expect(flour.ingredient.unit).toBe("cups");
      expect(flour.ingredient.item).toBe("flour");
    }

    const salt = parseIngredientLine("½ tsp salt");
    expect(salt.ok).toBe(true);
  });

  test("ambiguous lines stay as item", () => {
    const r = parseIngredientLine("salt to taste");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.item).toBe("salt to taste");
  });

  test("paste splits lines", () => {
    const rows = parseIngredientPaste("2 cups flour\nsalt to taste");
    expect(rows).toHaveLength(2);
    expect(rows[1]!.item).toBe("salt to taste");
  });

  test("never throws", () => {
    expect(() => parseIngredientLine("")).not.toThrow();
    expect(() => parseIngredientPaste("!!!")).not.toThrow();
  });
});
