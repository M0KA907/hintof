import { recipeToNote } from "../../serialize";

export function mountPreview(el: HTMLElement): (text: string) => void {
  const pre = document.createElement("pre");
  pre.className = "preview-note";
  pre.setAttribute("aria-label", "Live Markdown preview");
  el.append(pre);

  return (text: string) => {
    pre.textContent = text;
  };
}

export function previewText(recipe: Parameters<typeof recipeToNote>[0]): string {
  if (!recipe.title.trim()) return "Enter a title to preview your note.";
  return recipeToNote(recipe);
}
