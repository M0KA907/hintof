import { parseIngredientPaste } from "../parse/ingredient-parse";
import { scaleQuantity, servingsFactor } from "../model/quantity";
import type {
  Ingredient,
  IngredientGroup,
  NoteOptions,
  Recipe,
  Source,
  StepSection,
  Substitution
} from "../model/types";
import { emptyRecipe } from "../model/types";
import { normalizeRecipe } from "../persist/migrate";
import type { ThemePref } from "../persist/theme";
import { deleteRecipe, loadLibrary, saveLibrary, upsertRecipe } from "../persist/library";

export type Panel = "write" | "preview";
export type View = "editor" | "library" | "docs";

export interface AppState {
  recipe: Recipe;
  library: Recipe[];
  panel: Panel;
  view: View;
  theme: ThemePref;
  status: string;
}

export function initialState(): AppState {
  return {
    recipe: emptyRecipe(),
    library: loadLibrary(),
    panel: "write",
    view: "editor",
    theme: "system",
    status: ""
  };
}

function touch(recipe: Recipe): Recipe {
  return { ...recipe, updated: new Date().toISOString().slice(0, 10) };
}

export function setTitle(state: AppState, title: string): AppState {
  return { ...state, recipe: touch({ ...state.recipe, title }) };
}

export function setField<K extends keyof Recipe>(
  state: AppState,
  key: K,
  value: Recipe[K]
): AppState {
  return { ...state, recipe: touch({ ...state.recipe, [key]: value }) };
}

export function setSource(state: AppState, patch: Partial<Source>): AppState {
  const source = { ...state.recipe.source, ...patch };
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, v]) => v !== undefined && v !== "")
  ) as Source;
  return {
    ...state,
    recipe: touch({
      ...state.recipe,
      source: Object.keys(cleaned).length ? cleaned : undefined
    })
  };
}

export function setPanel(state: AppState, panel: Panel): AppState {
  return { ...state, panel };
}

export function setView(state: AppState, view: View): AppState {
  return { ...state, view, status: "" };
}

export function setTheme(state: AppState, theme: ThemePref): AppState {
  return { ...state, theme };
}

export function setStatus(state: AppState, status: string): AppState {
  return { ...state, status };
}

export function setOptions(state: AppState, patch: Partial<NoteOptions>): AppState {
  const options = { ...state.recipe.options, ...patch };
  if (patch.wikiLinks) {
    options.wikiLinks = { ...state.recipe.options.wikiLinks, ...patch.wikiLinks };
  }
  return { ...state, recipe: touch({ ...state.recipe, options }) };
}

export function loadRecipe(state: AppState, recipe: Recipe): AppState {
  const normalized = normalizeRecipe(recipe);
  if (!normalized) return { ...state, status: "Could not open that recipe." };
  return { ...state, recipe: normalized, view: "editor", panel: "write", status: "" };
}

export function newRecipe(state: AppState): AppState {
  return { ...state, recipe: emptyRecipe(), view: "editor", panel: "write", status: "" };
}

export function saveToLibrary(state: AppState): AppState {
  if (!state.recipe.title.trim()) {
    return { ...state, status: "Add a title before saving." };
  }
  const recipe = touch(state.recipe);
  const library = upsertRecipe(state.library, recipe);
  const result = saveLibrary(library);
  return {
    ...state,
    recipe,
    library,
    status: result.ok ? "Saved to library." : "Storage full — export your library to keep a copy."
  };
}

export function removeFromLibrary(state: AppState, id: string): AppState {
  const library = deleteRecipe(state.library, id);
  const result = saveLibrary(library);
  const recipe = state.recipe.id === id ? emptyRecipe() : state.recipe;
  return {
    ...state,
    library,
    recipe,
    status: result.ok ? "Removed from library." : "Removed here, but storage could not update."
  };
}

export function updateIngredient(
  state: AppState,
  gi: number,
  ii: number,
  patch: Partial<Ingredient>
): AppState {
  const groups = state.recipe.ingredientGroups.map((g, gidx) => {
    if (gidx !== gi) return g;
    return {
      ...g,
      ingredients: g.ingredients.map((ing, iidx) => (iidx === ii ? { ...ing, ...patch } : ing))
    };
  });
  return { ...state, recipe: touch({ ...state.recipe, ingredientGroups: groups }) };
}

export function addIngredient(state: AppState, gi = 0): AppState {
  const groups = [...state.recipe.ingredientGroups];
  const group = groups[gi] ?? { ingredients: [] };
  groups[gi] = { ...group, ingredients: [...group.ingredients, { item: "" }] };
  return { ...state, recipe: touch({ ...state.recipe, ingredientGroups: groups }) };
}

export function removeIngredient(state: AppState, gi: number, ii: number): AppState {
  const groups = state.recipe.ingredientGroups.map((g, gidx) => {
    if (gidx !== gi) return g;
    const ingredients = g.ingredients.filter((_, i) => i !== ii);
    return { ...g, ingredients: ingredients.length ? ingredients : [{ item: "" }] };
  });
  return { ...state, recipe: touch({ ...state.recipe, ingredientGroups: groups }) };
}

