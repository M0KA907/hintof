import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IdbRecipeRepository, openDatabase, requestToPromise } from "../../src/persist/repo/idb";
import { emptyRecipe } from "../../src/model/types";
import type { Recipe } from "../../src/model/types";
import type { StoredDraft } from "../../src/persist/repo/types";

function recipe(title: string, updated = "2026-01-01"): Recipe {
  return emptyRecipe({ title, updated, created: "2026-01-01" });
}

function draftOf(r: Recipe): StoredDraft {
  return {
    key: "current",
    recipe: r,
    recipeId: r.id,
    updatedAt: "2026-01-02T00:00:00.000Z",
    revision: 1
  };
}

let repo: IdbRecipeRepository;

beforeEach(async () => {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase("hintof");
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
  const db = await openDatabase();
  repo = new IdbRecipeRepository(db);
});

afterEach(async () => {
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase("hintof");
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
});

describe("IdbRecipeRepository", () => {
  it("creates the four object stores", async () => {
    const db = await openDatabase();
    expect([...db.objectStoreNames].sort()).toEqual(["drafts", "meta", "recipes", "snapshots"]);
  });

  it("stores recipes as individual records", async () => {
    const a = recipe("Soup");
    const b = recipe("Bread");
    await repo.saveRecipe(a);
    await repo.saveRecipe(b);
    const all = await repo.listRecipes();
    expect(all.map((r) => r.title).sort()).toEqual(["Bread", "Soup"]);
    expect((await repo.getRecipe(a.id))?.title).toBe("Soup");
  });

  it("updates an existing record instead of duplicating", async () => {
    const a = recipe("Soup");
    await repo.saveRecipe(a);
    await repo.saveRecipe({ ...a, title: "Better Soup" });
    const all = await repo.listRecipes();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe("Better Soup");
  });

  it("rejects an invalid recipe write", async () => {
    await expect(repo.saveRecipe({ id: "", title: "x" } as unknown as Recipe)).rejects.toThrow();
  });

  it("deletes a record", async () => {
    const a = recipe("Soup");
    await repo.saveRecipe(a);
    await repo.deleteRecipe(a.id);
    expect(await repo.listRecipes()).toHaveLength(0);
  });

  it("saves, reads and clears the draft", async () => {
    const d = draftOf(recipe("Draft"));
    await repo.saveDraft(d);
    expect((await repo.getDraft())?.recipe.title).toBe("Draft");
    await repo.clearDraft();
    expect(await repo.getDraft()).toBeUndefined();
  });

  it("round-trips meta values", async () => {
    await repo.setMeta("k", { hello: "world" });
    expect(await repo.getMeta("k")).toEqual({ hello: "world" });
  });

  it("replaceAll swaps the whole library atomically", async () => {
    await repo.saveRecipe(recipe("Old"));
    const fresh = [recipe("New A"), recipe("New B")];
    await repo.replaceAll(fresh, null);
    const all = await repo.listRecipes();
    expect(all.map((r) => r.title).sort()).toEqual(["New A", "New B"]);
  });

  it("retains only the five newest snapshots", async () => {
    await repo.saveRecipe(recipe("Soup"));
    for (let i = 0; i < 7; i++) {
      // distinct createdAt is derived from Date.now in createSnapshot; space them
      await repo.createSnapshot("before-bulk-delete");
      await new Promise((r) => setTimeout(r, 2));
    }
    const snaps = await repo.listSnapshots();
    expect(snaps.length).toBe(5);
  });

  it("restoreSnapshot brings back the captured library", async () => {
    await repo.saveRecipe(recipe("Keep"));
    const snap = await repo.createSnapshot("before-restore-replace");
    await repo.replaceAll([recipe("Wiped")], null);
    const result = await repo.restoreSnapshot(snap.id);
    expect(result.ok).toBe(true);
    const all = await repo.listRecipes();
    expect(all.map((r) => r.title)).toEqual(["Keep"]);
  });

  it("resolves writes only after the transaction commits", async () => {
    const a = recipe("Durable");
    await repo.saveRecipe(a);
    // A fresh connection must see it — proves we waited for oncomplete.
    const db2 = await openDatabase();
    const raw = await requestToPromise(
      db2.transaction("recipes", "readonly").objectStore("recipes").get(a.id) as IDBRequest<unknown>
    );
    expect(raw).toBeTruthy();
  });
});
