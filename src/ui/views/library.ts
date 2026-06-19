import { loadRecipe, newRecipe, removeFromLibrary, setStatus } from "../../store/actions";
import type { createStore } from "../../store/store";
import type { AppState } from "../../store/actions";
import { downloadText } from "../../export/download";
import { createLibraryExport, parseLibraryJson } from "../../persist/io";
import { saveLibrary } from "../../persist/library";
import { labeledButton } from "../icons";
import { createGraph } from "./graph";

type Store = ReturnType<typeof createStore<AppState>>;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function mountLibrary(root: HTMLElement, store: Store): () => void {
  const panel = el("div", "library-panel");
  panel.setAttribute("aria-label", "Recipe library");

  const header = el("div", "library-header");

  const listBtn = labeledButton("List", "library", "library-pill view-toggle");
  const graphBtn = labeledButton("Graph", "graph", "library-pill view-toggle");
  const exportBtn = labeledButton("Export", "download", "library-pill");
  const importBtn = labeledButton("Import", "upload", "library-pill");
  const newBtn = labeledButton("New", "plus", "btn btn-secondary");
  const importInput = el("input") as HTMLInputElement;
  importInput.type = "file";
  importInput.accept = "application/json,.json";
  importInput.hidden = true;
  const toolbar = el("div", "library-toolbar");
  const viewStrip = el("div", "library-pill-strip");
  viewStrip.setAttribute("aria-label", "Library view");
  viewStrip.append(listBtn, graphBtn);
  const ioStrip = el("div", "library-pill-strip");
  ioStrip.setAttribute("aria-label", "Library import and export");
  ioStrip.append(exportBtn, importBtn);
  toolbar.append(viewStrip, ioStrip, newBtn);
  header.append(toolbar, importInput);

  const search = el("input", "library-search field-input") as HTMLInputElement;
  search.type = "search";
  search.placeholder = "Search title, tag or cuisine…";
  search.setAttribute("aria-label", "Search recipes");

  const list = el("div", "library-groups");
  const empty = el("p", "empty-state", "No saved recipes yet. Write one and tap Save.");

  const graph = createGraph(store);
  graph.el.hidden = true;

  const setCurrent = (btn: HTMLElement, on: boolean) =>
    on ? btn.setAttribute("aria-current", "page") : btn.removeAttribute("aria-current");

  let mode: "list" | "graph" = "list";
  const applyMode = () => {
    list.hidden = mode !== "list";
    search.hidden = mode !== "list";
    graph.el.hidden = mode !== "graph";
    setCurrent(listBtn, mode === "list");
    setCurrent(graphBtn, mode === "graph");
    if (mode === "graph") graph.show();
    else render();
  };
  listBtn.addEventListener("click", () => {
    mode = "list";
    applyMode();
  });
  graphBtn.addEventListener("click", () => {
    mode = "graph";
    applyMode();
  });

  newBtn.addEventListener("click", () => store.update(newRecipe));
  exportBtn.addEventListener("click", () => {
    const text = JSON.stringify(createLibraryExport(store.get().library), null, 2);
    downloadText("hintof-library.json", text);
    store.update((s) => setStatus(s, "Library export started."));
  });
  importBtn.addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    importInput.value = "";
    if (!file) return;
    const mode = confirm("Replace the current library? Cancel to merge instead.")
      ? "replace"
      : "merge";
    const result = parseLibraryJson(await file.text(), store.get().library, mode);
    const saved = saveLibrary(result.recipes);
    const report = result.quarantined.length
      ? ` ${result.quarantined.length} invalid entr${result.quarantined.length === 1 ? "y" : "ies"} quarantined.`
      : "";
    store.update((s) => ({
      ...s,
      library: result.recipes,
      status: saved.ok
        ? `Imported ${result.imported}; updated ${result.updated}.${report}`
        : "Imported here, but storage could not update. Export your library to keep a copy."
    }));
  });

  // ponytail: mobile shows one pill at a time (CSS scroll-snap). Tapping the
  // shown option fires it, then reveals the other; swiping snaps natively.
  // Two taps to switch view — add a scrollend selector if direct switch wanted.
  const enableSwap = (strip: HTMLElement) => {
    const btns = [...strip.querySelectorAll<HTMLButtonElement>("button")];
    strip.addEventListener("click", (e) => {
      const cur = (e.target as HTMLElement).closest("button");
      const i = cur ? btns.indexOf(cur as HTMLButtonElement) : -1;
      if (i < 0) return;
      btns[(i + 1) % btns.length]?.scrollIntoView({ inline: "center", block: "nearest" });
    });
  };
  enableSwap(viewStrip);
  enableSwap(ioStrip);

  panel.append(header, search, list, empty, graph.el);
  root.append(panel);

  function card(recipe: AppState["library"][number]): HTMLElement {
    const card = el("article", "library-card");
    card.setAttribute("aria-label", recipe.title || "Untitled recipe");

    const cardTitle = el("h3", "library-card-title", recipe.title || "Untitled");
    const meta = el("p", "library-card-meta");
    const parts: string[] = [];
    if (recipe.tags?.length) parts.push(recipe.tags.slice(0, 3).join(", "));
    parts.push(`Updated ${recipe.updated}`);
    meta.textContent = parts.join(" · ");

    const actions = el("div", "library-card-actions");
    const openBtn = labeledButton("Open", "pen", "btn btn-primary");
    openBtn.addEventListener("click", () => store.update((s) => loadRecipe(s, recipe)));
    const deleteBtn = labeledButton("Delete", "trash", "btn btn-secondary");
    deleteBtn.addEventListener("click", () => {
      if (confirm(`Delete "${recipe.title || "Untitled"}"?`)) {
        store.update((s) => removeFromLibrary(s, recipe.id));
      }
    });
    actions.append(openBtn, deleteBtn);
    card.append(cardTitle, meta, actions);
    return card;
  }

  const render = () => {
    const all = store.get().library;
    const q = search.value.trim().toLowerCase();
    const recipes = q
      ? all.filter((r) =>
          [r.title, r.cuisine, ...(r.tags ?? [])].join(" ").toLowerCase().includes(q)
        )
      : all;

    list.replaceChildren();
    empty.hidden = mode !== "list" || recipes.length > 0;
    empty.textContent = all.length
      ? "No recipes match your search."
      : "No saved recipes yet. Write one and tap Save.";

    // group by cuisine; Uncategorized sinks to the bottom
    const groups = new Map<string, typeof recipes>();
    for (const r of recipes) {
      const key = r.cuisine?.trim() || "Uncategorized";
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
    }
    const names = [...groups.keys()].sort((a, b) =>
      a === "Uncategorized" ? 1 : b === "Uncategorized" ? -1 : a.localeCompare(b)
    );

    for (const name of names) {
      const group = el("section", "library-group");
      group.append(el("h3", "library-group-title", name));
      const grid = el("div", "library-list");
      groups
        .get(name)!
        .sort((a, b) => b.updated.localeCompare(a.updated))
        .forEach((r) => grid.append(card(r)));
      group.append(grid);
      list.append(group);
    }
  };

  search.addEventListener("input", render);

  render();
  return store.select((s) => s.library, render);
}
