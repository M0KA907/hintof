import { describe, expect, it } from "vitest";
import { searchItems } from "../../src/search/search.ts";
import { normalizeSearchText } from "../../src/search/normalize.ts";

interface Dish {
  title: string;
}

const get = (d: Dish) => d.title;

describe("normalizeSearchText", () => {
  it("strips diacritics and lowercases", () => {
    expect(normalizeSearchText("Crème Brûlée")).toBe("creme brulee");
  });

  it("collapses whitespace", () => {
    expect(normalizeSearchText("  Foo   Bar  ")).toBe("foo bar");
  });
});

describe("searchItems", () => {
  it("returns all items in original order for an empty query", () => {
    const items: Dish[] = [{ title: "B" }, { title: "A" }, { title: "C" }];
    const result = searchItems("", items, get);
    expect(result.map((r) => r.item.title)).toEqual(["B", "A", "C"]);
    expect(result.every((r) => r.score === 0)).toBe(true);
  });

  it("returns all items for whitespace-only query", () => {
    const items: Dish[] = [{ title: "A" }, { title: "B" }];
    expect(searchItems("   ", items, get)).toHaveLength(2);
  });

  it("matches across diacritics via normalization", () => {
    const items: Dish[] = [{ title: "Creme Brulee" }];
    const result = searchItems("crème brûlée", items, get);
    expect(result).toHaveLength(1);
    expect(result[0].item.title).toBe("Creme Brulee");
  });

  it("matches a distance-1 transposition on a long token", () => {
    // "choclate" (8) vs "chocolate" (9): single deletion, distance 1.
    const items: Dish[] = [{ title: "Chocolate Cake" }];
    const result = searchItems("choclate cake", items, get);
    expect(result).toHaveLength(1);
    expect(result[0].item.title).toBe("Chocolate Cake");
  });

  it("does NOT match unrelated short dishes (strictness)", () => {
    const items: Dish[] = [{ title: "Ravioli" }, { title: "Risotto" }, { title: "Tacos" }];
    const result = searchItems("ramen", items, get);
    expect(result).toHaveLength(0);
  });

  it("ranks exact-substring above fuzzy-only", () => {
    const items: Dish[] = [
      { title: "Choclate Mousse" }, // fuzzy-only against "chocolate"
      { title: "Chocolate Cake" } // exact substring of "chocolate"
    ];
    const result = searchItems("chocolate", items, get);
    expect(result[0].item.title).toBe("Chocolate Cake");
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it("ranks prefix above fuzzy", () => {
    const items: Dish[] = [
      { title: "Bananna Bread" }, // fuzzy "banana"
      { title: "Banana Split" } // prefix "banana"
    ];
    const result = searchItems("banana", items, get);
    expect(result[0].item.title).toBe("Banana Split");
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it("preserves original order within the same tier", () => {
    const items: Dish[] = [
      { title: "Apple Pie" },
      { title: "Apple Crumble" },
      { title: "Apple Tart" }
    ];
    const result = searchItems("apple", items, get);
    expect(result.map((r) => r.item.title)).toEqual(["Apple Pie", "Apple Crumble", "Apple Tart"]);
  });

  it("does not fuzzy-match short queries (length <= 3)", () => {
    const items: Dish[] = [{ title: "Cat" }];
    // "bat" vs "cat" is distance 1 but length 3 => exact/prefix only.
    expect(searchItems("bat", items, get)).toHaveLength(0);
  });

  it("matches a haystack of multiple joined fields", () => {
    const items: Dish[] = [{ title: "Soup vegetable leek potato" }];
    const result = searchItems("potato", items, get);
    expect(result).toHaveLength(1);
  });
});
