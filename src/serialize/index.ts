import type { Recipe } from "../model/types";
import { effectiveTotalTime, safeHttpUrl } from "./markdown";
import { renderMarkdownBody } from "./markdown";
import { isNonEmpty, isNonEmptyList, normalizeTag, yamlBlock, yamlList, yamlString } from "./yaml";

export { recipeFilename, sanitizeTitle, nextCollisionIndex } from "./filename";
export { renderMarkdownBody, formatMinutes, effectiveTotalTime } from "./markdown";

export function recipeToNote(recipe: Recipe): string {
  const fm = renderFrontmatter(recipe);
  const body = renderMarkdownBody(recipe);
  return `---\n${fm}\n---\n\n${body}\n`;
}

function renderFrontmatter(recipe: Recipe): string {
  const ordered: string[] = [`schema_version: ${recipe.schemaVersion}`];
  ordered.push(`title: ${yamlString(recipe.title.trim() || "Untitled")}`);

  if (isNonEmptyList(recipe.aliases)) {
    ordered.push(...yamlList("aliases", recipe.aliases));
  }

  const tags = recipe.tags?.map(normalizeTag).filter(Boolean);
  if (tags?.length) ordered.push(...yamlList("tags", tags));

  if (isNonEmpty(recipe.cuisine)) {
    ordered.push(`cuisine: ${yamlString(recipe.cuisine)}`);
  }

  if (isNonEmpty(recipe.course)) ordered.push(`course: ${yamlString(recipe.course)}`);
  if (isNonEmptyList(recipe.diet)) ordered.push(...yamlList("diet", recipe.diet));

  const servings = positiveInt(recipe.servings);
  const prep = positiveInt(recipe.prepTime);
  const cook = positiveInt(recipe.cookTime);

  if (servings) {
    ordered.push(`servings: ${servings}`);
  }
  if (prep) {
    ordered.push(`prep_time: ${prep}`);
  }
  if (cook) {
    ordered.push(`cook_time: ${cook}`);
  }

  const total = effectiveTotalTime(recipe);
  if (total && total > 0) ordered.push(`total_time: ${total}`);

  const src = recipe.source;
  if (src) {
    if (isNonEmpty(src.name)) ordered.push(`source_name: ${yamlString(src.name)}`);
    const sourceUrl = safeHttpUrl(src.url);
    if (sourceUrl) ordered.push(`source_url: ${yamlString(sourceUrl)}`);
    const canonicalUrl = safeHttpUrl(src.canonicalUrl);
    if (canonicalUrl) ordered.push(`source_canonical_url: ${yamlString(canonicalUrl)}`);
    if (isNonEmpty(src.publisher)) ordered.push(`source_publisher: ${yamlString(src.publisher)}`);
    if (isNonEmpty(src.importedAt))
      ordered.push(`source_imported_at: ${yamlString(src.importedAt)}`);
    if (isNonEmpty(src.parser)) ordered.push(`source_parser: ${yamlString(src.parser)}`);
    if (isNonEmpty(src.author)) ordered.push(`source_author: ${yamlString(src.author)}`);
    if (isNonEmpty(src.book)) ordered.push(`source_book: ${yamlString(src.book)}`);
    if (isNonEmpty(src.page)) ordered.push(`source_page: ${yamlString(src.page)}`);
    if (isNonEmpty(src.adaptedFrom)) {
      ordered.push(`adapted_from: ${yamlString(src.adaptedFrom)}`);
    }
  }

  ordered.push(`created: ${recipe.created}`);
  ordered.push(`updated: ${recipe.updated}`);

  return yamlBlock(ordered);
}

function positiveInt(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : undefined;
}
