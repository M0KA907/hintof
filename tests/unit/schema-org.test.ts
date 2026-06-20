import { describe, expect, test } from "vitest";
import { extractRecipe } from "../../src/import/schema-org";

function ldScript(value: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(value)}</script>`;
}

function page(...scripts: string[]): string {
  return `<!doctype html><html><head>${scripts.join("\n")}</head><body></body></html>`;
}

describe("schema-org extractRecipe", () => {
  test("top-level Recipe", () => {
    const html = page(
      ldScript({
        "@context": "https://schema.org",
        "@type": "Recipe",
        name: "Tomato Soup",
        recipeIngredient: ["2 cups tomatoes", "1 tsp salt"],
        recipeInstructions: ["Chop tomatoes.", "Simmer."]
      })
    );
    const r = extractRecipe(html);
    expect(r.ok).toBe(true);
    if (r.ok && "recipe" in r) {
      expect(r.recipe.name).toBe("Tomato Soup");
      expect(r.recipe.parser).toBe("json-ld");
      expect(r.recipe.ingredients).toHaveLength(2);
      expect(r.recipe.instructionSections[0]!.steps).toEqual(["Chop tomatoes.", "Simmer."]);
    }
  });

  test("@graph with a Recipe", () => {
    const html = page(
      ldScript({
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "WebSite", name: "Site" },
          {
            "@type": "Recipe",
            name: "Graph Recipe",
            recipeIngredient: ["flour"],
            recipeInstructions: "Bake."
          }
        ]
      })
    );
    const r = extractRecipe(html);
    expect(r.ok).toBe(true);
    if (r.ok && "recipe" in r) {
      expect(r.recipe.name).toBe("Graph Recipe");
      expect(r.recipe.ingredients[0]!.original).toBe("flour");
    }
  });

  test("array of nodes at top level", () => {
    const html = page(
      ldScript([
        { "@type": "Organization", name: "Org" },
        {
          "@type": "Recipe",
          name: "Array Recipe",
          recipeIngredient: ["eggs"],
          recipeInstructions: ["Whisk."]
        }
      ])
    );
    const r = extractRecipe(html);
    expect(r.ok).toBe(true);
    if (r.ok && "recipe" in r) {
      expect(r.recipe.name).toBe("Array Recipe");
    }
  });

  test("@type as array including Recipe", () => {
    const html = page(
      ldScript({
        "@type": ["Thing", "Recipe"],
        name: "Multi Type",
        recipeIngredient: ["water"],
        recipeInstructions: ["Boil."]
      })
    );
    const r = extractRecipe(html);
    expect(r.ok).toBe(true);
    if (r.ok && "recipe" in r) {
      expect(r.recipe.name).toBe("Multi Type");
    }
  });

  test("HowToStep instruction list", () => {
    const html = page(
      ldScript({
        "@type": "Recipe",
        name: "Steps",
        recipeIngredient: ["x"],
        recipeInstructions: [
          { "@type": "HowToStep", text: "Step one." },
          { "@type": "HowToStep", text: "Step two." }
        ]
      })
    );
    const r = extractRecipe(html);
    expect(r.ok).toBe(true);
    if (r.ok && "recipe" in r) {
      expect(r.recipe.instructionSections).toHaveLength(1);
      expect(r.recipe.instructionSections[0]!.name).toBeUndefined();
      expect(r.recipe.instructionSections[0]!.steps).toEqual(["Step one.", "Step two."]);
    }
  });

  test("HowToSection list preserves section names", () => {
    const html = page(
      ldScript({
        "@type": "Recipe",
        name: "Sectioned",
        recipeIngredient: ["x"],
        recipeInstructions: [
          {
            "@type": "HowToSection",
            name: "Dough",
            itemListElement: [
              { "@type": "HowToStep", text: "Mix flour." },
              { "@type": "HowToStep", text: "Knead." }
            ]
          },
          {
            "@type": "HowToSection",
            name: "Filling",
            itemListElement: [{ "@type": "HowToStep", text: "Chop apples." }]
          }
        ]
      })
    );
    const r = extractRecipe(html);
    expect(r.ok).toBe(true);
    if (r.ok && "recipe" in r) {
      const sections = r.recipe.instructionSections;
      expect(sections).toHaveLength(2);
      expect(sections[0]!.name).toBe("Dough");
      expect(sections[0]!.steps).toEqual(["Mix flour.", "Knead."]);
      expect(sections[1]!.name).toBe("Filling");
      expect(sections[1]!.steps).toEqual(["Chop apples."]);
    }
  });

  test("plain-string instructions become one step", () => {
    const html = page(
      ldScript({
        "@type": "Recipe",
        name: "Prose",
        recipeIngredient: ["x"],
        recipeInstructions: "First do this. Then do that. Finally serve it warm."
      })
    );
    const r = extractRecipe(html);
    expect(r.ok).toBe(true);
    if (r.ok && "recipe" in r) {
      expect(r.recipe.instructionSections).toHaveLength(1);
      expect(r.recipe.instructionSections[0]!.steps).toHaveLength(1);
      expect(r.recipe.instructionSections[0]!.steps[0]).toBe(
        "First do this. Then do that. Finally serve it warm."
      );
    }
  });

  test("malformed JSON-LD block alongside a valid one", () => {
    const bad = `<script type="application/ld+json">{ not valid json }</script>`;
    const good = ldScript({
      "@type": "Recipe",
      name: "Resilient",
      recipeIngredient: ["x"],
      recipeInstructions: ["Cook."]
    });
    const r = extractRecipe(page(bad, good));
    expect(r.ok).toBe(true);
    expect(r.warnings).toContain("A JSON-LD block could not be parsed.");
    if (r.ok && "recipe" in r) {
      expect(r.recipe.name).toBe("Resilient");
    }
  });

  test("microdata fallback", () => {
    const html = `<!doctype html><html><body>
      <div itemscope itemtype="https://schema.org/Recipe">
        <h1 itemprop="name">Micro Cake</h1>
        <li itemprop="recipeIngredient">2 cups flour</li>
        <li itemprop="recipeIngredient">1 cup sugar</li>
        <div itemprop="recipeInstructions">Mix and bake.</div>
      </div>
    </body></html>`;
    const r = extractRecipe(html);
    expect(r.ok).toBe(true);
    if (r.ok && "recipe" in r) {
      expect(r.recipe.parser).toBe("microdata");
      expect(r.recipe.name).toBe("Micro Cake");
      expect(r.recipe.ingredients.map((i) => i.original)).toEqual(["2 cups flour", "1 cup sugar"]);
      expect(r.recipe.instructionSections[0]!.steps).toEqual(["Mix and bake."]);
    }
  });

  test("page with no recipe returns NO_STRUCTURED_RECIPE", () => {
    const html = page(ldScript({ "@type": "WebSite", name: "Just a site" }));
    const r = extractRecipe(html);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("NO_STRUCTURED_RECIPE");
    }
  });

  test("ingredient lines preserved verbatim", () => {
    const lines = ["1½ cups all-purpose flour", "Salt & pepper, to taste"];
    const html = page(
      ldScript({
        "@type": "Recipe",
        name: "Verbatim",
        recipeIngredient: lines,
        recipeInstructions: ["Combine."]
      })
    );
    const r = extractRecipe(html);
    expect(r.ok).toBe(true);
    if (r.ok && "recipe" in r) {
      expect(r.recipe.ingredients.map((i) => i.original)).toEqual(lines);
    }
  });

  test("two-recipe page returns candidates", () => {
    const html = page(
      ldScript({
        "@type": "Recipe",
        name: "Recipe One",
        recipeIngredient: ["a", "b"],
        recipeInstructions: ["Do A."]
      }),
      ldScript({
        "@type": "Recipe",
        name: "Recipe Two",
        recipeIngredient: ["c"],
        recipeInstructions: ["Do C.", "Do D."]
      })
    );
    const r = extractRecipe(html);
    expect(r.ok).toBe(true);
    if (r.ok && "candidates" in r) {
      expect(r.candidates).toHaveLength(2);
      expect(r.recipes).toHaveLength(2);
      expect(r.candidates[0]!.name).toBe("Recipe One");
      expect(r.candidates[0]!.ingredientCount).toBe(2);
      expect(r.candidates[1]!.instructionCount).toBe(2);
    } else {
      throw new Error("expected candidates form");
    }
  });

  test("author/publisher/yield/times/images/cuisine normalized", () => {
    const html = page(
      ldScript({
        "@type": "Recipe",
        name: "Full",
        recipeIngredient: ["x"],
        recipeInstructions: ["Cook."],
        author: { "@type": "Person", name: "Ada" },
        publisher: { "@type": "Organization", name: "Pub Co" },
        recipeYield: ["4", "4 servings"],
        prepTime: "PT20M",
        cookTime: "PT40M",
        totalTime: "PT1H",
        image: ["https://x.test/a.jpg", { url: "https://x.test/b.jpg" }],
        recipeCuisine: "Italian",
        recipeCategory: ["Dinner", "Main"]
      })
    );
    const r = extractRecipe(html, "https://x.test/page");
    expect(r.ok).toBe(true);
    if (r.ok && "recipe" in r) {
      expect(r.recipe.author).toBe("Ada");
      expect(r.recipe.publisher).toBe("Pub Co");
      expect(r.recipe.yield).toBe("4 servings");
      expect(r.recipe.prepTime).toBe("PT20M");
      expect(r.recipe.cookTime).toBe("PT40M");
      expect(r.recipe.totalTime).toBe("PT1H");
      expect(r.recipe.images).toEqual(["https://x.test/a.jpg", "https://x.test/b.jpg"]);
      expect(r.recipe.cuisine).toBe("Italian");
      expect(r.recipe.category).toBe("Dinner, Main");
      expect(r.recipe.canonicalUrl).toBe("https://x.test/page");
    }
  });

  test("strips HTML and decodes entities in steps and name", () => {
    const html = page(
      ldScript({
        "@type": "Recipe",
        name: "Mac &amp; Cheese",
        recipeIngredient: ["x"],
        recipeInstructions: [{ "@type": "HowToStep", text: "Stir <b>well</b> &amp; serve." }]
      })
    );
    const r = extractRecipe(html);
    expect(r.ok).toBe(true);
    if (r.ok && "recipe" in r) {
      expect(r.recipe.name).toBe("Mac & Cheese");
      expect(r.recipe.instructionSections[0]!.steps[0]).toBe("Stir well & serve.");
    }
  });

  test("prefers node @id absolute url for canonical", () => {
    const html = page(
      ldScript({
        "@type": "Recipe",
        "@id": "https://canonical.test/recipe",
        name: "Canon",
        recipeIngredient: ["x"],
        recipeInstructions: ["Cook."]
      })
    );
    const r = extractRecipe(html, "https://other.test/fallback");
    expect(r.ok).toBe(true);
    if (r.ok && "recipe" in r) {
      expect(r.recipe.canonicalUrl).toBe("https://canonical.test/recipe");
    }
  });

  test("one real recipe among empty siblings is auto-selected", () => {
    const html = page(
      ldScript({ "@type": "Recipe", name: "Stub" }),
      ldScript({
        "@type": "Recipe",
        name: "Real",
        recipeIngredient: ["a"],
        recipeInstructions: ["Do it."]
      })
    );
    const r = extractRecipe(html);
    expect(r.ok).toBe(true);
    if (r.ok && "recipe" in r) {
      expect(r.recipe.name).toBe("Real");
    } else {
      throw new Error("expected single recipe");
    }
  });
});
