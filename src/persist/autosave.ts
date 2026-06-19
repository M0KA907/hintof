import type { Recipe } from "../model/types";
import { normalizeRecipe } from "./migrate";

const DRAFT_KEY = "hintof:draft";

export function loadDraft(): Recipe | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return normalizeRecipe(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function saveDraft(recipe: Recipe): boolean {
  try {
    const normalized = normalizeRecipe(recipe);
    if (!normalized) return false;
    const serialized = JSON.stringify(normalized);
    localStorage.setItem(DRAFT_KEY, serialized);
    return localStorage.getItem(DRAFT_KEY) === serialized;
  } catch {
    return false;
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;

export function autosave(recipe: Recipe, ms = 500): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => saveDraft(recipe), ms);
}
