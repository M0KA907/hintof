import type { Recipe } from "../model/types";
import type { AppState } from "../store/actions";
import { beginSave, finishSave, removeFromLibrary, setLibrary, setStatus } from "../store/actions";
import { saveDraft as saveLocalDraft } from "./autosave";
import { createBackup, type HintofBackupV2 } from "./backup";
import { saveLibrary } from "./library";
import { decideDraftRestore, type DraftRestoreDecision } from "./repo/draft-conflict";
import { initRepository, requestPersistentStorage } from "./repo";
import type { RecipeRepository, StoredDraft } from "./repo/types";

// Side-effect boundary between the synchronous store and the async repository.
// Reducers stay pure; everything that awaits IndexedDB lives here.

interface AppStore {
  get(): AppState;
  update(fn: (s: AppState) => AppState): void;
}

let repo: RecipeRepository | null = null;
let persistRequested = false;
let draftRevision = 0;
let draftTimer: ReturnType<typeof setTimeout> | null = null;

export function getRepo(): RecipeRepository | null {
  return repo;
}

/**
 * Open the repository, run the one-shot migration, then reconcile the store's
 * bootstrap (localStorage) library with IndexedDB. Returns the draft decision so
 * the caller can render a restore prompt. Falls back to "unavailable" — keeping
 * the localStorage path — if IndexedDB cannot be opened.
 */
export async function initLive(
  store: AppStore,
  now = new Date().toISOString()
): Promise<DraftRestoreDecision | null> {
  try {
    const { repository } = await initRepository(now);
    repo = repository;
    const library = await repository.listRecipes();
    const draft = await repository.getDraft();
    store.update((s) => setLibrary(s, library));
    store.update((s) => ({ ...s, storageStatus: "ready" }));
    return decideDraftRestore(draft, library);
  } catch {
    repo = null;
    store.update((s) => ({ ...s, storageStatus: "unavailable" }));
    return null;
  }
}

/** Save the current recipe, confirming success only after the write commits. */
export async function saveLive(store: AppStore): Promise<void> {
  if (!store.get().recipe.title.trim()) {
    store.update((s) => setStatus(s, "Add a title before saving."));
    return;
  }
  store.update(beginSave);
  const recipe = store.get().recipe;
  let ok: boolean;
  if (repo) {
    try {
      await repo.saveRecipe(recipe);
      ok = true;
      if (!persistRequested) {
        persistRequested = true;
        void requestPersistentStorage(repo);
      }
    } catch {
      ok = false;
    }
  } else {
    ok = saveLibrary(store.get().library).ok;
  }
  store.update((s) => finishSave(s, ok));
}

/** Remove a recipe optimistically, then confirm the durable delete. */
export async function removeLive(store: AppStore, id: string): Promise<void> {
  store.update((s) => removeFromLibrary(s, id));
  let ok: boolean;
  if (repo) {
    try {
      await repo.deleteRecipe(id);
      ok = true;
    } catch {
      ok = false;
    }
  } else {
    ok = saveLibrary(store.get().library).ok;
  }
  store.update((s) =>
    setStatus(s, ok ? "Removed from library." : "Removed here, but storage could not update.")
  );
}

/** Replace the whole library (merge import). Preserves the stored draft. */
export async function replaceLibraryLive(store: AppStore, recipes: Recipe[]): Promise<boolean> {
  store.update((s) => setLibrary(s, recipes));
  if (repo) {
    try {
      await repo.replaceAll(recipes, (await repo.getDraft()) ?? null);
      return true;
    } catch {
      return false;
    }
  }
  return saveLibrary(recipes).ok;
}

/** The current stored draft, if any (for import-review draft classification). */
export async function getStoredDraft(): Promise<StoredDraft | undefined> {
  if (!repo) return undefined;
  try {
    return await repo.getDraft();
  } catch {
    return undefined;
  }
}

/** Build a versioned, checksummed v2 backup of the library + current draft. */
export async function exportBackupLive(
  store: AppStore,
  now = new Date().toISOString()
): Promise<HintofBackupV2> {
  const draft = repo ? ((await repo.getDraft()) ?? null) : null;
  return createBackup(store.get().library, draft, now);
}

/** Replace-restore: snapshot the current state first, then overwrite. */
export async function restoreReplaceLive(
  store: AppStore,
  recipes: Recipe[],
  draft: StoredDraft | null
): Promise<boolean> {
  if (repo) {
    try {
      await repo.createSnapshot("before-restore-replace"); // capture old state first
      await repo.replaceAll(recipes, draft);
      store.update((s) => setLibrary(s, recipes));
      return true;
    } catch {
      return false;
    }
  }
  store.update((s) => setLibrary(s, recipes));
  return saveLibrary(recipes).ok;
}

/** Debounced draft autosave. Best-effort; never blocks or surfaces errors. */
export function autosaveDraftLive(recipe: Recipe, ms = 500): void {
  if (draftTimer) clearTimeout(draftTimer);
  draftTimer = setTimeout(() => void writeDraft(recipe), ms);
}

async function writeDraft(recipe: Recipe): Promise<void> {
  if (!repo) {
    saveLocalDraft(recipe);
    return;
  }
  const draft: StoredDraft = {
    key: "current",
    recipe,
    recipeId: recipe.id,
    baseRecipeUpdatedAt: recipe.updated,
    updatedAt: new Date().toISOString(),
    revision: ++draftRevision
  };
  try {
    await repo.saveDraft(draft);
  } catch {
    /* draft loss is recoverable; the user still has the in-memory editor */
  }
}

export async function clearDraftLive(): Promise<void> {
  if (!repo) return;
  try {
    await repo.clearDraft();
  } catch {
    /* best-effort */
  }
}
