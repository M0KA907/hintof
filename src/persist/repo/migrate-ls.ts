import type { Recipe } from "../../model/types";
import { normalizeRecipe } from "../migrate";
import { requestToPromise } from "./idb";
import type { MigrationReport, MigrationWarning, StoredDraft } from "./types";

export const LEGACY_LIBRARY_KEY = "hintof:library";
export const LEGACY_DRAFT_KEY = "hintof:draft";
export const MIGRATION_META_KEY = "migration:localstorage-to-indexeddb-v1";

function preview(value: string): string {
  return value.length > 80 ? `${value.slice(0, 80)}…` : value;
}

function readLegacyLibrary(warnings: MigrationWarning[]): { recipes: Recipe[]; found: number } {
  const raw = localStorage.getItem(LEGACY_LIBRARY_KEY);
  if (!raw) return { recipes: [], found: 0 };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Never turn unreadable data into a silent empty library.
    warnings.push({
      location: LEGACY_LIBRARY_KEY,
      reason: "Legacy library JSON could not be parsed",
      valuePreview: preview(raw)
    });
    return { recipes: [], found: 0 };
  }
  const arr =
    parsed && typeof parsed === "object" && "recipes" in parsed
      ? (parsed as { recipes: unknown }).recipes
      : parsed;
  if (!Array.isArray(arr)) {
    warnings.push({
      location: LEGACY_LIBRARY_KEY,
      reason: "Legacy library was not an array of recipes",
      valuePreview: preview(raw)
    });
    return { recipes: [], found: 0 };
  }

  // Deduplicate by id, preferring the entry with the latest `updated`.
  const byId = new Map<string, Recipe>();
  let found = 0;
  arr.forEach((entry, index) => {
    found += 1;
    const recipe = normalizeRecipe(entry);
    if (!recipe) {
      warnings.push({
        location: `${LEGACY_LIBRARY_KEY}[${index}]`,
        reason: "Invalid or unsupported recipe schema; quarantined",
        valuePreview: preview(JSON.stringify(entry))
      });
      return;
    }
    const existing = byId.get(recipe.id);
    if (!existing || recipe.updated.localeCompare(existing.updated) >= 0)
      byId.set(recipe.id, recipe);
  });
  return { recipes: [...byId.values()], found };
}

function readLegacyDraft(warnings: MigrationWarning[], now: string): StoredDraft | null {
  const raw = localStorage.getItem(LEGACY_DRAFT_KEY);
  if (!raw) return null;
  let recipe: Recipe | null;
  try {
    recipe = normalizeRecipe(JSON.parse(raw));
  } catch {
    warnings.push({
      location: LEGACY_DRAFT_KEY,
      reason: "Legacy draft JSON could not be parsed",
      valuePreview: preview(raw)
    });
    return null;
  }
  if (!recipe) {
    warnings.push({
      location: LEGACY_DRAFT_KEY,
      reason: "Legacy draft was not a valid recipe; not imported",
      valuePreview: preview(raw)
    });
    return null;
  }
  return {
    key: "current",
    recipe,
    recipeId: recipe.id,
    baseRecipeUpdatedAt: recipe.updated,
    updatedAt: now,
    revision: 1
  };
}

/**
 * Migrate legacy localStorage into IndexedDB exactly once, atomically.
 * Returns the report, or null if migration already ran. Never touches/deletes
 * localStorage — it stays as rollback data. Throws if the transaction fails so
 * the caller leaves the migration flag unset and retries on the next load.
 */
export async function migrateLegacyStorage(
  db: IDBDatabase,
  now: string
): Promise<MigrationReport | null> {
  const metaTx = db.transaction("meta", "readonly");
  const done = await requestToPromise(
    metaTx.objectStore("meta").get(MIGRATION_META_KEY) as IDBRequest<unknown>
  );
  if (done) return null;

  const warnings: MigrationWarning[] = [];
  const { recipes, found } = readLegacyLibrary(warnings);
  const draft = readLegacyDraft(warnings, now);

  const report: MigrationReport = {
    migrationId: "localstorage-to-indexeddb-v1",
    startedAt: now,
    completedAt: now,
    sourceKeys: [LEGACY_LIBRARY_KEY, LEGACY_DRAFT_KEY],
    recipesFound: found,
    recipesImported: recipes.length,
    recipesSkipped: found - recipes.length,
    draftImported: Boolean(draft),
    warnings,
    legacyDataPreserved: true
  };

  // Single transaction across all touched stores: recipes + draft + meta commit
  // together, or nothing does.
  const tx = db.transaction(["recipes", "drafts", "meta"], "readwrite");
  const recipeStore = tx.objectStore("recipes");
  for (const recipe of recipes) recipeStore.put(recipe);
  if (draft) tx.objectStore("drafts").put(draft);
  const meta = tx.objectStore("meta");
  meta.put({ key: `${MIGRATION_META_KEY}:report`, value: report });
  meta.put({ key: MIGRATION_META_KEY, value: true });

  await new Promise<void>((resolve, reject) => {
    tx.addEventListener("complete", () => resolve(), { once: true });
    tx.addEventListener("error", () => reject(tx.error ?? new Error("Migration tx failed")), {
      once: true
    });
    tx.addEventListener("abort", () => reject(tx.error ?? new Error("Migration tx aborted")), {
      once: true
    });
  });

  return report;
}
