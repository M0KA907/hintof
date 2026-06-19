import type { Recipe } from "../model/types";

const LIBRARY_KEY = "hintof:library";

export function loadLibrary(): Recipe[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Recipe[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLibrary(recipes: Recipe[]): boolean {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(recipes));
    return true;
  } catch {
    return false;
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
