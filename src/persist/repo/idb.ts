import type { Recipe } from "../../model/types";
import { normalizeRecipe } from "../migrate";
import type {
  RecipeRepository,
  RestoreResult,
  Snapshot,
  SnapshotMetadata,
  SnapshotReason,
  StoredDraft
} from "./types";

export const DB_NAME = "hintof";
export const DB_VERSION = 1;
const SNAPSHOT_LIMIT = 5;

type StoreName = "recipes" | "drafts" | "meta" | "snapshots";

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener(
      "error",
      () => reject(request.error ?? new Error("IndexedDB request failed")),
      { once: true }
    );
  });
}

// Resolve only when the whole transaction commits; reject on error or abort so a
// caller never treats an aborted write as durable.
function txComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.addEventListener("complete", () => resolve(), { once: true });
    tx.addEventListener("error", () => reject(tx.error ?? new Error("Transaction failed")), {
      once: true
    });
    tx.addEventListener("abort", () => reject(tx.error ?? new Error("Transaction aborted")), {
      once: true
    });
  });
}

export function openDatabase(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("recipes")) {
        const recipes = db.createObjectStore("recipes", { keyPath: "id" });
        recipes.createIndex("updated", "updated");
        recipes.createIndex("created", "created");
        // ponytail: titleNormalized/sourceCanonicalUrl indexes skipped — search
        // runs in memory over the loaded library; add here if it ever grows huge.
      }
      if (!db.objectStoreNames.contains("drafts"))
        db.createObjectStore("drafts", { keyPath: "key" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
      if (!db.objectStoreNames.contains("snapshots"))
        db.createObjectStore("snapshots", { keyPath: "id" });
    });
    request.addEventListener(
      "success",
      () => {
        const db = request.result;
        // Close on version change so another tab's upgrade/delete is not blocked.
        db.addEventListener("versionchange", () => db.close());
        resolve(db);
      },
      { once: true }
    );
    request.addEventListener("error", () => reject(request.error ?? new Error("open failed")), {
      once: true
    });
    request.addEventListener("blocked", () => reject(new Error("IndexedDB open blocked")), {
      once: true
    });
  });
}

function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export class IdbRecipeRepository implements RecipeRepository {
  constructor(private readonly db: IDBDatabase) {}

  private tx(stores: StoreName | StoreName[], mode: IDBTransactionMode): IDBTransaction {
    return this.db.transaction(stores, mode);
  }

  async listRecipes(): Promise<Recipe[]> {
    const tx = this.tx("recipes", "readonly");
    const all = await requestToPromise(tx.objectStore("recipes").getAll() as IDBRequest<unknown[]>);
    return all.map(normalizeRecipe).filter((r): r is Recipe => Boolean(r));
  }

  async getRecipe(id: string): Promise<Recipe | undefined> {
    const tx = this.tx("recipes", "readonly");
    const raw = await requestToPromise(tx.objectStore("recipes").get(id) as IDBRequest<unknown>);
    return normalizeRecipe(raw) ?? undefined;
  }

  async saveRecipe(recipe: Recipe): Promise<void> {
    const normalized = normalizeRecipe(recipe);
    if (!normalized) throw new Error("Refusing to persist an invalid recipe.");
    const tx = this.tx("recipes", "readwrite");
    tx.objectStore("recipes").put(normalized);
    await txComplete(tx);
  }

  async deleteRecipe(id: string): Promise<void> {
    const tx = this.tx("recipes", "readwrite");
    tx.objectStore("recipes").delete(id);
    await txComplete(tx);
  }

  async replaceAll(recipes: Recipe[], draft: StoredDraft | null): Promise<void> {
    const valid = recipes.map(normalizeRecipe).filter((r): r is Recipe => Boolean(r));
    const tx = this.tx(["recipes", "drafts"], "readwrite");
    const store = tx.objectStore("recipes");
    store.clear();
    for (const r of valid) store.put(r);
    const drafts = tx.objectStore("drafts");
    drafts.clear();
    if (draft) drafts.put(draft);
    await txComplete(tx);
  }

  async getDraft(): Promise<StoredDraft | undefined> {
    const tx = this.tx("drafts", "readonly");
    const raw = await requestToPromise(
      tx.objectStore("drafts").get("current") as IDBRequest<StoredDraft | undefined>
    );
    return raw ?? undefined;
  }

  async saveDraft(draft: StoredDraft): Promise<void> {
    const tx = this.tx("drafts", "readwrite");
    tx.objectStore("drafts").put(draft);
    await txComplete(tx);
  }

  async clearDraft(): Promise<void> {
    const tx = this.tx("drafts", "readwrite");
    tx.objectStore("drafts").delete("current");
    await txComplete(tx);
  }

  async createSnapshot(reason: SnapshotReason): Promise<Snapshot> {
    const recipes = await this.listRecipes();
    const draft = (await this.getDraft()) ?? null;
    const snapshot: Snapshot = {
      id: uuid(),
      createdAt: new Date().toISOString(),
      reason,
      recipeSchemaVersion: 2,
      recipes,
      draft
    };
    const tx = this.tx("snapshots", "readwrite");
    tx.objectStore("snapshots").put(snapshot);
    await txComplete(tx);
    await this.pruneSnapshots();
    return snapshot;
  }

  private async pruneSnapshots(): Promise<void> {
    const tx = this.tx("snapshots", "readwrite");
    const store = tx.objectStore("snapshots");
    const all = await requestToPromise(store.getAll() as IDBRequest<Snapshot[]>);
    // Prune only after the new snapshot already committed (caller order); keep newest 5.
    const sorted = [...all].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    for (const stale of sorted.slice(SNAPSHOT_LIMIT)) store.delete(stale.id);
    await txComplete(tx);
  }

  async listSnapshots(): Promise<SnapshotMetadata[]> {
    const tx = this.tx("snapshots", "readonly");
    const all = await requestToPromise(
      tx.objectStore("snapshots").getAll() as IDBRequest<Snapshot[]>
    );
    return all
      .map(({ id, createdAt, reason, recipeSchemaVersion, recipes }) => ({
        id,
        createdAt,
        reason,
        recipeSchemaVersion,
        recipeCount: recipes.length
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async restoreSnapshot(id: string): Promise<RestoreResult> {
    const tx = this.tx("snapshots", "readonly");
    const snapshot = await requestToPromise(
      tx.objectStore("snapshots").get(id) as IDBRequest<Snapshot | undefined>
    );
    if (!snapshot) return { ok: false, restoredRecipes: 0, error: "Snapshot not found." };
    try {
      await this.replaceAll(snapshot.recipes, snapshot.draft);
      return { ok: true, restoredRecipes: snapshot.recipes.length, snapshotId: id };
    } catch (error) {
      return { ok: false, restoredRecipes: 0, error: String(error) };
    }
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    const tx = this.tx("meta", "readonly");
    const raw = await requestToPromise(
      tx.objectStore("meta").get(key) as IDBRequest<{ key: string; value: T } | undefined>
    );
    return raw?.value;
  }

  async setMeta<T>(key: string, value: T): Promise<void> {
    const tx = this.tx("meta", "readwrite");
    tx.objectStore("meta").put({ key, value });
    await txComplete(tx);
  }
}
