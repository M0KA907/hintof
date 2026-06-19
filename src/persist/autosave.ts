import type { Recipe } from "../model/types";

const DRAFT_KEY = "hintof:draft";

export function loadDraft(): Recipe | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Recipe;
  } catch {
    return null;
  }
}

export function saveDraft(recipe: Recipe): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(recipe));
  } catch {
    // ponytail: quota handling in 3.5; silent fail for now
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;

export function autosave(recipe: Recipe, ms = 500): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => saveDraft(recipe), ms);
}
