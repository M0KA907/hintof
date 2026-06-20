import { describe, expect, test } from "vitest";
import { createStore } from "../../src/store/store";
import {
  beginSave,
  finishSave,
  initialState,
  removeFromLibrary,
  setTitle
} from "../../src/store/actions";

describe("store", () => {
  test("subscribe and update", () => {
    const store = createStore(initialState());
    let seen = "";
    store.subscribe((s) => {
      seen = s.recipe.title;
    });
    store.update((s) => setTitle(s, "Soup"));
    expect(seen).toBe("Soup");
    expect(store.get().recipe.title).toBe("Soup");
  });
});

describe("save lifecycle", () => {
  test("beginSave upserts in-memory and marks saving (not yet durable)", () => {
    const s0 = setTitle(initialState(), "Stew");
    const s1 = beginSave(s0);
    expect(s1.library).toHaveLength(1);
    expect(s1.library[0]?.id).toBe(s0.recipe.id);
    expect(s1.status).toBe("Saving…");
    expect(s1.storageStatus).toBe("saving");
  });

  test("finishSave(false) never claims saved and flags unsaved", () => {
    const failed = finishSave(beginSave(setTitle(initialState(), "Stew")), false);
    expect(failed.storageStatus).toBe("failed");
    expect(failed.status).not.toMatch(/saved to library/i);
    // the optimistic in-memory copy stays so the user doesn't lose their edits
    expect(failed.library).toHaveLength(1);
  });

  test("finishSave(true) confirms durability", () => {
    const ok = finishSave(beginSave(setTitle(initialState(), "Stew")), true);
    expect(ok.storageStatus).toBe("saved");
    expect(ok.status).toBe("Saved to library.");
  });

  test("removeFromLibrary is pure: drops the recipe, sets no status", () => {
    const saved = beginSave(setTitle(initialState(), "Stew"));
    const removed = removeFromLibrary(saved, saved.recipe.id);
    expect(removed.library).toHaveLength(0);
    expect(removed.status).toBe("Saving…"); // unchanged by the pure reducer
  });
});
