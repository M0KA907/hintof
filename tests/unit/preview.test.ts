import { describe, expect, test } from "vitest";
import { emptyRecipe } from "../../src/model/types";
import { recipeToNote } from "../../src/serialize";
import { previewText } from "../../src/ui/views/preview";

describe("previewText", () => {
  test("shows only created and updated frontmatter in the preview", () => {
    const recipe = emptyRecipe({
      title: "Preview Soup",
      tags: ["soup", "weeknight"],
      cuisine: "Italian",
      servings: 4,
      source: {
        name: "Example Kitchen",
        url: "https://example.test/soup"
      },
      created: "2026-06-19",
      updated: "2026-06-20",
      ingredientGroups: [{ ingredients: [{ item: "tomatoes" }] }],
      stepSections: [{ steps: ["Simmer."] }]
    });

    const preview = previewText(recipe);

    expect(recipeToNote(recipe)).toContain("tags:");
    expect(preview).toContain("created: 2026-06-19");
    expect(preview).toContain("updated: 2026-06-20");
    expect(preview).toContain("# Preview Soup");
    expect(preview).not.toContain("schema_version:");
    expect(preview).not.toContain("title:");
    expect(preview).not.toContain("tags:");
    expect(preview).not.toContain("cuisine:");
    expect(preview).not.toContain("servings:");
    expect(preview).not.toContain("source_name:");
  });
});
