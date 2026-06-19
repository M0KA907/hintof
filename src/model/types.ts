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

// ponytail: randomUUID is secure-context only (HTTPS/localhost); fallback keeps
// plain-http LAN dev working. getRandomValues is available everywhere.
function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function emptyRecipe(overrides: Partial<Recipe> = {}): Recipe {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: uuid(),
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
