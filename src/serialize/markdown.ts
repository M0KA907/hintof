import { renderQuantity } from "../model/quantity";
import { normalizeUnit } from "../model/units";
import type {
  Ingredient,
  IngredientGroup,
  NoteOptions,
  Recipe,
  Source,
  StepSection,
  Substitution
} from "../model/types";

function positiveInt(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : undefined;
}

export function formatMinutes(minutes: number): string {
  minutes = Math.trunc(minutes);
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (!rem) return hrs === 1 ? "1 hr" : `${hrs} hr`;
  return `${hrs === 1 ? "1 hr" : `${hrs} hr`} ${rem} min`;
}

function hasMeta(recipe: Recipe): boolean {
  return Boolean(
    positiveInt(recipe.servings) ||
    positiveInt(recipe.prepTime) ||
    positiveInt(recipe.cookTime) ||
    effectiveTotalTime(recipe)
  );
}

export function effectiveTotalTime(recipe: Recipe): number | undefined {
  const prep = positiveInt(recipe.prepTime);
  const cook = positiveInt(recipe.cookTime);
  const total = positiveInt(recipe.totalTime);
  if (recipe.totalTimeManual && total) return total;
  if (prep && cook) return prep + cook;
  return total;
}

function renderMetaLine(recipe: Recipe): string {
  const parts: string[] = [];
  const servings = positiveInt(recipe.servings);
  const prep = positiveInt(recipe.prepTime);
  const cook = positiveInt(recipe.cookTime);
  if (servings) parts.push(`**Servings:** ${servings}`);
  if (prep) parts.push(`**Prep:** ${formatMinutes(prep)}`);
  if (cook) parts.push(`**Cook:** ${formatMinutes(cook)}`);
  const total = effectiveTotalTime(recipe);
  if (total) parts.push(`**Total:** ${formatMinutes(total)}`);
  return parts.join(" · ");
}

export function escapeMarkdownText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/([`*_[\]()<>])/g, "\\$1")
    .replace(/^(\s*)(#{1,6}\s|>\s?|-{3,}\s*$|\*{3,}\s*$|[-+]\s|\d+\.\s)/gm, "$1\\$2");
}

export function safeHttpUrl(url: string | undefined): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return raw.replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/\s/g, "%20");
  } catch {
    return null;
  }
}

export function sanitizeObsidianTarget(target: string | undefined): string | null {
  const clean = target
    // eslint-disable-next-line no-control-regex -- strip control chars from link targets
    ?.replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\]\]/g, "")
    .replace(/\]\(/g, "")
    .replace(/\[\[/g, "")
    .trim();
  if (!clean || /^javascript:/i.test(clean)) return null;
  return clean;
}

function wrapWiki(text: string, enabled: boolean): string {
  if (!enabled) return escapeMarkdownText(text);
  const target = sanitizeObsidianTarget(text);
  return target ? `[[${target}]]` : escapeMarkdownText(text);
}

function renderIngredient(ing: Ingredient, options: NoteOptions): string | null {
  const item = ing.item.trim();
  if (!item) return null;

  const parts: string[] = [];
  if (ing.qty) parts.push(renderQuantity(ing.qty, options.fractionStyle));
  const unit = normalizeUnit(ing.unit);
  if (unit) parts.push(unit);
  parts.push(wrapWiki(item, options.wikiLinks.ingredients));

  let line = parts.join(" ");
  const note = ing.note?.trim();
  if (note) line += ` — ${escapeMarkdownText(note)}`;
  return line;
}

function hasNamedGroups(groups: IngredientGroup[]): boolean {
  return groups.some((g) => g.name?.trim());
}

function renderIngredients(recipe: Recipe): string[] {
  const lines: string[] = ["## Ingredients"];
  const named = hasNamedGroups(recipe.ingredientGroups);

  for (const group of recipe.ingredientGroups) {
    const groupName = group.name?.trim();
    if (named && groupName) lines.push(`### ${escapeMarkdownText(groupName)}`);

    for (const ing of group.ingredients) {
      const row = renderIngredient(ing, recipe.options);
      if (row) lines.push(`- ${row}`);
    }
  }

  const hasRows = lines.length > 1;
  return hasRows ? lines : [];
}

function hasNamedSections(sections: StepSection[]): boolean {
  return sections.some((s) => s.name?.trim());
}

function renderInstructions(recipe: Recipe): string[] {
  const lines: string[] = ["## Instructions"];
  const named = hasNamedSections(recipe.stepSections);
  let n = 0;
  let hasSteps = false;

  for (const section of recipe.stepSections) {
    const sectionName = section.name?.trim();
    if (named && sectionName) {
      lines.push(`### ${escapeMarkdownText(sectionName)}`);
      n = 0;
    }

    for (const step of section.steps) {
      const text = step.trim();
      if (!text) continue;
      hasSteps = true;
      n += 1;
      lines.push(`${n}. ${escapeMarkdownText(text)}`);
    }
  }

  return hasSteps ? lines : [];
}

