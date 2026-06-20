import type {
  ExtractResult,
  ImportedIngredient,
  ImportedInstructionSection,
  ImportedRecipe,
  RecipeCandidate
} from "./extract-types";

type Json = unknown;
type JsonObject = Record<string, unknown>;

function isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function hasRecipeType(v: unknown): boolean {
  if (typeof v === "string") return v === "Recipe" || v.endsWith("/Recipe");
  if (Array.isArray(v)) return v.some(hasRecipeType);
  return false;
}

const JSON_LD_BLOCK_RE =
  /<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi;

const HTML_TAG_RE = /<[^>]*>/g;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function cleanText(s: string): string {
  return decodeEntities(s.replace(HTML_TAG_RE, " ")).replace(/\s+/g, " ").trim();
}

function toStringArray(v: unknown): string[] {
  if (v == null) return [];
  if (typeof v === "string") return [v];
  if (typeof v === "number") return [String(v)];
  if (Array.isArray(v)) return v.flatMap(toStringArray);
  return [];
}

function extractName(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") {
    const t = cleanText(v);
    return t || undefined;
  }
  if (Array.isArray(v)) {
    for (const item of v) {
      const name = extractName(item);
      if (name) return name;
    }
    return undefined;
  }
  if (isObject(v)) {
    if (typeof v.name === "string") {
      const t = cleanText(v.name);
      return t || undefined;
    }
  }
  return undefined;
}

function isAbsoluteHttpUrl(s: unknown): s is string {
  return typeof s === "string" && /^https?:\/\//i.test(s.trim());
}

function extractImages(v: unknown): string[] {
  if (v == null) return [];
  if (typeof v === "string") {
    const t = v.trim();
    return t ? [t] : [];
  }
  if (Array.isArray(v)) return v.flatMap(extractImages);
  if (isObject(v)) {
    if (typeof v.url === "string") {
      const t = v.url.trim();
      return t ? [t] : [];
    }
  }
  return [];
}

function coerceYield(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === "string") {
    const t = cleanText(v);
    return t || undefined;
  }
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) {
    const parts = v
      .map(coerceYield)
      .filter((x): x is string => typeof x === "string" && x.length > 0);
    // Prefer the most descriptive (longest) entry, fall back to first.
    if (parts.length === 0) return undefined;
    return parts.reduce((a, b) => (b.length > a.length ? b : a));
  }
  return undefined;
}

function coerceJoinedString(v: unknown): string | undefined {
  const arr = toStringArray(v).map(cleanText).filter(Boolean);
  if (arr.length === 0) return undefined;
  return arr.join(", ");
}

function extractIngredients(node: JsonObject): ImportedIngredient[] {
  const raw = node.recipeIngredient != null ? node.recipeIngredient : node.ingredients;
  return toStringArray(raw)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({ original: line }));
}

function stepTextFrom(v: unknown): string | undefined {
  if (typeof v === "string") {
    const t = cleanText(v);
    return t || undefined;
  }
  if (isObject(v)) {
    if (typeof v.text === "string") {
      const t = cleanText(v.text);
      return t || undefined;
    }
    if (typeof v.name === "string") {
      const t = cleanText(v.name);
      return t || undefined;
    }
  }
  return undefined;
}

function isHowToSection(v: unknown): boolean {
  if (!isObject(v)) return false;
  if (typeof v["@type"] === "string" && v["@type"].endsWith("HowToSection")) {
    return true;
  }
  // Heuristic: an object carrying itemListElement is section-like.
  return Array.isArray(v.itemListElement);
}

function sectionFromHowToSection(v: JsonObject): ImportedInstructionSection {
  const name = extractName(v.name);
  const elements = Array.isArray(v.itemListElement) ? v.itemListElement : [];
  const steps: string[] = [];
  for (const el of elements) {
    const text = stepTextFrom(el);
    if (text) steps.push(text);
  }
  return name ? { name, steps } : { steps };
}

