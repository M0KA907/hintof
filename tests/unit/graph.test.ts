import { describe, expect, test } from "vitest";
import { buildGraph, selectVisibleEdges } from "../../src/ui/views/graph";
import type { Recipe } from "../../src/model/types";

function recipe(title: string, tags: string[]): Recipe {
  return {
    id: title.toLowerCase().replace(/\s+/g, "-"),
    schemaVersion: 2,
    title,
    tags,
    ingredientGroups: [{ ingredients: [{ item: "salt" }] }],
    stepSections: [{ steps: ["Cook."] }],
    created: "2026-06-20",
    updated: "2026-06-20",
    options: {
      wikiLinks: { ingredients: false, cuisine: false },
      callouts: false,
      fractionStyle: "unicode"
    }
  };
}

describe("graph edge selection", () => {
  test("keeps dense libraries readable by selecting local strongest edges", () => {
    const recipes = Array.from({ length: 12 }, (_, i) =>
      recipe(`Backlinked ${i + 1}`, ["shared", i % 2 ? "odd" : "even"])
    );
    const graph = buildGraph(recipes);
    const visible = selectVisibleEdges(graph.edges, graph.nodes.length, 3);

    expect(graph.edges.length).toBe(66);
    expect(visible.length).toBeLessThan(graph.edges.length);

    const represented = new Set<number>();
    for (const edge of visible) {
      represented.add(edge.a);
      represented.add(edge.b);
    }
    expect(represented.size).toBe(graph.nodes.length);
  });
});
