import type { Recipe } from "../model/types";
import { effectiveTotalTime } from "./markdown";
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

  if (recipe.servings && recipe.servings > 0) {
    ordered.push(`servings: ${recipe.servings}`);
  }
  if (recipe.prepTime && recipe.prepTime > 0) {
    ordered.push(`prep_time: ${recipe.prepTime}`);
  }
  if (recipe.cookTime && recipe.cookTime > 0) {
    ordered.push(`cook_time: ${recipe.cookTime}`);
  }

  const total = effectiveTotalTime(recipe);
  if (total && total > 0) ordered.push(`total_time: ${total}`);

  const src = recipe.source;
  if (src) {
    if (isNonEmpty(src.name)) ordered.push(`source_name: ${yamlString(src.name)}`);
    if (isNonEmpty(src.url)) ordered.push(`source_url: ${yamlString(src.url)}`);
    if (isNonEmpty(src.author)) ordered.push(`source_author: ${yamlString(src.author)}`);
    if (isNonEmpty(src.book)) ordered.push(`source_book: ${yamlString(src.book)}`);
    if (isNonEmpty(src.page)) ordered.push(`source_page: ${yamlString(src.page)}`);
    if (isNonEmpty(src.adaptedFrom)) {
      ordered.push(`adapted_from: ${yamlString(src.adaptedFrom)}`);
    }
  }

  if (recipe.rating && recipe.rating >= 1 && recipe.rating <= 5) {
    ordered.push(`rating: ${recipe.rating}`);
  }
  if (isNonEmptyList(recipe.datesMade)) {
    ordered.push(...yamlList("date_made", recipe.datesMade));
  }

  ordered.push(`created: ${recipe.created}`);
  ordered.push(`updated: ${recipe.updated}`);

  return yamlBlock(ordered);
}
