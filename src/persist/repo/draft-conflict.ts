import type { Recipe } from "../../model/types";
import { canonicalJson } from "../backup";
import type { StoredDraft } from "./types";

export type DraftRestoreDecision =
  | { action: "restore-automatically"; reason: string }
  | { action: "discard-automatically"; reason: string }
  | { action: "prompt"; reason: string; draft: StoredDraft; savedRecipe?: Recipe };

function hasMeaningfulContent(recipe: Recipe): boolean {
  if (recipe.title.trim()) return true;
  if (recipe.ingredientGroups.some((g) => g.ingredients.some((i) => i.item.trim()))) return true;
  if (recipe.stepSections.some((s) => s.steps.some((step) => step.trim()))) return true;
  return false;
}

/**
 * Decide whether a stored draft should be restored. Never silently replaces the
 * editor with an older or divergent draft — anything ambiguous prompts the user.
 */
export function decideDraftRestore(
  draft: StoredDraft | undefined,
  library: Recipe[]
): DraftRestoreDecision {
  if (!draft) return { action: "discard-automatically", reason: "No stored draft." };
  if (!hasMeaningfulContent(draft.recipe)) {
    return { action: "discard-automatically", reason: "Draft is empty." };
  }

  const saved = draft.recipeId
    ? library.find((r) => r.id === draft.recipeId)
    : library.find((r) => r.id === draft.recipe.id);

  if (saved && canonicalJson(saved) === canonicalJson(draft.recipe)) {
    return { action: "discard-automatically", reason: "Draft matches the saved recipe." };
  }

  return saved
    ? {
        action: "prompt",
        reason: "Draft has unsaved changes to a saved recipe.",
        draft,
        savedRecipe: saved
      }
    : { action: "prompt", reason: "Draft for an unsaved recipe.", draft };
}
