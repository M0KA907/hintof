import { normalizeSearchText } from "./normalize.ts";

export interface SearchMatch<T> {
  item: T;
  score: number;
}

// ponytail: edit-distance thresholds are intentionally strict (no fuzz below
// length 4, distance 1 up to length 6, distance 2 only at length 7+). Short
// queries fall through to exact/prefix only, so "ramen" never collapses into
// "ravioli". Loosening these reintroduces noisy short-query matches.

// Tier scores: higher is better. Exact substring beats everything, then prefix,
// then whole-token equality, then conservative fuzzy.
const SCORE_EXACT_SUBSTRING = 100;
const SCORE_PREFIX = 70;
const SCORE_TOKEN = 50;
const SCORE_FUZZY = 30;

function damerauLevenshtein(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  const d: number[][] = [];
  for (let i = 0; i <= aLen; i += 1) {
    d[i] = [];
    d[i][0] = i;
  }
  for (let j = 0; j <= bLen; j += 1) {
    d[0][j] = j;
  }

  for (let i = 1; i <= aLen; i += 1) {
    for (let j = 1; j <= bLen; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost); // transposition
      }
    }
  }

  return d[aLen][bLen];
}

function fuzzyThreshold(queryTokenLength: number): number {
  if (queryTokenLength <= 3) return 0;
  if (queryTokenLength <= 6) return 1;
  return 2;
}

function tokenize(text: string): string[] {
  return text.length === 0 ? [] : text.split(" ");
}

function scoreOne(normalizedQuery: string, queryTokens: string[], text: string): number | null {
  const normalizedText = normalizeSearchText(text);

  // Tier 1: exact substring of the whole normalized query.
  if (normalizedText.includes(normalizedQuery)) {
    return SCORE_EXACT_SUBSTRING;
  }

  const textTokens = tokenize(normalizedText);
  const textTokenSet = new Set(textTokens);

  let best: number | null = null;

  for (const qToken of queryTokens) {
    // Tier 2: prefix match on any whitespace token.
    if (textTokens.some((t) => t.startsWith(qToken))) {
      best = Math.max(best ?? 0, SCORE_PREFIX);
      continue;
    }

    // Tier 3: token equality (covered by prefix already, but explicit/stable).
    if (textTokenSet.has(qToken)) {
      best = Math.max(best ?? 0, SCORE_TOKEN);
      continue;
    }

    // Tier 4: conservative fuzzy via Damerau-Levenshtein per token.
    const threshold = fuzzyThreshold(qToken.length);
    if (threshold > 0) {
      for (const tToken of textTokens) {
        if (damerauLevenshtein(qToken, tToken) <= threshold) {
          best = Math.max(best ?? 0, SCORE_FUZZY);
          break;
        }
      }
    }
  }

  return best;
}

export function searchItems<T>(
  query: string,
  items: T[],
  getText: (item: T) => string
): SearchMatch<T>[] {
  const normalizedQuery = normalizeSearchText(query);

  if (normalizedQuery.length === 0) {
    return items.map((item) => ({ item, score: 0 }));
  }

  const queryTokens = tokenize(normalizedQuery);

  const matches: Array<SearchMatch<T> & { order: number }> = [];
  items.forEach((item, order) => {
    const score = scoreOne(normalizedQuery, queryTokens, getText(item));
    if (score !== null) {
      matches.push({ item, score, order });
    }
  });

  // Higher score first; stable within a tier by original order.
  matches.sort((a, b) => b.score - a.score || a.order - b.order);

  return matches.map(({ item, score }) => ({ item, score }));
}
