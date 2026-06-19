import { copyText } from "./export/clipboard";
import { downloadText } from "./export/download";
import { autosave, loadDraft } from "./persist/autosave";
import {
  applyTheme,
  loadTheme,
  saveTheme,
  THEME_LABELS,
  THEME_PREFS,
  type ThemePref
} from "./persist/theme";
import { recipeFilename, recipeToNote } from "./serialize";
import {
  initialState,
  saveToLibrary,
  setPanel,
  setStatus,
  setTheme,
  setView
} from "./store/actions";
import { createStore } from "./store/store";
import { createIcon, labeledButton } from "./ui/icons";
import { mountForm } from "./ui/views/form";
import { mountLibrary } from "./ui/views/library";
import { mountDocs } from "./ui/views/docs";
import { mountPreview, previewText } from "./ui/views/preview";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("#app missing");

const themePref = loadTheme();
applyTheme(themePref);

const draft = loadDraft();
const store = createStore({ ...initialState(), theme: themePref });
if (draft?.title !== undefined) {
  store.update((s) => ({ ...s, recipe: draft }));
}

const shell = document.createElement("div");
shell.className = "app-shell";

const header = document.createElement("header");
header.className = "app-header";

const headerRow = document.createElement("div");
headerRow.className = "header-row";

const wordmark = document.createElement("h1");
wordmark.className = "wordmark";
wordmark.append("hint", createIcon("tick", "icon icon-tick"), "of");

const nav = document.createElement("nav");
nav.className = "header-nav";
nav.setAttribute("aria-label", "Main");

type ViewState = ReturnType<typeof store.get>;

function makeSegmented(
  labels: string[],
  getActive: (s: ViewState) => number,
  onSelect: (i: number) => void,
  opts: { swipe?: boolean; className?: string } = {}
) {
  const root = document.createElement("div");
  root.className = opts.className ? `segmented ${opts.className}` : "segmented";
  root.setAttribute("aria-label", "View");
  const thumb = document.createElement("div");
  thumb.className = "segmented-thumb";
  thumb.setAttribute("aria-hidden", "true");
  root.append(thumb);
  const tabs = labels.map((label, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "segmented-btn";
    b.textContent = label;
    b.addEventListener("click", () => onSelect(i));
    root.append(b);
    return b;
  });
  const sync = (s: ViewState) => {
    const a = getActive(s);
    const t = tabs[a];
    if (t) {
      thumb.style.width = `${t.offsetWidth}px`;
      thumb.style.transform = `translateX(${t.offsetLeft}px)`;
    }
    tabs.forEach((tab, i) => {
      if (i === a) tab.setAttribute("aria-current", "page");
      else tab.removeAttribute("aria-current");
    });
  };
  new ResizeObserver(() => sync(store.get())).observe(root);
  if (opts.swipe) {
    let sx = 0;
    let on = false;
    let swiped = false;
    root.addEventListener("pointerdown", (e) => {
      sx = e.clientX;
      on = true;
    });
    root.addEventListener("pointerup", (e) => {
      if (!on) return;
      on = false;
      const dx = e.clientX - sx;
      if (Math.abs(dx) < 40) return;
      swiped = true;
      const last = labels.length - 1;
      onSelect(Math.max(0, Math.min(last, getActive(store.get()) + (dx < 0 ? -1 : 1))));
    });
    root.addEventListener(
      "click",
      (e) => {
        if (swiped) {
          e.stopPropagation();
          e.preventDefault();
          swiped = false;
        }
      },
      true
    );
  }
  return { el: root, sync };
}

// mobile: 3-option swipe pill in the footer (Preview matters on a single panel)
const footerPill = makeSegmented(
  ["Write", "Preview", "Library", "Docs"],
  (s) => (s.view === "docs" ? 3 : s.view === "library" ? 2 : s.panel === "preview" ? 1 : 0),
  (i) =>
    i === 3
      ? store.update((s) => setView(s, "docs"))
      : i === 2
        ? store.update((s) => setView(s, "library"))
        : store.update((s) => setPanel(setView(s, "editor"), i === 1 ? "preview" : "write")),
  { swipe: true }
);

// desktop: 3-option pill in the header (both editor panels show, so no Preview)
const headerPill = makeSegmented(
  ["Write", "Library", "Docs"],
  (s) => (s.view === "docs" ? 2 : s.view === "library" ? 1 : 0),
  (i) =>
    i === 2
      ? store.update((s) => setView(s, "docs"))
      : i === 1
        ? store.update((s) => setView(s, "library"))
        : store.update((s) => setView(s, "editor")),
  { className: "header-pill" }
);

const themeSelectWrap = document.createElement("label");
themeSelectWrap.className = "theme-select-wrap";

const themeSelect = document.createElement("select");
themeSelect.id = "theme-select";
themeSelect.className = "theme-select";
themeSelect.setAttribute("aria-label", "Color theme");

