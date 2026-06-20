export interface UnitSuggestion {
  from: string;
  to: string;
}

// Explicit, conservative alias table. Suggestion-only: never used to silently
// rewrite ingredient text. Keys must be lowercase, trimmed.
export const UNIT_ALIASES: Record<string, string> = {
  tbsb: "tbsp",
  tblsp: "tbsp",
  teaspon: "teaspoon",
  tspn: "tsp",
  mililiter: "milliliter",
  gramme: "gram",
  ltr: "liter"
};

export function suggestUnitCorrection(token: string): UnitSuggestion | null {
  const from = token.toLowerCase().trim();
  const to = UNIT_ALIASES[from];
  if (to === undefined) return null;
  return { from, to };
}
