import { createIcon, iconButton, labeledButton } from "../icons";
import { parseQuantity, renderQuantity } from "../../model/quantity";
import type { AppState } from "../../store/actions";
import {
  addIngredient,
  addStep,
  addSubstitution,
  moveIngredient,
  moveStep,
  pasteIngredients,
  removeIngredient,
  removeStep,
  removeSubstitution,
  scaleByServings,
  setField,
  setGroupName,
  setOptions,
  setSectionName,
  setSource,
  setTitle,
  updateIngredient,
  updateStep,
  updateSubstitution
} from "../../store/actions";
import type { createStore } from "../../store/store";

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

function collapsibleSection(
  title: string,
  open: boolean,
  ...children: HTMLElement[]
): HTMLDetailsElement {
  const details = el("details", "form-section");
  if (open) details.open = true;
  const summary = el("summary", "form-section-summary");
  summary.append(createIcon("chevron-down", "form-section-chevron"), el("span", "", title));
  const body = el("div", "form-section-body");
  body.append(...children);
  details.append(summary, body);
  return details;
}

function labeledInput(
  id: string,
  label: string,
  value: string,
  onInput: (v: string) => void,
  opts: { required?: boolean; type?: string; multiline?: boolean; placeholder?: string } = {}
): HTMLElement {
  const wrap = el("div", "field");
  const lab = el("label", "field-label");
  lab.htmlFor = id;
  lab.textContent = label;
  const input = opts.multiline ? el("textarea", "field-input") : el("input", "field-input");
  input.id = id;
  if (!opts.multiline && "type" in input) {
    (input as HTMLInputElement).type = opts.type ?? "text";
  }
  if (opts.required && !opts.multiline) {
    (input as HTMLInputElement).required = true;
  }
  if (opts.multiline) {
    (input as HTMLTextAreaElement).rows = 3;
  }
  if (opts.placeholder) input.setAttribute("placeholder", opts.placeholder);
  if ("value" in input) input.value = value;
  input.addEventListener("input", () => onInput(input.value));
  wrap.append(lab, input);
  return wrap;
}

function syncScalarFields(
  recipe: AppState["recipe"],
  refs: {
    title: HTMLInputElement;
    description: HTMLTextAreaElement;
    servings: HTMLInputElement;
    prep: HTMLInputElement;
    cook: HTMLInputElement;
    tags: HTMLInputElement;
    cuisine: HTMLInputElement;
    course: HTMLInputElement;
    diet: HTMLInputElement;
    image: HTMLInputElement;
    notes: HTMLTextAreaElement;
    storage: HTMLTextAreaElement;
    equipment: HTMLInputElement;
    sourceName: HTMLInputElement;
    sourceUrl: HTMLInputElement;
    sourceAuthor: HTMLInputElement;
    sourceBook: HTMLInputElement;
    sourcePage: HTMLInputElement;
    sourceAdapted: HTMLInputElement;
    wikiIngredients: HTMLInputElement;
    wikiCuisine: HTMLInputElement;
    callouts: HTMLInputElement;
    fractionAscii: HTMLInputElement;
  }
): void {
  refs.title!.value = recipe.title;
  refs.description!.value = recipe.description ?? "";
  refs.servings!.value = recipe.servings?.toString() ?? "";
  refs.prep!.value = recipe.prepTime?.toString() ?? "";
  refs.cook!.value = recipe.cookTime?.toString() ?? "";
  refs.tags!.value = (recipe.tags ?? []).join(", ");
  refs.cuisine!.value = recipe.cuisine ?? "";
  refs.course!.value = recipe.course ?? "";
  refs.diet!.value = (recipe.diet ?? []).join(", ");
  refs.image!.value = recipe.image ?? "";
  refs.notes!.value = recipe.notes ?? "";
  refs.storage!.value = recipe.storage ?? "";
  refs.equipment!.value = (recipe.equipment ?? []).join(", ");
  refs.sourceName!.value = recipe.source?.name ?? "";
  refs.sourceUrl!.value = recipe.source?.url ?? "";
  refs.sourceAuthor!.value = recipe.source?.author ?? "";
  refs.sourceBook!.value = recipe.source?.book ?? "";
  refs.sourcePage!.value = recipe.source?.page ?? "";
  refs.sourceAdapted!.value = recipe.source?.adaptedFrom ?? "";
  refs.wikiIngredients!.checked = recipe.options.wikiLinks.ingredients;
  refs.wikiCuisine!.checked = recipe.options.wikiLinks.cuisine;
  refs.callouts!.checked = recipe.options.callouts;
  refs.fractionAscii!.checked = recipe.options.fractionStyle === "ascii";
}