function extractInstructionSections(v: unknown): ImportedInstructionSection[] {
  if (v == null) return [];

  // Plain string => one section, single step (kept whole).
  if (typeof v === "string") {
    const text = cleanText(v);
    return text ? [{ steps: [text] }] : [];
  }

  if (Array.isArray(v)) {
    // If any element is a HowToSection, treat the array as a list of sections.
    const hasSections = v.some(isHowToSection);
    if (hasSections) {
      const sections: ImportedInstructionSection[] = [];
      for (const el of v) {
        if (isHowToSection(el) && isObject(el)) {
          const section = sectionFromHowToSection(el);
          if (section.steps.length > 0 || section.name) sections.push(section);
        } else {
          // Loose step mixed in alongside sections => its own unnamed section.
          const text = stepTextFrom(el);
          if (text) sections.push({ steps: [text] });
        }
      }
      return sections;
    }

    // Otherwise: array of strings / HowToStep objects => one unnamed section.
    const steps: string[] = [];
    for (const el of v) {
      const text = stepTextFrom(el);
      if (text) steps.push(text);
    }
    return steps.length > 0 ? [{ steps }] : [];
  }

  if (isObject(v)) {
    if (isHowToSection(v)) {
      const section = sectionFromHowToSection(v);
      return section.steps.length > 0 || section.name ? [section] : [];
    }
    const text = stepTextFrom(v);
    return text ? [{ steps: [text] }] : [];
  }

  return [];
}

function extractCanonicalUrl(node: JsonObject, sourceUrl?: string): string | undefined {
  if (isAbsoluteHttpUrl(node["@id"])) return node["@id"].trim();
  if (isAbsoluteHttpUrl(node.url)) return node.url.trim();
  const fromUrlArray = toStringArray(node.url).find(isAbsoluteHttpUrl);
  if (fromUrlArray) return fromUrlArray.trim();
  if (isAbsoluteHttpUrl(sourceUrl)) return sourceUrl.trim();
  return sourceUrl;
}

function normalizeRecipe(node: JsonObject, sourceUrl?: string): ImportedRecipe {
  const recipe: ImportedRecipe = {
    ingredients: extractIngredients(node),
    instructionSections: extractInstructionSections(node.recipeInstructions),
    images: extractImages(node.image),
    parser: "json-ld"
  };

  const name = extractName(node.name);
  if (name) recipe.name = name;

  const y = coerceYield(node.recipeYield);
  if (y) recipe.yield = y;

  if (typeof node.prepTime === "string" && node.prepTime.trim()) {
    recipe.prepTime = node.prepTime.trim();
  }
  if (typeof node.cookTime === "string" && node.cookTime.trim()) {
    recipe.cookTime = node.cookTime.trim();
  }
  if (typeof node.totalTime === "string" && node.totalTime.trim()) {
    recipe.totalTime = node.totalTime.trim();
  }

  const author = extractName(node.author);
  if (author) recipe.author = author;

  const publisher = extractName(node.publisher);
  if (publisher) recipe.publisher = publisher;

  const canonical = extractCanonicalUrl(node, sourceUrl);
  if (canonical) recipe.canonicalUrl = canonical;

  const cuisine = coerceJoinedString(node.recipeCuisine);
  if (cuisine) recipe.cuisine = cuisine;

  const category = coerceJoinedString(node.recipeCategory);
  if (category) recipe.category = category;

  return recipe;
}

function collectRecipeNodes(value: Json, out: JsonObject[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectRecipeNodes(item, out);
    return;
  }
  if (!isObject(value)) return;

  if (hasRecipeType(value["@type"])) {
    out.push(value);
    // Do not descend into a recognized Recipe to avoid duplicate nested matches.
    return;
  }

  if (Array.isArray(value["@graph"])) {
    collectRecipeNodes(value["@graph"], out);
  }

  for (const key of Object.keys(value)) {
    if (key === "@graph") continue;
    collectRecipeNodes(value[key], out);
  }
}

function parseJsonLdRecipes(html: string, warnings: string[]): JsonObject[] {
  const nodes: JsonObject[] = [];
  JSON_LD_BLOCK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = JSON_LD_BLOCK_RE.exec(html)) !== null) {
    const raw = match[1];
    if (raw == null) continue;
    const text = raw.trim();
    if (!text) continue;
    let parsed: Json;
    try {
      parsed = JSON.parse(text);
    } catch {
      warnings.push("A JSON-LD block could not be parsed.");
      continue;
    }
    collectRecipeNodes(parsed, nodes);
  }
  return nodes;
}

