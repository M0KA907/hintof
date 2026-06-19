import type { Recipe } from "../model/types";
import { normalizeRecipe } from "./migrate";

const LIBRARY_KEY = "hintof:library";

export type SaveResult = { ok: true } | { ok: false; reason: "unavailable" | "verify-failed" };

export function loadLibrary(): Recipe[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    const recipes =
      parsed &&
      typeof parsed === "object" &&
      "format" in parsed &&
      "recipes" in parsed &&
      Array.isArray((parsed as { recipes?: unknown }).recipes)
        ? (parsed as { recipes: unknown[] }).recipes
        : parsed;
    if (!Array.isArray(recipes)) return [];
    return recipes.map(normalizeRecipe).filter((recipe): recipe is Recipe => Boolean(recipe));
  } catch {
    return [];
  }
}

export function saveLibrary(recipes: Recipe[]): SaveResult {
  try {
    const normalized = recipes.map(normalizeRecipe).filter((r): r is Recipe => Boolean(r));
    const serialized = JSON.stringify(normalized);
    localStorage.setItem(LIBRARY_KEY, serialized);
    return localStorage.getItem(LIBRARY_KEY) === serialized
      ? { ok: true }
      : { ok: false, reason: "verify-failed" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export function upsertRecipe(recipes: Recipe[], recipe: Recipe): Recipe[] {
  const i = recipes.findIndex((r) => r.id === recipe.id);
  if (i === -1) return [...recipes, recipe];
  const next = [...recipes];
  next[i] = recipe;
  return next;
}

export function deleteRecipe(recipes: Recipe[], id: string): Recipe[] {
  return recipes.filter((r) => r.id !== id);
}
