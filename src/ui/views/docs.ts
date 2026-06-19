import { renderMarkdown } from "./markdown";

export interface DocEntry {
  id: string;
  title: string;
  summary: string;
  body: string;
}

const DOCS: DocEntry[] = [
  {
    id: "start",
    title: "Quick start",
    summary: "Make a recipe note from the form, preview it, then copy or download it.",
    body: `# Quick start

hintof turns a recipe form into an Obsidian-ready Markdown note.

1. Open Write.
2. Open the section you need.
3. Add a title. Everything else is optional.
4. Add ingredients, instructions, source details, notes, storage, or equipment as needed.
5. Open Preview on mobile, or read the live preview on the right on desktop.
6. Use Copy to put the Markdown on your clipboard, or Download to save a .md file.

## Required fields

Only Title is required before copying, downloading, or saving.

Blank optional fields are left out of the note. hintof does not emit empty headings or empty YAML keys.`
  },
  {
    id: "writing",
    title: "Writing recipes",
    summary: "What each form section is for and how to keep output clean.",
    body: `# Writing recipes

## Recipe basics

Use this for the title, description, servings, prep time, cook time, tags, cuisine, course, diet, and image filename.

Servings and times accept whole positive numbers only. Times are stored as minutes.

## Source

Add the original recipe link, author, book, page, or adaptation note. Web links must use http or https. Unsafe links are shown as plain text instead of clickable Markdown.

## Ingredients

Enter quantity, unit, and item in separate fields. Press Enter in an ingredient item field to add the next ingredient.

Use Paste ingredients when you have a simple list. If a line cannot be parsed safely, hintof keeps it as plain ingredient text.

## Instructions

Add one step per row. Press Enter in a step field to add the next step.

## Notes and extras

Use Notes for cooking reminders, Substitutions for swaps, Storage for keeping instructions, and Equipment for tools.

## Output options

Wiki-link ingredients or cuisine when you want Obsidian links. Use callouts when you want Notes and Storage rendered as Obsidian callouts.`
  },
  {
    id: "library",
    title: "Library and backups",
    summary: "Save recipes locally, search them, import backups, and export your library.",
    body: `# Library and backups

The Library is stored in this browser with localStorage.

## Save

Use Save to add the current recipe to your library. Saving updates an existing recipe when it has the same internal id.

If browser storage is unavailable or full, hintof keeps the recipe in memory and tells you to export a copy.

## Open and delete

Open loads a saved recipe back into Write. Delete removes it from the local library after confirmation.

## Search and graph

The list can be searched by title, tag, or cuisine. Graph shows relationships based on shared tags and ingredients. The graph canvas is visual; use the adjacent recipe list for keyboard access.

## Export

Export downloads a JSON backup named hintof-library.json.

## Import

Import accepts a hintof JSON backup. You can replace the current library or merge into it. Invalid entries are quarantined and reported instead of blocking the whole import.`
  },
  {
    id: "obsidian",
    title: "Obsidian output",
    summary: "How hintof structures Markdown, YAML, images, links, and filenames.",
    body: `# Obsidian output

Each exported note has YAML frontmatter followed by a plain Markdown recipe body.

## Frontmatter

hintof always includes:

- schema_version
- title
- created
- updated

Optional fields are included only when filled in.

## Body

The note body includes only the sections with content:

- Ingredients
- Instructions
- Notes
- Substitutions
- Storage
- Equipment
- Source

## Images

Images are filename references for your vault, not uploads. A value like photo.jpg becomes an Obsidian embed.

## Filenames

Downloads use the recipe creation date plus the title, cleaned for common filesystem problems.`
  },
  {
    id: "privacy",
    title: "Privacy and offline use",
    summary: "What stays on your device and what never leaves the browser.",
    body: `# Privacy and offline use

hintof is a static client-side app.

## What stays local

Recipes, drafts, library data, and theme preference stay in your browser storage.

## What is not used

hintof has no accounts, backend, telemetry, trackers, or runtime network calls.

## Moving devices

Use Library Export on one device and Library Import on another.`
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    summary: "Common fixes for copy, storage, import, and Markdown output issues.",
    body: `# Troubleshooting

## Copy fails

Some browsers block clipboard access. Use Download instead; it produces the same Markdown content.

## Save says storage is full

Export your library immediately. Browser storage can be limited by private browsing mode, quota limits, or site settings.

## Import reports quarantined entries

Those entries were not valid hintof recipes or used an unsupported schema. Valid entries are still imported.

## A link is not clickable

Only http and https source links are emitted as Markdown links. Other link types are rendered as plain text for safety.

## Markdown looks escaped

Some characters are escaped on purpose so recipe text cannot accidentally create headings, lists, links, or embeds.`
  }
];

export function mountDocs(root: HTMLElement): void {
  const panel = document.createElement("div");
  panel.className = "docs-panel";

  const layout = document.createElement("div");
  layout.className = "docs-layout";

  const list = document.createElement("div");
  list.className = "docs-list";
  list.setAttribute("aria-label", "Documentation");

  const article = document.createElement("article");
  article.className = "note-page note-render docs-article";
  article.setAttribute("aria-live", "polite");

  function select(entry: DocEntry): void {
    for (const button of list.querySelectorAll("button")) {
      if (button.dataset.doc === entry.id) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
    article.replaceChildren(renderMarkdown(entry.body));
  }

  for (const entry of DOCS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "doc-card";
    button.dataset.doc = entry.id;
    const cardTitle = document.createElement("span");
    cardTitle.className = "doc-card-title";
    cardTitle.textContent = entry.title;
    button.append(cardTitle);
    button.addEventListener("click", () => select(entry));
    list.append(button);
  }

  layout.append(list, article);
  panel.append(layout);
  root.append(panel);
  select(DOCS[0]!);
}