for (const pref of THEME_PREFS) {
  const option = document.createElement("option");
  option.value = pref;
  option.textContent = THEME_LABELS[pref];
  themeSelect.append(option);
}

themeSelect.value = themePref;

themeSelect.addEventListener("change", () => {
  const next = themeSelect.value as ThemePref;
  store.update((s) => setTheme(s, next));
  applyTheme(next);
  saveTheme(next);
});

themeSelectWrap.append(themeSelect);

const headerActions = document.createElement("div");
headerActions.className = "header-actions";
const saveBtn = labeledButton("Save", "save", "btn btn-secondary");
saveBtn.addEventListener("click", () => store.update(saveToLibrary));
headerActions.append(themeSelectWrap, saveBtn);

headerRow.append(wordmark, headerPill.el, headerActions);
header.append(headerRow);

nav.className = "nav-bar";
nav.append(footerPill.el);

const main = document.createElement("div");
main.className = "app-main";

const editorView = document.createElement("div");
editorView.className = "editor-view";

const layout = document.createElement("div");
layout.className = "app-layout";

const formCol = document.createElement("section");
formCol.className = "panel panel-write";
formCol.setAttribute("aria-label", "Recipe form");

const previewCol = document.createElement("section");
previewCol.className = "panel panel-preview";
previewCol.setAttribute("aria-label", "Live preview");

const page = document.createElement("div");
page.className = "note-page";
const setPreview = mountPreview(page);
previewCol.append(page);

mountForm(formCol, store);
layout.append(formCol, previewCol);
editorView.append(layout);

const libraryCol = document.createElement("section");
libraryCol.className = "panel panel-library";
libraryCol.hidden = true;
mountLibrary(libraryCol, store);

const docsCol = document.createElement("section");
docsCol.className = "panel panel-docs";
docsCol.hidden = true;
mountDocs(docsCol);

main.append(editorView, libraryCol, docsCol);
shell.append(header, main);

const actions = document.createElement("div");
actions.className = "action-bar";

const status = document.createElement("p");
status.className = "status-text";
status.setAttribute("role", "status");
status.setAttribute("aria-live", "polite");

const copyBtn = labeledButton("Copy", "copy", "btn btn-primary");
const downloadBtn = labeledButton("Download", "download", "btn btn-primary");

copyBtn.addEventListener("click", async () => {
  const recipe = store.get().recipe;
  if (!recipe.title.trim()) {
    store.update((s) => setStatus(s, "Add a title before exporting."));
    return;
  }
  const text = recipeToNote(recipe);
  const ok = await copyText(text);
  store.update((s) => setStatus(s, ok ? "Copied to clipboard." : "Copy failed — use Download."));
});

downloadBtn.addEventListener("click", () => {
  const recipe = store.get().recipe;
  if (!recipe.title.trim()) {
    store.update((s) => setStatus(s, "Add a title before exporting."));
    return;
  }
  const text = recipeToNote(recipe);
  downloadText(recipeFilename(recipe.created, recipe.title), text);
  store.update((s) => setStatus(s, "Download started."));
});

actions.append(copyBtn, downloadBtn);

const footer = document.createElement("div");
footer.className = "app-footer";
footer.append(status, nav, actions);
shell.append(footer);
app.append(shell);

// status sits above the pill; auto-fades 5s after a new message
let statusTimer = 0;
let prevStatus = "";
function showStatus(msg: string) {
  if (msg === prevStatus) return;
  prevStatus = msg;
  status.textContent = msg;
  status.classList.toggle("is-visible", Boolean(msg));
  clearTimeout(statusTimer);
  if (msg) {
    statusTimer = window.setTimeout(() => {
      status.classList.remove("is-visible");
      prevStatus = "";
    }, 5000);
  }
}

function syncUi(state: ReturnType<typeof store.get>) {
  setPreview(previewText(state.recipe));
  autosave(state.recipe);
  showStatus(state.status);
  footerPill.sync(state);
  headerPill.sync(state);
  shell.dataset.panel = state.panel;
  shell.dataset.view = state.view;
  editorView.hidden = state.view !== "editor";
  libraryCol.hidden = state.view !== "library";
  docsCol.hidden = state.view !== "docs";
  actions.hidden = state.view !== "editor";
  if (themeSelect.value !== state.theme) themeSelect.value = state.theme;
}

store.subscribe(syncUi);
syncUi(store.get());

// easter egg: type "vt100" anywhere to toggle a secret phosphor-terminal theme.
// not persisted and not in the picker — selecting any real theme restores it.
let eggBuf = "";
document.addEventListener("keydown", (e) => {
  if (e.key.length !== 1) return;
  eggBuf = (eggBuf + e.key.toLowerCase()).slice(-5);
  if (eggBuf !== "vt100") return;
  const root = document.documentElement;
  if (root.getAttribute("data-theme") === "vt100") applyTheme(themeSelect.value as ThemePref);
  else root.setAttribute("data-theme", "vt100");
});