export function moveIngredient(state: AppState, gi: number, from: number, to: number): AppState {
  if (from === to) return state;
  const groups = state.recipe.ingredientGroups.map((g, gidx) => {
    if (gidx !== gi) return g;
    const ingredients = [...g.ingredients];
    const [row] = ingredients.splice(from, 1);
    if (!row) return g;
    ingredients.splice(to, 0, row);
    return { ...g, ingredients };
  });
  return { ...state, recipe: touch({ ...state.recipe, ingredientGroups: groups }) };
}

export function pasteIngredients(state: AppState, gi: number, text: string): AppState {
  const parsed = parseIngredientPaste(text);
  if (!parsed.length) return state;
  const groups = state.recipe.ingredientGroups.map((g, gidx) => {
    if (gidx !== gi) return g;
    const existing = g.ingredients.filter((ing) => ing.item.trim() || ing.qty || ing.unit);
    const ingredients = existing.length ? [...existing, ...parsed] : parsed;
    return { ...g, ingredients };
  });
  return { ...state, recipe: touch({ ...state.recipe, ingredientGroups: groups }) };
}

export function updateStep(state: AppState, si: number, ii: number, text: string): AppState {
  const sections = state.recipe.stepSections.map((s, sidx) => {
    if (sidx !== si) return s;
    return { ...s, steps: s.steps.map((st, i) => (i === ii ? text : st)) };
  });
  return { ...state, recipe: touch({ ...state.recipe, stepSections: sections }) };
}

export function addStep(state: AppState, si = 0): AppState {
  const sections = [...state.recipe.stepSections];
  const section = sections[si] ?? { steps: [] };
  sections[si] = { ...section, steps: [...section.steps, ""] };
  return { ...state, recipe: touch({ ...state.recipe, stepSections: sections }) };
}

export function removeStep(state: AppState, si: number, ii: number): AppState {
  const sections = state.recipe.stepSections.map((s, sidx) => {
    if (sidx !== si) return s;
    const steps = s.steps.filter((_, i) => i !== ii);
    return { ...s, steps: steps.length ? steps : [""] };
  });
  return { ...state, recipe: touch({ ...state.recipe, stepSections: sections }) };
}

export function moveStep(state: AppState, si: number, from: number, to: number): AppState {
  if (from === to) return state;
  const sections = state.recipe.stepSections.map((s, sidx) => {
    if (sidx !== si) return s;
    const steps = [...s.steps];
    const [row] = steps.splice(from, 1);
    if (!row) return s;
    steps.splice(to, 0, row);
    return { ...s, steps };
  });
  return { ...state, recipe: touch({ ...state.recipe, stepSections: sections }) };
}

export function scaleByServings(state: AppState, target: number): AppState {
  if (!Number.isInteger(target) || target <= 0) return state;
  const factor = servingsFactor(state.recipe.servings, target);
  if (!factor) return state;
  const groups = state.recipe.ingredientGroups.map((g) => ({
    ...g,
    ingredients: g.ingredients.map((ing) => ({
      ...ing,
      qty: ing.qty ? scaleQuantity(ing.qty, factor) : ing.qty
    }))
  }));
  return {
    ...state,
    recipe: touch({ ...state.recipe, servings: target, ingredientGroups: groups })
  };
}

export function setGroupName(state: AppState, gi: number, name: string): AppState {
  const groups = state.recipe.ingredientGroups.map((g, i) =>
    i === gi ? { ...g, name: name || undefined } : g
  ) as IngredientGroup[];
  return { ...state, recipe: touch({ ...state.recipe, ingredientGroups: groups }) };
}

export function setSectionName(state: AppState, si: number, name: string): AppState {
  const sections = state.recipe.stepSections.map((s, i) =>
    i === si ? { ...s, name: name || undefined } : s
  ) as StepSection[];
  return { ...state, recipe: touch({ ...state.recipe, stepSections: sections }) };
}

export function updateSubstitution(
  state: AppState,
  index: number,
  patch: Partial<Substitution>
): AppState {
  const subs = [...(state.recipe.substitutions ?? [])];
  const current = subs[index] ?? { from: "", to: "" };
  subs[index] = { ...current, ...patch };
  const cleaned = subs.filter((s) => s.from.trim() || s.to.trim());
  return {
    ...state,
    recipe: touch({ ...state.recipe, substitutions: cleaned.length ? cleaned : undefined })
  };
}

export function addSubstitution(state: AppState): AppState {
  const subs = [...(state.recipe.substitutions ?? []), { from: "", to: "" }];
  return { ...state, recipe: touch({ ...state.recipe, substitutions: subs }) };
}

export function removeSubstitution(state: AppState, index: number): AppState {
  const subs = (state.recipe.substitutions ?? []).filter((_, i) => i !== index);
  return {
    ...state,
    recipe: touch({ ...state.recipe, substitutions: subs.length ? subs : undefined })
  };
}
