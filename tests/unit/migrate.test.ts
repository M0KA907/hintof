import { describe, expect, test } from "vitest";
import { normalizeRecipe } from "../../src/persist/migrate";

describe("normalizeRecipe schema migration", () => {
  test("migrates stored v1 recipes to current schema v2", () => {
    const recipe = normalizeRecipe({
      id: "00000000-0000-4000-8000-000000000010",
      schemaVersion: 1,
      title: "Legacy Soup",
      ingredientGroups: [{ ingredients: [{ item: "" }] }],
      stepSections: [{ steps: [""] }],
      source: {
        name: "Legacy Source",
        url: "https://example.test/legacy",
        adaptedFrom: "handwritten card"
      },
      created: "2026-06-19",
      updated: "2026-06-19",
      options: {
        wikiLinks: { ingredients: false, cuisine: false },
        callouts: false,
        fractionStyle: "unicode"
      }
    });

    expect(recipe?.schemaVersion).toBe(2);
    expect(recipe?.source).toEqual({
      name: "Legacy Source",
      url: "https://example.test/legacy",
      adaptedFrom: "handwritten card"
    });
  });

  test("keeps v2 source provenance fields", () => {
    const recipe = normalizeRecipe({
      id: "00000000-0000-4000-8000-000000000011",
      schemaVersion: 2,
      title: "Imported Soup",
      ingredientGroups: [{ ingredients: [{ item: "" }] }],
      stepSections: [{ steps: [""] }],
      source: {
        name: "Example",
        canonicalUrl: "https://example.test/recipe",
        publisher: "Example Test Kitchen",
        importedAt: "2026-06-20T12:00:00.000Z",
        parser: "json-ld"
      },
      created: "2026-06-20",
      updated: "2026-06-20",
      options: {
        wikiLinks: { ingredients: false, cuisine: false },
        callouts: false,
        fractionStyle: "unicode"
      }
    });

    expect(recipe?.source?.canonicalUrl).toBe("https://example.test/recipe");
    expect(recipe?.source?.publisher).toBe("Example Test Kitchen");
    expect(recipe?.source?.importedAt).toBe("2026-06-20T12:00:00.000Z");
    expect(recipe?.source?.parser).toBe("json-ld");
  });
});
