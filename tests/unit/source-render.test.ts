import { describe, expect, test } from "vitest";
import { renderSource } from "../../src/serialize/markdown";

describe("renderSource", () => {
  test("renders importer provenance with safe canonical links", () => {
    expect(
      renderSource({
        name: "Example",
        url: "https://example.test/display",
        canonicalUrl: "https://example.test/canonical",
        publisher: "Example Test Kitchen",
        importedAt: "2026-06-20T12:00:00.000Z",
        parser: "json-ld"
      })
    ).toBe(
      "[Example](https://example.test/display) — Example Test Kitchen ([canonical](https://example.test/canonical); imported 2026-06-20T12:00:00.000Z; parser: json-ld)"
    );
  });

  test("does not create Markdown links for unsafe source protocols", () => {
    expect(
      renderSource({
        name: "Bad Link",
        url: "javascript:alert(1)",
        canonicalUrl: "ftp://example.test/recipe"
      })
    ).toBe("Bad Link (canonical: ftp://example.test/recipe)");
  });
});
