import { recipeToNote } from "../../serialize";
import { renderMarkdown } from "./markdown";

const PREVIEW_FRONTMATTER_KEYS = new Set(["created", "updated"]);

function previewNoteText(note: string): string {
  const lines = note.split("\n");
  if (lines[0] !== "---") return note;

  const end = lines.indexOf("---", 1);
  if (end < 0) return note;

  const visibleProps = lines.slice(1, end).filter((line) => {
    const key = line.match(/^([A-Za-z0-9_]+):/)?.[1];
    return Boolean(key && PREVIEW_FRONTMATTER_KEYS.has(key));
  });

  return ["---", ...visibleProps, ...lines.slice(end)].join("\n");
}

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
  return previewNoteText(recipeToNote(recipe));
}