function renderSection(
  heading: string,
  body: string,
  callout: string,
  options: NoteOptions
): string[] {
  const text = body.trim();
  if (!text) return [];

  if (options.callouts) {
    return [`> [!${callout}] ${heading}`, `> ${escapeMarkdownText(text).replace(/\n/g, "\n> ")}`];
  }
  return [`## ${heading}`, escapeMarkdownText(text)];
}

function renderSubstitutions(subs: Substitution[]): string[] {
  const lines = subs
    .map((s) => {
      const from = s.from.trim();
      const to = s.to.trim();
      if (!from || !to) return null;
      let line = `${escapeMarkdownText(from)} → ${escapeMarkdownText(to)}`;
      const note = s.note?.trim();
      if (note) line += ` — ${escapeMarkdownText(note)}`;
      return `- ${line}`;
    })
    .filter((l): l is string => Boolean(l));

  if (!lines.length) return [];
  return ["## Substitutions", ...lines];
}

function renderEquipment(items: string[]): string[] {
  const lines = items
    .map((i) => i.trim())
    .filter(Boolean)
    .map((i) => `- ${escapeMarkdownText(i)}`);
  if (!lines.length) return [];
  return ["## Equipment", ...lines];
}

export function renderSource(source: Source): string | null {
  const parts: string[] = [];
  const name = source.name?.trim();
  const url = source.url?.trim();
  const safeUrl = safeHttpUrl(url);
  const canonical = source.canonicalUrl?.trim();
  const safeCanonical = safeHttpUrl(canonical);

  if (name && safeUrl) parts.push(`[${escapeMarkdownText(name)}](${safeUrl})`);
  else if (name && safeCanonical) parts.push(`[${escapeMarkdownText(name)}](${safeCanonical})`);
  else if (name) parts.push(escapeMarkdownText(name));
  else if (url) parts.push(safeUrl ?? escapeMarkdownText(url));
  else if (canonical) parts.push(safeCanonical ?? escapeMarkdownText(canonical));

  const author = source.author?.trim();
  const publisher = source.publisher?.trim();
  const book = source.book?.trim();
  const page = source.page?.trim();
  const adapted = source.adaptedFrom?.trim();
  const importedAt = source.importedAt?.trim();
  const parser = source.parser?.trim();

  const detail: string[] = [];
  if (author) detail.push(escapeMarkdownText(author));
  if (publisher) detail.push(escapeMarkdownText(publisher));
  if (book) detail.push(`*${escapeMarkdownText(book)}*`);
  if (page) detail.push(`p. ${escapeMarkdownText(page)}`);

  if (detail.length) {
    const sep = parts.length ? " — " : "";
    parts.push(`${sep}${detail.join(", ")}`);
  }

  if (adapted) {
    const prefix = parts.length ? " (adapted: " : "(adapted: ";
    parts.push(`${prefix}${escapeMarkdownText(adapted)})`);
  }

  const provenance: string[] = [];
  if (safeCanonical && safeCanonical !== safeUrl) {
    provenance.push(`[canonical](${safeCanonical})`);
  } else if (canonical && !safeCanonical) {
    provenance.push(`canonical: ${escapeMarkdownText(canonical)}`);
  }
  if (importedAt) provenance.push(`imported ${escapeMarkdownText(importedAt)}`);
  if (parser) provenance.push(`parser: ${escapeMarkdownText(parser)}`);
  if (provenance.length) {
    const prefix = parts.length ? " (" : "(";
    parts.push(`${prefix}${provenance.join("; ")})`);
  }

  const line = parts.join("").trim();
  return line || null;
}

export function renderMarkdownBody(recipe: Recipe): string {
  const lines: string[] = [`# ${escapeMarkdownText(recipe.title.trim() || "Untitled")}`];

  const desc = recipe.description?.trim();
  if (desc) {
    lines.push("");
    lines.push(escapeMarkdownText(desc));
  }

  if (hasMeta(recipe)) {
    lines.push("");
    lines.push(renderMetaLine(recipe));
  }

  const image = recipe.image?.trim();
  if (image) {
    lines.push("");
    const target = sanitizeObsidianTarget(image);
    lines.push(target ? `![[${target}]]` : escapeMarkdownText(image));
  }

  const ingredients = renderIngredients(recipe);
  if (ingredients.length) {
    lines.push("");
    lines.push(...ingredients);
  }

  const instructions = renderInstructions(recipe);
  if (instructions.length) {
    lines.push("");
    lines.push(...instructions);
  }

  const notes = recipe.notes?.trim();
  if (notes) {
    lines.push("");
    lines.push(...renderSection("Notes", notes, "note", recipe.options));
  }

  const subs = recipe.substitutions ?? [];
  const subLines = renderSubstitutions(subs);
  if (subLines.length) {
    lines.push("");
    lines.push(...subLines);
  }

  const storage = recipe.storage?.trim();
  if (storage) {
    lines.push("");
    lines.push(...renderSection("Storage", storage, "tip", recipe.options));
  }

  const equip = renderEquipment(recipe.equipment ?? []);
  if (equip.length) {
    lines.push("");
    lines.push(...equip);
  }

  const sourceLine = recipe.source ? renderSource(recipe.source) : null;
  if (sourceLine) {
    lines.push("");
    lines.push("## Source");
    lines.push(sourceLine);
  }

  return lines.join("\n");
}
