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
import { createIcon, labeledButton, setLabeledButton } from "./ui/icons";
import { mountForm } from "./ui/views/form";
import { mountLibrary } from "./ui/views/library";
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
wordmark.append("hintof", createIcon("tick", "icon icon-tick"));

const nav = document.createElement("nav");
nav.className = "header-nav";
nav.setAttribute("aria-label", "Main");

const editorNav = labeledButton("Write", "pen", "btn btn-secondary nav-btn");
const libraryNav = labeledButton("Library", "library", "btn btn-secondary nav-btn");

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

editorNav.addEventListener("click", () => store.update((s) => setView(s, "editor")));
libraryNav.addEventListener("click", () => store.update((s) => setView(s, "library")));

nav.append(editorNav, libraryNav, themeSelectWrap);
headerRow.append(wordmark, nav);
header.append(headerRow);

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

main.append(editorView, libraryCol);
shell.append(header, main);

const actions = document.createElement("div");
actions.className = "action-bar";

const status = document.createElement("p");
status.className = "status-text";
status.setAttribute("role", "status");
status.setAttribute("aria-live", "polite");

const panelToggle = labeledButton("Preview", "eye", "btn btn-secondary panel-toggle");
const saveBtn = labeledButton("Save", "save", "btn btn-secondary");
const copyBtn = labeledButton("Copy", "copy", "btn btn-primary");
const downloadBtn = labeledButton("Download", "download", "btn btn-primary");

saveBtn.addEventListener("click", () => store.update(saveToLibrary));

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

panelToggle.addEventListener("click", () => {
  const next = store.get().panel === "write" ? "preview" : "write";
  store.update((s) => setPanel(s, next));
});

actions.append(panelToggle, saveBtn, copyBtn, downloadBtn, status);
shell.append(actions);
app.append(shell);

function syncUi(state: ReturnType<typeof store.get>) {
  setPreview(previewText(state.recipe));
  autosave(state.recipe);
  status.textContent = state.status;
  setLabeledButton(
    panelToggle,
    state.panel === "write" ? "eye" : "pen",
    state.panel === "write" ? "Preview" : "Write"
  );
  shell.dataset.panel = state.panel;
  shell.dataset.view = state.view;
  editorView.hidden = state.view !== "editor";
  libraryCol.hidden = state.view !== "library";
  actions.hidden = state.view !== "editor";
  if (state.view === "editor") editorNav.setAttribute("aria-current", "page");
  else editorNav.removeAttribute("aria-current");
  if (state.view === "library") libraryNav.setAttribute("aria-current", "page");
  else libraryNav.removeAttribute("aria-current");
  if (themeSelect.value !== state.theme) themeSelect.value = state.theme;
}

store.subscribe(syncUi);
syncUi(store.get());
