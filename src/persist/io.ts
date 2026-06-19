import type { Recipe } from "../model/types";
import { normalizeRecipe } from "./migrate";
import { upsertRecipe } from "./library";

export interface LibraryExport {
  format: "hintof-library";
  schema_version: 1;
  exported_at: string;
  recipes: Recipe[];
}

export interface LibraryImportResult {
  recipes: Recipe[];
  imported: number;
  updated: number;
  quarantined: Array<{ index: number; reason: string }>;
}

export type ImportMode = "merge" | "replace";

function recipePayload(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (
    value &&
    typeof value === "object" &&
    "format" in value &&
    "schema_version" in value &&
    "recipes" in value
  ) {
    const envelope = value as Partial<LibraryExport>;
    if (envelope.format !== "hintof-library" || envelope.schema_version !== 1) return null;
    return Array.isArray(envelope.recipes) ? envelope.recipes : null;
  }
  return null;
}

export function createLibraryExport(recipes: Recipe[]): LibraryExport {
  return {
    format: "hintof-library",
    schema_version: 1,
    exported_at: new Date().toISOString(),
    recipes: recipes.map((recipe) => normalizeRecipe(recipe)).filter((r): r is Recipe => Boolean(r))
  };
}

export function parseLibraryPayload(value: unknown): LibraryImportResult {
  const payload = recipePayload(value);
  if (!payload) {
    return {
      recipes: [],
      imported: 0,
      updated: 0,
      quarantined: [{ index: -1, reason: "Expected a hintof library export." }]
    };
  }

  const recipes: Recipe[] = [];
  const quarantined: LibraryImportResult["quarantined"] = [];

  payload.forEach((entry, index) => {
    const recipe = normalizeRecipe(entry);
    if (recipe) recipes.push(recipe);
    else quarantined.push({ index, reason: "Invalid or unsupported recipe schema." });
  });

  return { recipes, imported: recipes.length, updated: 0, quarantined };
}

export function importLibraryPayload(
  value: unknown,
  existing: Recipe[],
  mode: ImportMode
): LibraryImportResult {
  const parsed = parseLibraryPayload(value);
  if (mode === "replace") return parsed;

  let recipes = [...existing];
  let imported = 0;
  let updated = 0;

  for (const recipe of parsed.recipes) {
    if (recipes.some((r) => r.id === recipe.id)) updated += 1;
    else imported += 1;
    recipes = upsertRecipe(recipes, recipe);
  }

  return { ...parsed, recipes, imported, updated };
}

export function parseLibraryJson(
  text: string,
  existing: Recipe[],
  mode: ImportMode
): LibraryImportResult {
  try {
    return importLibraryPayload(JSON.parse(text) as unknown, existing, mode);
  } catch {
    return {
      recipes: existing,
      imported: 0,
      updated: 0,
      quarantined: [{ index: -1, reason: "Invalid JSON." }]
    };
  }
}
