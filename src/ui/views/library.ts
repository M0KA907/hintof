import { loadRecipe, newRecipe, removeFromLibrary } from "../../store/actions";
import type { createStore } from "../../store/store";
import type { AppState } from "../../store/actions";
import { labeledButton } from "../icons";

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
  const title = el("h2", "section-title", "Library");
  const newBtn = labeledButton("New recipe", "plus", "btn btn-secondary");
  newBtn.addEventListener("click", () => store.update(newRecipe));
  header.append(title, newBtn);

  const list = el("div", "library-list");
  const empty = el("p", "empty-state", "No saved recipes yet. Write one and tap Save.");

  panel.append(header, list, empty);
  root.append(panel);

  const render = () => {
    const recipes = store.get().library;
    list.replaceChildren();
    empty.hidden = recipes.length > 0;

    recipes
      .slice()
      .sort((a, b) => b.updated.localeCompare(a.updated))
      .forEach((recipe) => {
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
        list.append(card);
      });
  };

  render();
  return store.select((s) => s.library, render);
}
