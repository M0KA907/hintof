import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import type { Recipe } from "../../src/model/types";
import { recipeToNote } from "../../src/serialize";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf8")) as T;
}

function loadMd(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8");
}

describe("golden", () => {
  test("minimal note matches contract", () => {
    const recipe = loadJson<Recipe>("minimal.json");
    expect(recipeToNote(recipe)).toBe(loadMd("minimal.md"));
  });

  test("complete note matches contract", () => {
    const recipe = loadJson<Recipe>("complete.json");
    expect(recipeToNote(recipe)).toBe(loadMd("complete.md"));
  });

  test("omission note has no empty keys or headings", () => {
    const recipe = loadJson<Recipe>("omission.json");
    const out = recipeToNote(recipe);
    expect(out).toBe(loadMd("omission.md"));
    expect(out).not.toMatch(/:\s*$/m);
    expect(out).not.toMatch(/## Ingredients/);
  });
});
