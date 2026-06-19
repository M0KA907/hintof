const UNIT_MAP: Record<string, string> = {
  teaspoon: "tsp",
  teaspoons: "tsp",
  tsp: "tsp",
  "tsp.": "tsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tbsp: "tbsp",
  "tbsp.": "tbsp",
  tbs: "tbsp",
  cup: "cup",
  cups: "cups",
  ounce: "oz",
  ounces: "oz",
  oz: "oz",
  "oz.": "oz",
  pound: "lb",
  pounds: "lb",
  lb: "lb",
  "lb.": "lb",
  lbs: "lb",
  gram: "g",
  grams: "g",
  g: "g",
  kilogram: "kg",
  kilograms: "kg",
  kg: "kg",
  milliliter: "ml",
  milliliters: "ml",
  ml: "ml",
  liter: "l",
  liters: "l",
  l: "l",
  clove: "clove",
  cloves: "cloves",
  pinch: "pinch",
  can: "can",
  cans: "cans",
  package: "package",
  packages: "packages",
  pkg: "package"
};

export function normalizeUnit(unit: string | undefined): string | undefined {
  if (!unit) return undefined;
  const trimmed = unit.trim();
  if (!trimmed) return undefined;
  const key = trimmed.toLowerCase();
  return UNIT_MAP[key] ?? trimmed;
}
