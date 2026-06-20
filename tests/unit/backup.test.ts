import { describe, expect, it } from "vitest";
import {
  applyRestore,
  canonicalJson,
  classifyRestore,
  createBackup,
  verifyChecksum
} from "../../src/persist/backup";
import { decideDraftRestore } from "../../src/persist/repo/draft-conflict";
import { emptyRecipe } from "../../src/model/types";
import type { StoredDraft } from "../../src/persist/repo/types";

describe("canonicalJson", () => {
  it("sorts object keys recursively and preserves array order", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
    expect(canonicalJson([3, 1, 2])).toBe("[3,1,2]");
  });
});

describe("backup checksum", () => {
  it("round-trips and verifies", async () => {
    const backup = await createBackup(
      [emptyRecipe({ title: "Soup" })],
      null,
      "2026-06-20T00:00:00.000Z"
    );
    expect(backup.checksum.startsWith("sha256-")).toBe(true);
    expect(await verifyChecksum(backup)).toBe(true);
  });

  it("fails verification when contents are altered", async () => {
    const backup = await createBackup(
      [emptyRecipe({ title: "Soup" })],
      null,
      "2026-06-20T00:00:00.000Z"
    );
    backup.recipes[0].title = "Tampered";
    expect(await verifyChecksum(backup)).toBe(false);
  });
});

describe("classifyRestore", () => {
  it("classifies new, updated, duplicate, conflict and invalid", () => {
    const base = emptyRecipe({ title: "Soup", updated: "2026-01-01" });
    const existing = [base, emptyRecipe({ title: "Stew", updated: "2026-05-01" })];
    const incoming = [
      base, // exact duplicate
      { ...existing[1], updated: "2026-06-01" }, // newer => updated
      emptyRecipe({ title: "New One" }), // new
      { ...existing[1], title: "Older edit", updated: "2026-01-01" }, // older => conflict
      { junk: true } // invalid
    ];
    const preview = classifyRestore({ recipes: incoming }, existing, false);
    expect(preview.exactDuplicates).toHaveLength(1);
    expect(preview.updatedRecipes).toHaveLength(1);
    expect(preview.newRecipes).toHaveLength(1);
    expect(preview.conflicts).toHaveLength(1);
    expect(preview.invalidEntries).toHaveLength(1);
  });

  it("does not write — pure classification", () => {
    const existing = [emptyRecipe({ title: "Soup" })];
    const before = existing.length;
    classifyRestore({ recipes: [emptyRecipe({ title: "X" })] }, existing, false);
    expect(existing.length).toBe(before);
  });
});

describe("applyRestore", () => {
  const base = emptyRecipe({ title: "Soup", updated: "2026-01-01" });
  const stew = emptyRecipe({ title: "Stew", updated: "2026-05-01" });
  const existing = [base, stew];
  const incoming = [
    base, // exact duplicate -> skip
    { ...stew, updated: "2026-06-01" }, // newer -> overwrite
    emptyRecipe({ title: "New One" }), // new -> add
    { ...stew, title: "Older edit", updated: "2026-01-01" }, // older -> skip
    { junk: true } // invalid
  ];

  it("merge keeps existing, overwrites only newer, skips dup/older/invalid", () => {
    const r = applyRestore({ recipes: incoming }, existing, "merge");
    expect(r.added).toBe(1);
    expect(r.updated).toBe(1);
    expect(r.skipped).toBe(2);
    expect(r.invalid).toBe(1);
    expect(r.recipes).toHaveLength(3); // soup + stew(updated) + new one
    expect(r.recipes.find((x) => x.id === stew.id)?.updated).toBe("2026-06-01");
  });

  it("replace returns only valid incoming recipes", () => {
    const r = applyRestore({ recipes: incoming }, existing, "replace");
    expect(r.invalid).toBe(1);
    expect(r.recipes).toHaveLength(4);
    expect(r.added).toBe(4);
  });
});

describe("decideDraftRestore", () => {
  const mkDraft = (title: string, id?: string): StoredDraft => {
    const r = emptyRecipe({ title, ...(id ? { id } : {}) });
    return {
      key: "current",
      recipe: r,
      recipeId: r.id,
      updatedAt: "2026-06-20T00:00:00.000Z",
      revision: 1
    };
  };

  it("discards an empty draft automatically", () => {
    const d = mkDraft("");
    expect(decideDraftRestore(d, []).action).toBe("discard-automatically");
  });

  it("discards when the draft matches a saved recipe", () => {
    const r = emptyRecipe({ title: "Soup" });
    const d: StoredDraft = {
      key: "current",
      recipe: r,
      recipeId: r.id,
      updatedAt: "x",
      revision: 1
    };
    expect(decideDraftRestore(d, [r]).action).toBe("discard-automatically");
  });

  it("prompts for an unsaved new draft with content", () => {
    expect(decideDraftRestore(mkDraft("Brand New"), []).action).toBe("prompt");
  });

  it("prompts when a saved recipe has unsaved draft edits", () => {
    const saved = emptyRecipe({ title: "Soup" });
    const d: StoredDraft = {
      key: "current",
      recipe: { ...saved, title: "Soup Deluxe" },
      recipeId: saved.id,
      updatedAt: "x",
      revision: 2
    };
    const decision = decideDraftRestore(d, [saved]);
    expect(decision.action).toBe("prompt");
  });
});
