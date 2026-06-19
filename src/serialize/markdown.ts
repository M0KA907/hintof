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

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (!rem) return hrs === 1 ? "1 hr" : `${hrs} hr`;
  return `${hrs === 1 ? "1 hr" : `${hrs} hr`} ${rem} min`;
}

function hasMeta(recipe: Recipe): boolean {
  return Boolean(
    recipe.servings || recipe.prepTime || recipe.cookTime || effectiveTotalTime(recipe)
  );
}

export function effectiveTotalTime(recipe: Recipe): number | undefined {
  if (recipe.totalTimeManual && recipe.totalTime) return recipe.totalTime;
  if (recipe.prepTime && recipe.cookTime) return recipe.prepTime + recipe.cookTime;
  return recipe.totalTime;
}

function renderMetaLine(recipe: Recipe): string {
  const parts: string[] = [];
  if (recipe.servings) parts.push(`**Servings:** ${recipe.servings}`);
  if (recipe.prepTime) parts.push(`**Prep:** ${formatMinutes(recipe.prepTime)}`);
  if (recipe.cookTime) parts.push(`**Cook:** ${formatMinutes(recipe.cookTime)}`);
  const total = effectiveTotalTime(recipe);
  if (total) parts.push(`**Total:** ${formatMinutes(total)}`);
  return parts.join(" · ");
}

function wrapWiki(text: string, enabled: boolean): string {
  return enabled ? `[[${text}]]` : text;
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
  if (note) line += ` — ${note}`;
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
    if (named && groupName) lines.push(`### ${groupName}`);

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
      lines.push(`### ${sectionName}`);
      n = 0;
    }

    for (const step of section.steps) {
      const text = step.trim();
      if (!text) continue;
      hasSteps = true;
      n += 1;
      lines.push(`${n}. ${text}`);
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
    return [`> [!${callout}] ${heading}`, `> ${text.replace(/\n/g, "\n> ")}`];
  }
  return [`## ${heading}`, text];
}

function renderSubstitutions(subs: Substitution[]): string[] {
  const lines = subs
    .map((s) => {
      const from = s.from.trim();
      const to = s.to.trim();
      if (!from || !to) return null;
      let line = `${from} → ${to}`;
      const note = s.note?.trim();
      if (note) line += ` — ${note}`;
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
    .map((i) => `- ${i}`);
  if (!lines.length) return [];
  return ["## Equipment", ...lines];
}

export function renderSource(source: Source): string | null {
  const parts: string[] = [];
  const name = source.name?.trim();
  const url = source.url?.trim();

  if (name && url) parts.push(`[${name}](${url})`);
  else if (name) parts.push(name);
  else if (url) parts.push(url);

  const author = source.author?.trim();
  const book = source.book?.trim();
  const page = source.page?.trim();
  const adapted = source.adaptedFrom?.trim();

  const detail: string[] = [];
  if (author) detail.push(author);
  if (book) detail.push(`*${book}*`);
  if (page) detail.push(`p. ${page}`);

  if (detail.length) {
    const sep = parts.length ? " — " : "";
    parts.push(`${sep}${detail.join(", ")}`);
  }

  if (adapted) {
    const prefix = parts.length ? " (adapted: " : "(adapted: ";
    parts.push(`${prefix}${adapted})`);
  }

  const line = parts.join("").trim();
  return line || null;
}

export function renderMarkdownBody(recipe: Recipe): string {
  const lines: string[] = [`# ${recipe.title.trim() || "Untitled"}`];

  const desc = recipe.description?.trim();
  if (desc) {
    lines.push("");
    lines.push(desc);
  }

  if (hasMeta(recipe)) {
    lines.push("");
    lines.push(renderMetaLine(recipe));
  }

  const image = recipe.image?.trim();
  if (image) {
    lines.push("");
    lines.push(`![[${image}]]`);
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
