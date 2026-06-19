import type { ThemePref } from "../persist/theme";

export type IconName =
  | "sun"
  | "moon"
  | "monitor"
  | "pen"
  | "library"
  | "eye"
  | "copy"
  | "download"
  | "save"
  | "chevron-up"
  | "chevron-down"
  | "x"
  | "plus"
  | "trash"
  | "tick"
  | "palette"
  | "flame";

const SVG_NS = ["http:", "", "www.w3.org", "2000", "svg"].join("/") as "http://www.w3.org/2000/svg";

const STROKE_ATTRS = {
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "2",
  "stroke-linecap": "round",
  "stroke-linejoin": "round"
} as const;

function setAttrs(el: Element, attrs: Record<string, string>): void {
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
}

function strokeEl(tag: string, attrs: Record<string, string>): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  setAttrs(el, { ...STROKE_ATTRS, ...attrs });
  return el;
}

const BUILDERS: Record<IconName, (svg: SVGSVGElement) => void> = {
  sun(svg) {
    svg.append(
      strokeEl("circle", { cx: "12", cy: "12", r: "4" }),
      strokeEl("path", {
        d: "M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      })
    );
  },
  moon(svg) {
    svg.append(strokeEl("path", { d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" }));
  },
  monitor(svg) {
    svg.append(
      strokeEl("rect", { x: "2", y: "3", width: "20", height: "14", rx: "2" }),
      strokeEl("path", { d: "M8 21h8M12 17v4" })
    );
  },
  pen(svg) {
    svg.append(strokeEl("path", { d: "M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" }));
  },
  library(svg) {
    svg.append(
      strokeEl("path", { d: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20" }),
      strokeEl("path", { d: "M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" })
    );
  },
  eye(svg) {
    svg.append(
      strokeEl("path", { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" }),
      strokeEl("circle", { cx: "12", cy: "12", r: "3" })
    );
  },
  copy(svg) {
    svg.append(
      strokeEl("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2" }),
      strokeEl("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })
    );
  },
  download(svg) {
    svg.append(
      strokeEl("path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }),
      strokeEl("polyline", { points: "7 10 12 15 17 10" }),
      strokeEl("line", { x1: "12", y1: "15", x2: "12", y2: "3" })
    );
  },
  save(svg) {
    svg.append(strokeEl("path", { d: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" }));
  },
  "chevron-up"(svg) {
    svg.append(strokeEl("polyline", { points: "18 15 12 9 6 15" }));
  },
  "chevron-down"(svg) {
    svg.append(strokeEl("polyline", { points: "6 9 12 15 18 9" }));
  },
  x(svg) {
    svg.append(strokeEl("path", { d: "M18 6 6 18M6 6l12 12" }));
  },
  plus(svg) {
    svg.append(strokeEl("path", { d: "M12 5v14M5 12h14" }));
  },
  trash(svg) {
    svg.append(
      strokeEl("polyline", { points: "3 6 5 6 21 6" }),
      strokeEl("path", {
        d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
      })
    );
  },
  tick(svg) {
    svg.append(strokeEl("path", { d: "M5 12.5 9.5 17 19 7", "stroke-width": "2.5" }));
  },
  palette(svg) {
    svg.append(
      strokeEl("path", {
        d: "M12 2a10 10 0 1 0 0 20 4 4 0 0 0 0-8 2 2 0 0 0-4 0 2 2 0 0 0-4 0 4 4 0 0 0 0 8"
      })
    );
  },
  flame(svg) {
    svg.append(strokeEl("path", { d: "M12 22c4-2 8-6 8-11a8 8 0 0 0-16 0c0 5 4 9 8 11z" }));
  }
};

export function createIcon(name: IconName, className = "icon"): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  setAttrs(svg, {
    class: className,
    viewBox: "0 0 24 24",
    width: "20",
    height: "20",
    "aria-hidden": "true"
  });
  BUILDERS[name](svg);
  return svg;
}

export function iconButton(
  ariaLabel: string,
  name: IconName,
  className = "btn-icon"
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.setAttribute("aria-label", ariaLabel);
  btn.append(createIcon(name));
  return btn;
}

export function labeledButton(
  label: string,
  name: IconName,
  className = "btn btn-secondary"
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `${className} btn-with-icon`.trim();
  btn.append(
    createIcon(name),
    Object.assign(document.createElement("span"), { textContent: label })
  );
  return btn;
}

export function setIconButton(btn: HTMLButtonElement, name: IconName): void {
  const existing = btn.querySelector("svg");
  const next = createIcon(name, existing?.getAttribute("class") ?? "icon");
  existing?.replaceWith(next);
  if (!existing) btn.prepend(next);
}

export function setLabeledButton(btn: HTMLButtonElement, name: IconName, label: string): void {
  btn.classList.add("btn-with-icon");
  const iconEl = btn.querySelector("svg");
  let labelEl = btn.querySelector("span");
  if (!iconEl) {
    btn.prepend(createIcon(name));
  } else {
    setIconButton(btn, name);
  }
  if (!labelEl) {
    labelEl = document.createElement("span");
    btn.append(labelEl);
  }
  labelEl.textContent = label;
}

export const themeIcon: Record<ThemePref, IconName> = {
  system: "monitor",
  light: "sun",
  dark: "moon",
  "gruvbox-light": "palette",
  "gruvbox-dark": "flame"
};