export function mountForm(root: HTMLElement, store: Store): void {
  const form = el("form", "recipe-form");
  form.noValidate = true;

  const titleWrap = labeledInput("title", "Title", store.get().recipe.title, (v) =>
    store.update((s) => setTitle(s, v))
  );
  const titleInput = titleWrap.querySelector("input")!;
  titleInput.setAttribute("aria-required", "true");

  const descriptionWrap = labeledInput(
    "description",
    "Description",
    store.get().recipe.description ?? "",
    (v) => store.update((s) => setField(s, "description", v || undefined)),
    { multiline: true }
  );

  const metaRow = el("div", "field-row");
  const servingsWrap = labeledInput(
    "servings",
    "Servings",
    store.get().recipe.servings?.toString() ?? "",
    (v) => {
      const n = Number(v);
      store.update((s) => setField(s, "servings", v && n > 0 ? n : undefined));
    },
    { type: "number" }
  );

  const scaleRow = el("div", "scale-row");
  const scaleInput = el("input", "field-input scale-input") as HTMLInputElement;
  scaleInput.type = "number";
  scaleInput.min = "1";
  scaleInput.placeholder = "Scale to…";
  scaleInput.setAttribute("aria-label", "Scale to servings");
  const scaleBtn = el("button", "btn btn-secondary", "Scale");
  scaleBtn.type = "button";
  scaleBtn.addEventListener("click", () => {
    const target = Number(scaleInput.value);
    if (target > 0) store.update((s) => scaleByServings(s, target));
  });
  scaleRow.append(scaleInput, scaleBtn);

  const prepWrap = labeledInput(
    "prep",
    "Prep (min)",
    store.get().recipe.prepTime?.toString() ?? "",
    (v) => {
      const n = Number(v);
      store.update((s) => setField(s, "prepTime", v && n > 0 ? n : undefined));
    },
    { type: "number" }
  );

  const cookWrap = labeledInput(
    "cook",
    "Cook (min)",
    store.get().recipe.cookTime?.toString() ?? "",
    (v) => {
      const n = Number(v);
      store.update((s) => setField(s, "cookTime", v && n > 0 ? n : undefined));
    },
    { type: "number" }
  );
  metaRow.append(servingsWrap, prepWrap, cookWrap);

  const taxRow = el("div", "field-row");
  const tagsWrap = labeledInput(
    "tags",
    "Tags (comma-separated)",
    (store.get().recipe.tags ?? []).join(", "),
    (v) => {
      const list = v
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      store.update((s) => setField(s, "tags", list.length ? list : undefined));
    }
  );

  const cuisineWrap = labeledInput("cuisine", "Cuisine", store.get().recipe.cuisine ?? "", (v) =>
    store.update((s) => setField(s, "cuisine", v || undefined))
  );

  const courseWrap = labeledInput("course", "Course", store.get().recipe.course ?? "", (v) =>
    store.update((s) => setField(s, "course", v || undefined))
  );
  taxRow.append(tagsWrap, cuisineWrap, courseWrap);

  const dietWrap = labeledInput(
    "diet",
    "Diet (comma-separated)",
    (store.get().recipe.diet ?? []).join(", "),
    (v) => {
      const list = v
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      store.update((s) => setField(s, "diet", list.length ? list : undefined));
    }
  );

  const imageWrap = labeledInput(
    "image",
    "Image filename",
    store.get().recipe.image ?? "",
    (v) => store.update((s) => setField(s, "image", v || undefined)),
    { placeholder: "photo.jpg" }
  );

  const sourceGrid = el("div", "source-grid");
  const sourceFields = [
    ["source-name", "Name", "name"],
    ["source-url", "URL", "url"],
    ["source-author", "Author", "author"],
    ["source-book", "Book", "book"],
    ["source-page", "Page", "page"],
    ["source-adapted", "Adapted from", "adaptedFrom"]
  ] as const;
  for (const [id, label, key] of sourceFields) {
    const wrap = labeledInput(id, label, (store.get().recipe.source?.[key] as string) ?? "", (v) =>
      store.update((s) => setSource(s, { [key]: v || undefined }))
    );
    sourceGrid.append(wrap);
  }

  const pasteWrap = el("details", "paste-details");
  const pasteSummary = el("summary", "", "Paste ingredients");
  const pasteArea = el("textarea", "field-input paste-area") as HTMLTextAreaElement;
  pasteArea.rows = 4;
  pasteArea.placeholder = "One ingredient per line, e.g.\n2 cups flour\n1 tsp salt";
  pasteArea.setAttribute("aria-label", "Paste ingredients");
  const pasteBtn = el("button", "btn btn-secondary", "Parse & add");
  pasteBtn.type = "button";
  pasteBtn.addEventListener("click", () => {
    store.update((s) => pasteIngredients(s, 0, pasteArea.value));
    pasteArea.value = "";
    renderIngredients();
  });
  pasteWrap.append(pasteSummary, pasteArea, pasteBtn);
  const ingList = el("div", "ingredient-list");

  const stepList = el("div", "step-list");

  const notesWrap = labeledInput(
    "notes",
    "Notes",
    store.get().recipe.notes ?? "",
    (v) => store.update((s) => setField(s, "notes", v || undefined)),
    { multiline: true }
  );

  const subList = el("div", "substitution-list");
  const addSubBtn = labeledButton("Substitution", "plus", "btn btn-secondary");

  const storageWrap = labeledInput(
    "storage",
    "Storage",
    store.get().recipe.storage ?? "",
    (v) => store.update((s) => setField(s, "storage", v || undefined)),
    { multiline: true }
  );

  const equipmentWrap = labeledInput(
    "equipment",
    "Equipment (comma-separated)",
    (store.get().recipe.equipment ?? []).join(", "),
    (v) => {
      const list = v
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      store.update((s) => setField(s, "equipment", list.length ? list : undefined));
    }
  );

  const toggleGrid = el("div", "toggle-grid");

  function makeToggle(id: string, label: string, checked: boolean, onChange: (v: boolean) => void) {
    const wrap = el("label", "toggle-label");
    const input = el("input") as HTMLInputElement;
    input.type = "checkbox";
    input.id = id;
    input.checked = checked;
    input.addEventListener("change", () => onChange(input.checked));
    const span = el("span", "", label);
    wrap.append(input, span);
    return { wrap, input };
  }

  const wikiIng = makeToggle(
    "wiki-ingredients",
    "Wiki-link ingredients",
    store.get().recipe.options.wikiLinks.ingredients,
    (v) =>
      store.update((s) =>
        setOptions(s, {
          wikiLinks: { ingredients: v, cuisine: s.recipe.options.wikiLinks.cuisine }
        })
      )
  );

  const wikiCui = makeToggle(
    "wiki-cuisine",
    "Wiki-link cuisine",
    store.get().recipe.options.wikiLinks.cuisine,
    (v) =>
      store.update((s) =>
        setOptions(s, {
          wikiLinks: { cuisine: v, ingredients: s.recipe.options.wikiLinks.ingredients }
        })
      )
  );

  const calloutsToggle = makeToggle(
    "callouts",
    "Use callouts",
    store.get().recipe.options.callouts,
    (v) => store.update((s) => setOptions(s, { callouts: v }))
  );

  const frac = makeToggle(
    "fraction-ascii",
    "ASCII fractions (1/2 vs ½)",
    store.get().recipe.options.fractionStyle === "ascii",
    (v) => store.update((s) => setOptions(s, { fractionStyle: v ? "ascii" : "unicode" }))
  );

  toggleGrid.append(wikiIng.wrap, wikiCui.wrap, calloutsToggle.wrap, frac.wrap);

  const refs = {
    title: titleInput,
    description: descriptionWrap.querySelector("textarea")!,
    servings: servingsWrap.querySelector("input")!,
    prep: prepWrap.querySelector("input")!,
    cook: cookWrap.querySelector("input")!,
    tags: tagsWrap.querySelector("input")!,
    cuisine: cuisineWrap.querySelector("input")!,
    course: courseWrap.querySelector("input")!,
    diet: dietWrap.querySelector("input")!,
    image: imageWrap.querySelector("input")!,
    notes: notesWrap.querySelector("textarea")!,
    storage: storageWrap.querySelector("textarea")!,
    equipment: equipmentWrap.querySelector("input")!,
    sourceName: sourceGrid.querySelector("#source-name") as HTMLInputElement,
    sourceUrl: sourceGrid.querySelector("#source-url") as HTMLInputElement,
    sourceAuthor: sourceGrid.querySelector("#source-author") as HTMLInputElement,
    sourceBook: sourceGrid.querySelector("#source-book") as HTMLInputElement,
    sourcePage: sourceGrid.querySelector("#source-page") as HTMLInputElement,
    sourceAdapted: sourceGrid.querySelector("#source-adapted") as HTMLInputElement,
    wikiIngredients: wikiIng.input,
    wikiCuisine: wikiCui.input,
    callouts: calloutsToggle.input,
    fractionAscii: frac.input
  };

  const addIngBtn = labeledButton("Ingredient", "plus", "btn btn-secondary");
  const addStepBtn = labeledButton("Step", "plus", "btn btn-secondary");

  const substitutionsBlock = el("div", "list-section");
  substitutionsBlock.append(el("h3", "subsection-title", "Substitutions"), subList, addSubBtn);

  form.append(
    collapsibleSection(
      "Recipe basics",
      true,
      titleWrap,
      descriptionWrap,
      metaRow,
      scaleRow,
      taxRow,
      dietWrap,
      imageWrap
    ),
    collapsibleSection("Source", false, sourceGrid),
    collapsibleSection("Ingredients", true, pasteWrap, ingList, addIngBtn),
    collapsibleSection("Instructions", false, stepList, addStepBtn),
    collapsibleSection(
      "Notes & extras",
      false,
      notesWrap,
      substitutionsBlock,
      storageWrap,
      equipmentWrap
    ),
    collapsibleSection("Output options", false, toggleGrid)
  );
  root.append(form);

  const renderSubstitutions = () => {
    subList.replaceChildren();
    const subs = store.get().recipe.substitutions ?? [{ from: "", to: "" }];
    subs.forEach((sub, i) => {
      const row = el("div", "substitution-row");
      const from = el("input", "field-input") as HTMLInputElement;
      from.type = "text";
      from.placeholder = "Replace…";
      from.value = sub.from;
      from.setAttribute("aria-label", `Substitution ${i + 1} from`);
      from.addEventListener("input", () =>
        store.update((s) => updateSubstitution(s, i, { from: from.value }))
      );

      const to = el("input", "field-input") as HTMLInputElement;
      to.type = "text";
      to.placeholder = "With…";
      to.value = sub.to;
      to.setAttribute("aria-label", `Substitution ${i + 1} to`);
      to.addEventListener("input", () =>
        store.update((s) => updateSubstitution(s, i, { to: to.value }))
      );

      const remove = iconButton("Remove substitution", "x");
      remove.addEventListener("click", () => {
        store.update((s) => removeSubstitution(s, i));
        renderSubstitutions();
      });

      row.append(from, to, remove);
      subList.append(row);
    });
  };

  const renderIngredients = () => {
    ingList.replaceChildren();
    const style = store.get().recipe.options.fractionStyle;
    store.get().recipe.ingredientGroups.forEach((group, gi) => {
      if (group.name !== undefined || gi > 0) {
        const header = el("input", "field-input group-header") as HTMLInputElement;
        header.type = "text";
        header.placeholder = "Group name (optional)";
        header.value = group.name ?? "";
        header.setAttribute("aria-label", "Ingredient group name");
        header.addEventListener("input", () =>
          store.update((s) => setGroupName(s, gi, header.value))
        );
        ingList.append(header);
      }

      group.ingredients.forEach((ing, ii) => {
        const row = el("div", "ingredient-row");
        row.setAttribute("role", "group");
        row.setAttribute("aria-label", `Ingredient ${ii + 1}`);

        const qty = el("input", "field-input qty-input") as HTMLInputElement;
        qty.type = "text";
        qty.placeholder = "qty";
        qty.value = ing.qty ? renderQuantity(ing.qty, style) : "";
        qty.setAttribute("aria-label", "Quantity");
        qty.addEventListener("change", () => {
          const parsed = parseQuantity(qty.value);
          store.update((s) => updateIngredient(s, gi, ii, { qty: parsed ?? undefined }));
        });

        const unit = el("input", "field-input unit-input") as HTMLInputElement;
        unit.type = "text";
        unit.placeholder = "unit";
        unit.value = ing.unit ?? "";
        unit.setAttribute("aria-label", "Unit");
        unit.addEventListener("input", () =>
          store.update((s) => updateIngredient(s, gi, ii, { unit: unit.value || undefined }))
        );

        const item = el("input", "field-input item-input") as HTMLInputElement;
        item.type = "text";
        item.placeholder = "ingredient";
        item.value = ing.item;
        item.setAttribute("aria-label", "Item");
        item.addEventListener("input", () =>
          store.update((s) => updateIngredient(s, gi, ii, { item: item.value }))
        );
        item.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            store.update(addIngredient);
            renderIngredients();
            (ingList.querySelectorAll(".item-input").item(-1) as HTMLInputElement | null)?.focus();
          }
        });

        const up = iconButton("Move ingredient up", "chevron-up");
        up.disabled = ii === 0;
        up.addEventListener("click", () => {
          store.update((s) => moveIngredient(s, gi, ii, ii - 1));
          renderIngredients();
        });

        const down = iconButton("Move ingredient down", "chevron-down");
        down.disabled = ii === group.ingredients.length - 1;
        down.addEventListener("click", () => {
          store.update((s) => moveIngredient(s, gi, ii, ii + 1));
          renderIngredients();
        });

        const remove = iconButton("Remove ingredient", "x");
        remove.addEventListener("click", () => {
          store.update((s) => removeIngredient(s, gi, ii));
          renderIngredients();
        });

        row.append(qty, unit, item, up, down, remove);
        ingList.append(row);
      });
    });
  };

  const renderSteps = () => {
    stepList.replaceChildren();
    store.get().recipe.stepSections.forEach((section, si) => {
      if (section.name !== undefined || si > 0) {
        const header = el("input", "field-input group-header") as HTMLInputElement;
        header.type = "text";
        header.placeholder = "Section name (optional)";
        header.value = section.name ?? "";
        header.setAttribute("aria-label", "Step section name");
        header.addEventListener("input", () =>
          store.update((s) => setSectionName(s, si, header.value))
        );
        stepList.append(header);
      }

      section.steps.forEach((step, ii) => {
        const row = el("div", "step-row");
        const num = el("span", "step-num", String(ii + 1));
        const input = el("input", "field-input") as HTMLInputElement;
        input.type = "text";
        input.placeholder = `Step ${ii + 1}`;
        input.value = step;
        input.setAttribute("aria-label", `Step ${ii + 1}`);
        input.addEventListener("input", () =>
          store.update((s) => updateStep(s, si, ii, input.value))
        );
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            store.update(addStep);
            renderSteps();
            (
              stepList.querySelectorAll(".step-row input").item(-1) as HTMLInputElement | null
            )?.focus();
          }
        });

        const up = iconButton("Move step up", "chevron-up");
        up.disabled = ii === 0;
        up.addEventListener("click", () => {
          store.update((s) => moveStep(s, si, ii, ii - 1));
          renderSteps();
        });

        const down = iconButton("Move step down", "chevron-down");
        down.disabled = ii === section.steps.length - 1;
        down.addEventListener("click", () => {
          store.update((s) => moveStep(s, si, ii, ii + 1));
          renderSteps();
        });

        const remove = iconButton("Remove step", "x");
        remove.addEventListener("click", () => {
          store.update((s) => removeStep(s, si, ii));
          renderSteps();
        });

        row.append(num, input, up, down, remove);
        stepList.append(row);
      });
    });
  };

  addIngBtn.addEventListener("click", () => {
    store.update(addIngredient);
    renderIngredients();
  });

  addStepBtn.addEventListener("click", () => {
    store.update(addStep);
    renderSteps();
  });

  addSubBtn.addEventListener("click", () => {
    store.update(addSubstitution);
    renderSubstitutions();
  });

  renderIngredients();
  renderSteps();
  renderSubstitutions();

  store.select(
    (s) => s.recipe.id,
    () => {
      syncScalarFields(store.get().recipe, refs);
      renderIngredients();
      renderSteps();
      renderSubstitutions();
    }
  );

  store.select(
    (s) => s.recipe.options.fractionStyle,
    () => renderIngredients()
  );
}
