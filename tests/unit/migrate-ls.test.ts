import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, IdbRecipeRepository } from "../../src/persist/repo/idb";
import {
  LEGACY_DRAFT_KEY,
  LEGACY_LIBRARY_KEY,
  migrateLegacyStorage
} from "../../src/persist/repo/migrate-ls";
import { emptyRecipe } from "../../src/model/types";

// Minimal in-memory localStorage shim (node has none).
class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}

const NOW = "2026-06-20T00:00:00.000Z";

beforeEach(async () => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemStorage();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase("hintof");
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
});

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe("migrateLegacyStorage", () => {
  it("imports valid recipes and the draft transactionally", async () => {
    const a = emptyRecipe({ title: "Soup" });
    const b = emptyRecipe({ title: "Bread" });
    localStorage.setItem(LEGACY_LIBRARY_KEY, JSON.stringify([a, b]));
    localStorage.setItem(LEGACY_DRAFT_KEY, JSON.stringify(emptyRecipe({ title: "Draft" })));

    const db = await openDatabase();
    const report = await migrateLegacyStorage(db, NOW);
    expect(report?.recipesImported).toBe(2);
    expect(report?.draftImported).toBe(true);
    expect(report?.legacyDataPreserved).toBe(true);

    const repo = new IdbRecipeRepository(await openDatabase());
    expect((await repo.listRecipes()).map((r) => r.title).sort()).toEqual(["Bread", "Soup"]);
    expect((await repo.getDraft())?.recipe.title).toBe("Draft");
  });

  it("preserves legacy localStorage untouched", async () => {
    const raw = JSON.stringify([emptyRecipe({ title: "Soup" })]);
    localStorage.setItem(LEGACY_LIBRARY_KEY, raw);
    const db = await openDatabase();
    await migrateLegacyStorage(db, NOW);
    expect(localStorage.getItem(LEGACY_LIBRARY_KEY)).toBe(raw);
  });

  it("is idempotent — a second run does nothing", async () => {
    localStorage.setItem(LEGACY_LIBRARY_KEY, JSON.stringify([emptyRecipe({ title: "Soup" })]));
    const db = await openDatabase();
    expect(await migrateLegacyStorage(db, NOW)).not.toBeNull();
    expect(await migrateLegacyStorage(await openDatabase(), NOW)).toBeNull();
  });

  it("never converts malformed JSON into a silent empty library", async () => {
    localStorage.setItem(LEGACY_LIBRARY_KEY, '[{"id":"broken"');
    const db = await openDatabase();
    const report = await migrateLegacyStorage(db, NOW);
    expect(report?.recipesImported).toBe(0);
    expect(report?.warnings.some((w) => w.location === LEGACY_LIBRARY_KEY)).toBe(true);
  });

  it("quarantines invalid entries but imports valid ones", async () => {
    const good = emptyRecipe({ title: "Good" });
    localStorage.setItem(LEGACY_LIBRARY_KEY, JSON.stringify([good, { junk: true }]));
    const db = await openDatabase();
    const report = await migrateLegacyStorage(db, NOW);
    expect(report?.recipesImported).toBe(1);
    expect(report?.recipesSkipped).toBe(1);
  });
});
