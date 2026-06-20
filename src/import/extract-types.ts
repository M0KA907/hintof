export interface ImportedInstructionSection {
  name?: string;
  steps: string[];
}

export interface ImportedIngredient {
  original: string; // preserved verbatim
}

export interface ImportedRecipe {
  name?: string;
  ingredients: ImportedIngredient[];
  instructionSections: ImportedInstructionSection[];
  yield?: string;
  prepTime?: string; // raw ISO-8601 duration e.g. "PT20M"
  cookTime?: string;
  totalTime?: string;
  author?: string;
  publisher?: string;
  canonicalUrl?: string;
  images: string[];
  cuisine?: string;
  category?: string;
  parser: "json-ld" | "microdata";
}

export interface RecipeCandidate {
  name?: string;
  ingredientCount: number;
  instructionCount: number;
}

export type ExtractResult =
  | { ok: true; recipe: ImportedRecipe; warnings: string[] }
  | {
      ok: true;
      candidates: RecipeCandidate[];
      recipes: ImportedRecipe[];
      warnings: string[];
    }
  | {
      ok: false;
      code: "NO_STRUCTURED_RECIPE" | "PARSE_ERROR";
      message: string;
      warnings: string[];
    };
