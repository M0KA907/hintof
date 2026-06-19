import { describe, expect, test } from "vitest";
import { createStore } from "../../src/store/store";
import { initialState, setTitle } from "../../src/store/actions";

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
