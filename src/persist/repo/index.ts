import { IdbRecipeRepository, openDatabase } from "./idb";
import { migrateLegacyStorage } from "./migrate-ls";
import type { PersistentStorage, RecipeRepository, StorageInitializationResult } from "./types";

const PERSIST_META_KEY = "storage:persistent";

export interface InitializedRepository {
  repository: RecipeRepository;
  result: StorageInitializationResult;
}

/**
 * Open IndexedDB, run the one-time localStorage migration, and return a ready
 * repository. Falls back to "degraded" status (caller can warn the user and keep
 * the legacy localStorage path) if IndexedDB is unavailable.
 */
export async function initRepository(
  now = new Date().toISOString()
): Promise<InitializedRepository> {
  const warnings: string[] = [];
  const db = await openDatabase();
  const repository = new IdbRecipeRepository(db);

  let migration;
  try {
    migration = (await migrateLegacyStorage(db, now)) ?? undefined;
    if (migration?.warnings.length) {
      warnings.push(`${migration.warnings.length} item(s) needed attention during migration.`);
    }
  } catch (error) {
    warnings.push(`Migration deferred: ${String(error)}`);
  }

  const persistentStorage =
    (await repository.getMeta<PersistentStorage>(PERSIST_META_KEY)) ?? "not-requested";

  return {
    repository,
    result: { status: "ready", migration, persistentStorage, warnings }
  };
}

/** Request persistent storage once after the first successful save (Phase 6). */
export async function requestPersistentStorage(
  repository: RecipeRepository
): Promise<PersistentStorage> {
  const prior = await repository.getMeta<PersistentStorage>(PERSIST_META_KEY);
  if (prior && prior !== "not-requested") return prior;

  let outcome: PersistentStorage;
  if (!navigator.storage?.persist) {
    outcome = "unsupported";
  } else {
    try {
      outcome = (await navigator.storage.persist()) ? "granted" : "denied";
    } catch {
      outcome = "denied";
    }
  }
  await repository.setMeta(PERSIST_META_KEY, outcome);
  return outcome;
}
