import { loadRecipe, newRecipe, setStatus } from "../../store/actions";
import type { createStore } from "../../store/store";
import type { AppState } from "../../store/actions";
import { downloadText } from "../../export/download";
import {
  applyRestore,
  classifyRestore,
  verifyChecksum,
  type HintofBackupV2,
  type RestorePreview
} from "../../persist/backup";
import {
  exportBackupLive,
  getStoredDraft,
  removeLive,
  replaceLibraryLive,
  restoreReplaceLive
} from "../../persist/live";
import type { StoredDraft } from "../../persist/repo/types";
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
  const linkBtn = labeledButton("Link", "link", "library-pill");
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
  ioStrip.append(exportBtn, importBtn, linkBtn);
  toolbar.append(viewStrip, ioStrip, newBtn);

  const linkPanel = el("form", "library-link-panel");
  linkPanel.hidden = true;
  const linkInput = el("input", "field-input library-link-input") as HTMLInputElement;
  linkInput.type = "url";
  linkInput.placeholder = "Paste recipe link";
  linkInput.setAttribute("aria-label", "Recipe link");
  const linkReviewBtn = labeledButton("Review", "pen", "btn btn-secondary");
  linkReviewBtn.type = "submit";
  linkPanel.append(linkInput, linkReviewBtn);

  header.append(toolbar, linkPanel, importInput);

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
  exportBtn.addEventListener("click", async () => {
    const backup = await exportBackupLive(store);
    downloadText("hintof-backup.json", JSON.stringify(backup, null, 2));
    store.update((s) => setStatus(s, "Backup export started."));
  });
  importBtn.addEventListener("click", () => importInput.click());
  linkBtn.addEventListener("click", () => {
    linkPanel.hidden = !linkPanel.hidden;
    if (!linkPanel.hidden) linkInput.focus();
  });
  linkPanel.addEventListener("submit", (e) => {
    e.preventDefault();
    store.update((s) =>
      setStatus(
        s,
        "Link import needs a fetcher; this GitHub Pages build imports local backup files only."
      )
    );
  });
  importInput.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    importInput.value = "";
    if (!file) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      store.update((s) => setStatus(s, "Couldn't read that file — it isn't valid JSON."));
      return;
    }

    const obj = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
    const recipes = Array.isArray(parsed)
      ? parsed
      : Array.isArray(obj.recipes)
        ? (obj.recipes as unknown[])
        : null;
    if (!recipes) {
      store.update((s) => setStatus(s, "Expected a hintof library or backup export."));
      return;
    }

    const draft = (obj.draft ?? null) as StoredDraft | null;
    let checksumValid: boolean | null = null;
    if (obj.format === "hintof-backup" && typeof obj.checksum === "string") {
      checksumValid = await verifyChecksum(parsed as HintofBackupV2).catch(() => false);
    }
    const existingHasDraft = Boolean(await getStoredDraft());
    const preview = classifyRestore(
      { recipes, draft },
      store.get().library,
      existingHasDraft,
      checksumValid
    );
    openRestoreReview(preview, recipes, draft);
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

  // Import review screen: classify the incoming file, then let the user choose
  // Merge / Replace / Cancel explicitly (no native confirm). Replace snapshots
  // the current library first via restoreReplaceLive.
  const overlay = el("div", "restore-overlay");
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Review import");
  overlay.hidden = true;
  const dialog = el("div", "restore-dialog");
  overlay.append(dialog);
  root.append(overlay);

  function onReviewKey(e: KeyboardEvent): void {
    if (e.key === "Escape") closeReview();
  }
  function closeReview(): void {
    overlay.hidden = true;
    dialog.replaceChildren();
    document.removeEventListener("keydown", onReviewKey);
  }
  function finish(msg: string): void {
    store.update((s) => setStatus(s, msg));
    closeReview();
  }
  function countLine(n: number, label: string): HTMLElement | null {
    return n ? el("li", "restore-line", `${n} ${label}`) : null;
  }

  function openRestoreReview(
    preview: RestorePreview,
    recipes: unknown[],
    draft: StoredDraft | null
  ): void {
    dialog.replaceChildren();
    dialog.append(el("h2", "restore-title", "Review import"));
    dialog.append(
      el(
        "p",
        "restore-summary",
        `${recipes.length} recipe${recipes.length === 1 ? "" : "s"} in this file.`
      )
    );

    const breakdown = el("ul", "restore-breakdown");
    for (const node of [
      countLine(preview.newRecipes.length, "new"),
      countLine(preview.updatedRecipes.length, "newer — would update"),
      countLine(preview.exactDuplicates.length, "identical — skipped"),
      countLine(preview.conflicts.length, "older or divergent — kept on merge"),
      countLine(preview.invalidEntries.length, "invalid — ignored")
    ]) {
      if (node) breakdown.append(node);
    }
    if (breakdown.childElementCount) dialog.append(breakdown);

    if (preview.checksumValid === false) {
      dialog.append(
        el(
          "p",
          "restore-warn",
          "Checksum mismatch — this backup may be corrupted. Restore only if you trust it."
        )
      );
    }

    const buttons = el("div", "restore-buttons");
    const merge = labeledButton("Merge", "plus", "btn btn-primary");
    merge.addEventListener("click", async () => {
      const res = applyRestore({ recipes }, store.get().library, "merge");
      const ok = await replaceLibraryLive(store, res.recipes);
      finish(
        ok
          ? `Merged: ${res.added} added, ${res.updated} updated, ${res.skipped} unchanged.`
          : "Imported here, but storage could not update. Export to keep a copy."
      );
    });
    const replace = labeledButton("Replace", "trash", "btn btn-secondary");
    replace.addEventListener("click", async () => {
      const res = applyRestore({ recipes }, store.get().library, "replace");
      const ok = await restoreReplaceLive(store, res.recipes, draft);
      finish(
        ok
          ? `Replaced library with ${res.added} recipe${res.added === 1 ? "" : "s"} (previous version saved as a snapshot).`
          : "Couldn't replace — your library is unchanged."
      );
    });
    const cancel = labeledButton("Cancel", "x", "btn btn-secondary");
    cancel.addEventListener("click", closeReview);
    buttons.append(merge, replace, cancel);
    dialog.append(buttons);

    overlay.hidden = false;
    document.addEventListener("keydown", onReviewKey);
    merge.focus();
  }

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
        void removeLive(store, recipe.id);
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