// ponytail: flat-microdata only — does not handle nested itemscope or
// itemref. Covers the common single-recipe page emitted as plain microdata.
const ITEMTYPE_RECIPE_RE = /itemtype\s*=\s*["'][^"']*schema\.org\/Recipe[^"']*["']/i;

function microdataValues(html: string, prop: string): string[] {
  const re = new RegExp(
    `<([a-zA-Z0-9]+)\\b[^>]*itemprop\\s*=\\s*["'][^"']*\\b${prop}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1\\s*>`,
    "gi"
  );
  const values: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const body = m[2];
    if (body == null) continue;
    const text = cleanText(body);
    if (text) values.push(text);
  }
  return values;
}

function extractMicrodataRecipe(html: string, sourceUrl?: string): ImportedRecipe | undefined {
  if (!ITEMTYPE_RECIPE_RE.test(html)) return undefined;

  const ingredients = microdataValues(html, "recipeIngredient").map(
    (line) => ({ original: line }) satisfies ImportedIngredient
  );
  const steps = microdataValues(html, "recipeInstructions");
  const names = microdataValues(html, "name");

  if (ingredients.length === 0 && steps.length === 0) return undefined;

  const recipe: ImportedRecipe = {
    ingredients,
    instructionSections: steps.length > 0 ? [{ steps }] : [],
    images: [],
    parser: "microdata"
  };
  if (names[0]) recipe.name = names[0];
  if (isAbsoluteHttpUrl(sourceUrl)) recipe.canonicalUrl = sourceUrl;
  else if (sourceUrl) recipe.canonicalUrl = sourceUrl;
  return recipe;
}

function hasContent(r: ImportedRecipe): boolean {
  const stepCount = r.instructionSections.reduce((sum, s) => sum + s.steps.length, 0);
  return r.ingredients.length > 0 && stepCount > 0;
}

function isEmpty(r: ImportedRecipe): boolean {
  const stepCount = r.instructionSections.reduce((sum, s) => sum + s.steps.length, 0);
  return r.ingredients.length === 0 && stepCount === 0;
}

function toCandidate(r: ImportedRecipe): RecipeCandidate {
  const instructionCount = r.instructionSections.reduce((sum, s) => sum + s.steps.length, 0);
  const candidate: RecipeCandidate = {
    ingredientCount: r.ingredients.length,
    instructionCount
  };
  if (r.name) candidate.name = r.name;
  return candidate;
}

export function extractRecipe(html: string, sourceUrl?: string): ExtractResult {
  const warnings: string[] = [];

  if (typeof html !== "string" || html.length === 0) {
    return {
      ok: false,
      code: "NO_STRUCTURED_RECIPE",
      message: "No HTML provided to extract from.",
      warnings
    };
  }

  const nodes = parseJsonLdRecipes(html, warnings);
  let recipes = nodes.map((node) => normalizeRecipe(node, sourceUrl));

  if (recipes.length === 0) {
    const micro = extractMicrodataRecipe(html, sourceUrl);
    if (micro) recipes = [micro];
  }

  if (recipes.length === 0) {
    return {
      ok: false,
      code: "NO_STRUCTURED_RECIPE",
      message: "No Schema.org Recipe found in the page.",
      warnings
    };
  }

  if (recipes.length === 1) {
    return { ok: true, recipe: recipes[0]!, warnings };
  }

  // Multiple recipes: if exactly one has real content and the rest are empty,
  // pick the one with content. Otherwise hand back candidates — never merge.
  const withContent = recipes.filter(hasContent);
  const others = recipes.filter((r) => !hasContent(r));
  if (withContent.length === 1 && others.every(isEmpty)) {
    return { ok: true, recipe: withContent[0]!, warnings };
  }

  return {
    ok: true,
    candidates: recipes.map(toCandidate),
    recipes,
    warnings
  };
}
