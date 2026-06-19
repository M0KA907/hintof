import { recipeToNote } from "../../serialize";
import { renderMarkdown } from "./markdown";

export function mountPreview(el: HTMLElement): (text: string) => void {
  const note = document.createElement("div");
  note.className = "note-render";
  note.setAttribute("aria-label", "Rendered preview");
  el.append(note);

  return (text: string) => {
    note.replaceChildren(renderMarkdown(text));
  };
}

export function previewText(recipe: Parameters<typeof recipeToNote>[0]): string {
  if (!recipe.title.trim()) return "Enter a title to preview your note.";
  return recipeToNote(recipe);
}
