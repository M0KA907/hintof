export type SchemaVersion = 1;

export type Rational = { n: number; d: number };

export type Quantity =
  | { kind: "single"; value: Rational }
  | { kind: "range"; min: Rational; max: Rational };

export interface NoteOptions {
  wikiLinks: { ingredients: boolean; cuisine: boolean };
  callouts: boolean;
  fractionStyle: "unicode" | "ascii";
}

export interface Ingredient {
  qty?: Quantity;
  unit?: string;
  item: string;
  note?: string;
}

export interface IngredientGroup {
  name?: string;
  ingredients: Ingredient[];
}

export interface StepSection {
  name?: string;
  steps: string[];
}

export interface Substitution {
  from: string;
  to: string;
  note?: string;
}

export interface Source {
  name?: string;
  url?: string;
  author?: string;
  book?: string;
  page?: string;
  adaptedFrom?: string;
}

export interface Recipe {
  id: string;
  schemaVersion: SchemaVersion;
  title: string;
  description?: string;
  aliases?: string[];
  tags?: string[];
  cuisine?: string;
  course?: string;
  diet?: string[];
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  totalTime?: number;
  totalTimeManual?: boolean;
  image?: string;
  ingredientGroups: IngredientGroup[];
  stepSections: StepSection[];
  notes?: string;
  substitutions?: Substitution[];
  storage?: string;
  equipment?: string[];
  source?: Source;
  rating?: number;
  datesMade?: string[];
  created: string;
  updated: string;
  options: NoteOptions;
}

export const DEFAULT_NOTE_OPTIONS: NoteOptions = {
  wikiLinks: { ingredients: false, cuisine: false },
  callouts: false,
  fractionStyle: "unicode"
};

export function emptyRecipe(overrides: Partial<Recipe> = {}): Recipe {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: crypto.randomUUID(),
    schemaVersion: 1,
    title: "",
    ingredientGroups: [{ ingredients: [{ item: "" }] }],
    stepSections: [{ steps: [""] }],
    created: today,
    updated: today,
    options: { ...DEFAULT_NOTE_OPTIONS },
    ...overrides
  };
}
