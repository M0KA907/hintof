import type { Recipe } from "../../model/types";

// Phase 2 — asynchronous persistence boundary. UI/store talk to this interface
// only; the concrete implementation (IndexedDB) is swappable for tests/rollback.

export type StorageStatus =
  | "initializing"
  | "ready"
  | "saving"
  | "saved"
  | "failed"
  | "unavailable";

export type PersistentStorage = "granted" | "denied" | "unsupported" | "not-requested";

export interface StorageInitializationResult {
  status: "ready" | "degraded";
  migration?: MigrationReport;
  persistentStorage?: PersistentStorage;
  warnings: string[];
}

export interface StoredDraft {
  key: "current";
  recipe: Recipe;
  recipeId?: string;
  baseRecipeUpdatedAt?: string;
  updatedAt: string;
  revision: number;
}

export type SnapshotReason =
  | "before-restore-replace"
  | "before-bulk-delete"
  | "before-schema-migration";

export interface Snapshot {
  id: string;
  createdAt: string;
  reason: SnapshotReason;
  recipeSchemaVersion: number;
  recipes: Recipe[];
  draft: StoredDraft | null;
}

export type SnapshotMetadata = Omit<Snapshot, "recipes" | "draft"> & {
  recipeCount: number;
};

export interface MigrationWarning {
  location: string;
  reason: string;
  valuePreview?: string;
}

export interface MigrationReport {
  migrationId: "localstorage-to-indexeddb-v1";
  startedAt: string;
  completedAt: string;
  sourceKeys: string[];
  recipesFound: number;
  recipesImported: number;
  recipesSkipped: number;
  draftImported: boolean;
  warnings: MigrationWarning[];
  legacyDataPreserved: true;
}

export interface RestoreResult {
  ok: boolean;
  restoredRecipes: number;
  snapshotId?: string;
  error?: string;
}

export interface RecipeRepository {
  listRecipes(): Promise<Recipe[]>;
  getRecipe(id: string): Promise<Recipe | undefined>;
  saveRecipe(recipe: Recipe): Promise<void>;
  deleteRecipe(id: string): Promise<void>;
  replaceAll(recipes: Recipe[], draft: StoredDraft | null): Promise<void>;

  getDraft(): Promise<StoredDraft | undefined>;
  saveDraft(draft: StoredDraft): Promise<void>;
  clearDraft(): Promise<void>;

  createSnapshot(reason: SnapshotReason): Promise<Snapshot>;
  listSnapshots(): Promise<SnapshotMetadata[]>;
  restoreSnapshot(id: string): Promise<RestoreResult>;

  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta<T>(key: string, value: T): Promise<void>;
}
