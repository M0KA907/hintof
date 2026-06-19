import { parseQuantity } from "../model/quantity";
import { normalizeUnit } from "../model/units";
import type { Ingredient } from "../model/types";

export type ParseResult = { ok: true; ingredient: Ingredient } | { ok: false; item: string };

// ponytail: regex split, not NLP; upgrade if paste-parse misses common cases
const QTY =
  /^((?:\d+\s+\d+\/\d+|\d+\/\d+|\d*[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]|\d*\.?\d+)(?:\s*[-–]\s*(?:\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+))?)\s+/;

export function parseIngredientLine(line: string): ParseResult {
  const raw = line.trim();
  if (!raw) return { ok: false, item: "" };

  const m = raw.match(QTY);
  if (!m) return { ok: false, item: raw };

  const qty = parseQuantity(m[1]!);
  if (!qty) return { ok: false, item: raw };

  const rest = raw.slice(m[0].length).trim();
  if (!rest) return { ok: false, item: raw };

  const noteSplit = rest.match(/^(.+?)\s*[,—–-]\s*(.+)$/);
  let item = rest;
  let note: string | undefined;
  if (noteSplit && noteSplit[2]!.length < 80) {
    item = noteSplit[1]!.trim();
    note = noteSplit[2]!.trim();
  }

  const words = item.split(/\s+/);
  const unitCandidates = [
    "cups",
    "cup",
    "tbsp",
    "tsp",
    "oz",
    "lb",
    "g",
    "kg",
    "ml",
    "l",
    "cloves",
    "clove"
  ];
  let unit: string | undefined;
  if (words.length > 1 && unitCandidates.includes(words[0]!.toLowerCase())) {
    unit = normalizeUnit(words.shift()!);
    item = words.join(" ");
  }

  if (!item) return { ok: false, item: raw };

  return {
    ok: true,
    ingredient: { qty, unit, item, note }
  };
}

export function parseIngredientPaste(text: string): Ingredient[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const r = parseIngredientLine(line);
      return r.ok ? r.ingredient : { item: r.item };
    });
}
