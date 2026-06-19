import type {
  Ingredient,
  IngredientGroup,
  NoteOptions,
  Quantity,
  Rational,
  Recipe,
  Source,
  StepSection,
  Substitution
} from "../model/types";
import { DEFAULT_NOTE_OPTIONS, emptyRecipe } from "../model/types";

type Recordish = Record<string, unknown>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Recordish {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function strList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = value.filter((v): v is string => typeof v === "string");
  return list.length ? list : undefined;
}

export function positiveInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.trunc(value);
}

function date(value: unknown, fallback: string): string {
  return typeof value === "string" && DATE_RE.test(value) ? value : fallback;
}

function rational(value: unknown): Rational | undefined {
  if (!isRecord(value)) return undefined;
  const n = value.n;
  const d = value.d;
  if (
    typeof n !== "number" ||
    typeof d !== "number" ||
    !Number.isFinite(n) ||
    !Number.isFinite(d) ||
    d === 0
  ) {
    return undefined;
  }
  return { n: Math.trunc(n), d: Math.trunc(d) };
}

function quantity(value: unknown): Quantity | undefined {
  if (!isRecord(value)) return undefined;
  if (value.kind === "single") {
    const r = rational(value.value);
    return r ? { kind: "single", value: r } : undefined;
  }
  if (value.kind === "range") {
    const min = rational(value.min);
    const max = rational(value.max);
    return min && max ? { kind: "range", min, max } : undefined;
  }
  return undefined;
}

function ingredient(value: unknown): Ingredient | undefined {
  if (!isRecord(value) || typeof value.item !== "string") return undefined;
  const ing: Ingredient = { item: value.item };
  const qty = quantity(value.qty);
  if (qty) ing.qty = qty;
  if (typeof value.unit === "string" && value.unit.trim()) ing.unit = value.unit;
  if (typeof value.note === "string" && value.note.trim()) ing.note = value.note;
  return ing;
}

function ingredientGroups(value: unknown): IngredientGroup[] {
  if (!Array.isArray(value)) return [{ ingredients: [{ item: "" }] }];
  const groups = value.filter(isRecord).map((group) => {
    const ingredients = Array.isArray(group.ingredients)
      ? group.ingredients.map(ingredient).filter((ing): ing is Ingredient => Boolean(ing))
      : [];
    const next: IngredientGroup = {
      ingredients: ingredients.length ? ingredients : [{ item: "" }]
    };
    if (typeof group.name === "string" && group.name.trim()) next.name = group.name;
    return next;
  });
  return groups.length ? groups : [{ ingredients: [{ item: "" }] }];
}

function stepSections(value: unknown): StepSection[] {
  if (!Array.isArray(value)) return [{ steps: [""] }];
  const sections = value.filter(isRecord).map((section) => {
    const steps = Array.isArray(section.steps)
      ? section.steps.filter((step): step is string => typeof step === "string")
      : [];
    const next: StepSection = { steps: steps.length ? steps : [""] };
    if (typeof section.name === "string" && section.name.trim()) next.name = section.name;
    return next;
  });
  return sections.length ? sections : [{ steps: [""] }];
}

function substitutions(value: unknown): Substitution[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const subs = value
    .filter(isRecord)
    .map((sub) => {
      const from = str(sub.from);
      const to = str(sub.to);
      if (!from || !to) return null;
      const next: Substitution = { from, to };
      if (typeof sub.note === "string" && sub.note.trim()) next.note = sub.note;
      return next;
    })
    .filter((sub): sub is Substitution => Boolean(sub));
  return subs.length ? subs : undefined;
}

function source(value: unknown): Source | undefined {
  if (!isRecord(value)) return undefined;
  const next: Source = {};
  for (const key of ["name", "url", "author", "book", "page", "adaptedFrom"] as const) {
    const raw = value[key];
    if (typeof raw === "string" && raw.trim()) next[key] = raw;
  }
  return Object.keys(next).length ? next : undefined;
}

function noteOptions(value: unknown): NoteOptions {
  if (!isRecord(value))
    return { ...DEFAULT_NOTE_OPTIONS, wikiLinks: { ...DEFAULT_NOTE_OPTIONS.wikiLinks } };
  const wikiLinks = isRecord(value.wikiLinks) ? value.wikiLinks : {};
  return {
    wikiLinks: {
      ingredients:
        typeof wikiLinks.ingredients === "boolean"
          ? wikiLinks.ingredients
          : DEFAULT_NOTE_OPTIONS.wikiLinks.ingredients,
      cuisine:
        typeof wikiLinks.cuisine === "boolean"
          ? wikiLinks.cuisine
          : DEFAULT_NOTE_OPTIONS.wikiLinks.cuisine
    },
    callouts: typeof value.callouts === "boolean" ? value.callouts : DEFAULT_NOTE_OPTIONS.callouts,
    fractionStyle: value.fractionStyle === "ascii" ? "ascii" : DEFAULT_NOTE_OPTIONS.fractionStyle
  };
}

export function normalizeRecipe(value: unknown): Recipe | null {
  if (!isRecord(value)) return null;
  if (value.schemaVersion !== 1) return null;
  if (typeof value.id !== "string" || !value.id.trim()) return null;
  if (typeof value.title !== "string") return null;

  const fallback = emptyRecipe({ id: value.id, title: value.title });
  const recipe: Recipe = {
    ...fallback,
    schemaVersion: 1,
    title: value.title,
    description: str(value.description),
    aliases: strList(value.aliases),
    tags: strList(value.tags),
    cuisine: str(value.cuisine),
    course: str(value.course),
    diet: strList(value.diet),
    servings: positiveInteger(value.servings),
    prepTime: positiveInteger(value.prepTime),
    cookTime: positiveInteger(value.cookTime),
    totalTime: positiveInteger(value.totalTime),
    totalTimeManual: typeof value.totalTimeManual === "boolean" ? value.totalTimeManual : undefined,
    image: str(value.image),
    ingredientGroups: ingredientGroups(value.ingredientGroups),
    stepSections: stepSections(value.stepSections),
    notes: str(value.notes),
    substitutions: substitutions(value.substitutions),
    storage: str(value.storage),
    equipment: strList(value.equipment),
    source: source(value.source),
    rating: positiveInteger(value.rating),
    datesMade: strList(value.datesMade)?.filter((d) => DATE_RE.test(d)),
    created: date(value.created, fallback.created),
    updated: date(value.updated, fallback.updated),
    options: noteOptions(value.options)
  };

  if (recipe.rating && (recipe.rating < 1 || recipe.rating > 5)) delete recipe.rating;
  if (!recipe.datesMade?.length) delete recipe.datesMade;
  if (!recipe.totalTimeManual) delete recipe.totalTimeManual;

  return recipe;
}
