import { describe, expect, test } from "vitest";
import { nextCollisionIndex, recipeFilename, sanitizeTitle } from "../../src/serialize/filename";

describe("filename", () => {
  test("sanitizes illegal chars", () => {
    expect(sanitizeTitle("Mac & Cheese: Mom's")).toBe("Mac & Cheese Mom's");
    expect(sanitizeTitle("Pasta w/ Garlic")).toBe("Pasta w Garlic");
    expect(sanitizeTitle("   ")).toBe("Untitled");
  });

  test("reserved names get suffix", () => {
    expect(sanitizeTitle("CON")).toBe("CON_");
    expect(sanitizeTitle("nul")).toBe("nul_");
  });

  test("date prefix and collisions", () => {
    expect(recipeFilename("2026-06-19", "Soup")).toBe("2026-06-19 Soup.md");
    expect(recipeFilename("2026-06-19", "Soup", 2)).toBe("2026-06-19 Soup (2).md");
    expect(
      nextCollisionIndex(["2026-06-19 Soup.md", "2026-06-19 Soup (2).md"], "2026-06-19 Soup.md")
    ).toBe(3);
  });
});
