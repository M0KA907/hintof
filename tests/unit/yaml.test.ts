import { parse as parseYaml } from "yaml";
import { describe, expect, test } from "vitest";
import { yamlString, yamlList, yamlBlock } from "../../src/serialize/yaml";

describe("yaml", () => {
  test("quotes colons and reserved words", () => {
    expect(yamlString("Mac & Cheese: Mom's")).toBe('"Mac & Cheese: Mom\'s"');
    expect(yamlString("true")).toBe('"true"');
    expect(yamlString("null")).toBe('"null"');
    expect(yamlString("123")).toBe('"123"');
    expect(yamlString("2026-06-20T12:00:00.000Z")).toBe('"2026-06-20T12:00:00.000Z"');
  });

  test("preserves unicode unquoted when safe", () => {
    expect(yamlString("Crème Brûlée")).toBe("Crème Brûlée");
  });

  test("escapes newlines in quoted strings", () => {
    expect(yamlString("line\nbreak")).toBe('"line\\nbreak"');
  });

  test("emitted frontmatter parses", () => {
    const block = yamlBlock([
      "schema_version: 1",
      'title: "Colon: Title"',
      "tags:",
      "  - weeknight",
      "created: 2026-06-19",
      "updated: 2026-06-19"
    ]);
    const doc = parseYaml(block);
    expect(doc.title).toBe("Colon: Title");
    expect(doc.tags).toEqual(["weeknight"]);
  });

  test("yamlList omits empty", () => {
    expect(yamlList("tags", [])).toEqual([]);
    expect(yamlList("tags", ["a", ""])).toEqual(["tags:", "  - a"]);
  });
});
