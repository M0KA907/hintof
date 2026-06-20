import { loadRecipe } from "../../store/actions";
import type { AppState } from "../../store/actions";
import type { Recipe } from "../../model/types";
import type { createStore } from "../../store/store";
import { iconButton, labeledButton } from "../icons";

type Store = ReturnType<typeof createStore<AppState>>;

interface Node {
  id: string;
  title: string;
  tags: Set<string>;
  ings: Set<string>;
  deg: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}
interface Edge {
  a: number;
  b: number;
  w: number;
}

const norm = (s: string) => s.trim().toLowerCase();
const inter = (a: Set<string>, b: Set<string>) => {
  let n = 0;
  for (const v of a) if (b.has(v)) n++;
  return n;
};

export function buildGraph(recipes: Recipe[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = recipes.map((r, i) => ({
    id: r.id,
    title: r.title || "Untitled",
    tags: new Set((r.tags ?? []).map(norm).filter(Boolean)),
    ings: new Set(
      r.ingredientGroups.flatMap((g) => g.ingredients.map((x) => norm(x.item))).filter(Boolean)
    ),
    deg: 0,
    // seed on a ring so the sim untangles deterministically (no Math.random)
    x: Math.cos((i / Math.max(1, recipes.length)) * Math.PI * 2) * 160,
    y: Math.sin((i / Math.max(1, recipes.length)) * Math.PI * 2) * 160,
    vx: 0,
    vy: 0
  }));
  const edges: Edge[] = [];
  // ponytail: O(n^2) pair scan — fine for a personal library (tens–hundreds of recipes)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const w = inter(nodes[i]!.tags, nodes[j]!.tags) + inter(nodes[i]!.ings, nodes[j]!.ings);
      if (w > 0) {
        edges.push({ a: i, b: j, w });
        nodes[i]!.deg += w;
        nodes[j]!.deg += w;
      }
    }
  }
  return { nodes, edges };
}

export function selectVisibleEdges(edges: Edge[], nodeCount: number, maxPerNode: number): Edge[] {
  if (maxPerNode <= 0) return [];

  const incident: Edge[][] = Array.from({ length: nodeCount }, () => []);
  for (const edge of edges) {
    incident[edge.a]?.push(edge);
    incident[edge.b]?.push(edge);
  }

  const selected = new Set<Edge>();
  for (const list of incident) {
    list
      .sort((a, b) => b.w - a.w || a.a - b.a || a.b - b.b)
      .slice(0, maxPerNode)
      .forEach((edge) => selected.add(edge));
  }

  return [...selected].sort((a, b) => b.w - a.w || a.a - b.a || a.b - b.b);
}

function step(nodes: Node[], edges: Edge[], dense = false): number {
  const REPEL = dense ? 2600 : 7000;
  const SPRING = dense ? 0.04 : 0.02;
  const CENTER = dense ? 0.022 : 0.012;
  const DAMP = dense ? 0.78 : 0.85;
  const MAX_V = dense ? 12 : 24;
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i]!;
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j]!;
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 0.01) {
        dx = (i - j) * 0.1 + 0.1;
        dy = 0.1;
        d2 = dx * dx + dy * dy;
      }
      const f = REPEL / d2;
      const d = Math.sqrt(d2);
      a.vx += (dx / d) * f;
      a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f;
      b.vy -= (dy / d) * f;
    }
  }
  for (const e of edges) {
    const a = nodes[e.a]!;
    const b = nodes[e.b]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const f = SPRING * Math.min(e.w, 4);
    a.vx += dx * f;
    a.vy += dy * f;
    b.vx -= dx * f;
    b.vy -= dy * f;
  }
  let ke = 0;
  for (const n of nodes) {
    n.vx = (n.vx - n.x * CENTER) * DAMP;
    n.vy = (n.vy - n.y * CENTER) * DAMP;
    n.vx = Math.max(-MAX_V, Math.min(MAX_V, n.vx));
    n.vy = Math.max(-MAX_V, Math.min(MAX_V, n.vy));
    n.x += n.vx;
    n.y += n.vy;
    ke += n.vx * n.vx + n.vy * n.vy;
  }
  return ke;
}

const radius = (n: Node) => 6 + Math.min(n.deg, 8) * 1.6;
const compactLabels = (nodeCount: number) => Math.min(nodeCount, nodeCount <= 16 ? nodeCount : 8);
const roomyLabels = (nodeCount: number) => Math.min(nodeCount, nodeCount <= 36 ? nodeCount : 28);

export function createGraph(store: Store): {
  el: HTMLElement;
  show: () => void;
  destroy: () => void;
} {
  const el = document.createElement("div");
  el.className = "graph-panel";
  const hint = document.createElement("p");
  hint.className = "graph-hint";
  hint.textContent = "Linked by shared tags and ingredients · tap a node for details.";
  const controls = document.createElement("div");
  controls.className = "graph-controls";
  controls.setAttribute("aria-label", "Graph zoom");
  const zoomOut = iconButton("Zoom out", "minus", "graph-control");
  const resetZoom = iconButton("Reset graph view", "reset", "graph-control");
  const zoomIn = iconButton("Zoom in", "plus", "graph-control");
  controls.append(zoomOut, resetZoom, zoomIn);
  const topbar = document.createElement("div");
  topbar.className = "graph-topbar";
  topbar.append(hint, controls);
  const canvas = document.createElement("canvas");
  canvas.className = "graph-canvas";
  const details = document.createElement("div");
  details.className = "graph-details";
  details.setAttribute("aria-live", "polite");
  details.hidden = true;
  const empty = document.createElement("p");
  empty.className = "empty-state";
  empty.textContent = "Save at least two recipes to see connections.";
  el.append(topbar, details, canvas, empty);

  const ctx = canvas.getContext("2d")!;
  let nodes: Node[] = [];
  let allEdges: Edge[] = [];
  let visibleEdges: Edge[] = [];
  let labeledIds = new Set<string>();
  let raf = 0;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let cssW = 0;
  let cssH = 0;
  let selectedId: string | null = null;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function css(name: string) {
    return getComputedStyle(el).getPropertyValue(name).trim() || "#888";
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    cssW = canvas.clientWidth;
    cssH = canvas.clientHeight;
    if (!cssW || !cssH) return;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function isCompact() {
    return cssW < 520;
  }

  function prepareGraph() {
    const maxPerNode = isCompact() ? 2 : 5;
    visibleEdges = selectVisibleEdges(allEdges, nodes.length, maxPerNode);

    const labelCount = isCompact() ? compactLabels(nodes.length) : roomyLabels(nodes.length);
    labeledIds = new Set(
      [...nodes]
        .sort((a, b) => b.deg - a.deg || a.title.localeCompare(b.title))
        .slice(0, labelCount)
        .map((node) => node.id)
    );
  }

  function fitGraph() {
    if (!nodes.length || !cssW || !cssH) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of nodes) {
      const r = radius(node);
      minX = Math.min(minX, node.x - r);
      minY = Math.min(minY, node.y - r);
      maxX = Math.max(maxX, node.x + r);
      maxY = Math.max(maxY, node.y + r);
    }

    const graphW = Math.max(1, maxX - minX);
    const graphH = Math.max(1, maxY - minY);
    const pad = isCompact() ? 36 : 56;
    const fit = Math.min((cssW - pad * 2) / graphW, (cssH - pad * 2) / graphH);
    zoom = Math.max(isCompact() ? 0.18 : 0.35, Math.min(1.4, fit));
    panX = -((minX + maxX) / 2) * zoom;
    panY = -((minY + maxY) / 2) * zoom;
  }

  function setZoom(next: number) {
    zoom = Math.max(0.2, Math.min(3.5, next));
    if (!raf) draw();
  }

  function resetView() {
    fitGraph();
    if (!raf) draw();
  }

  function selectedRecipe(): Recipe | undefined {
    if (!selectedId) return undefined;
    return store.get().library.find((recipe) => recipe.id === selectedId);
  }

  function relatedRecipes(node: Node): string[] {
    const index = nodes.findIndex((candidate) => candidate.id === node.id);
    if (index < 0) return [];

    return allEdges
      .filter((edge) => edge.a === index || edge.b === index)
      .sort((a, b) => b.w - a.w || a.a - b.a || a.b - b.b)
      .slice(0, 4)
      .map((edge) => nodes[edge.a === index ? edge.b : edge.a]?.title)
      .filter((title): title is string => Boolean(title));
  }

  function appendDataLine(parent: HTMLElement, label: string, values: string[]): void {
    if (!values.length) return;
    const row = document.createElement("p");
    row.className = "graph-detail-line";
    const key = document.createElement("strong");
    key.textContent = `${label}: `;
    row.append(key, values.join(", "));
    parent.append(row);
  }

  function renderDetails(): void {
    details.replaceChildren();
    const recipe = selectedRecipe();
    const node = selectedId ? nodes.find((candidate) => candidate.id === selectedId) : undefined;
    details.hidden = !recipe || !node;
    if (!recipe || !node) return;

    const body = document.createElement("div");
    body.className = "graph-detail-body";
    const title = document.createElement("h3");
    title.className = "graph-detail-title";
    title.textContent = recipe.title || "Untitled";
    const summary = document.createElement("p");
    summary.className = "graph-detail-summary";
    summary.textContent = `${node.deg} shared match${node.deg === 1 ? "" : "es"} across ${relatedRecipes(node).length} strong link${relatedRecipes(node).length === 1 ? "" : "s"}.`;
    body.append(title, summary);
    appendDataLine(body, "Tags", [...node.tags].slice(0, 8));
    appendDataLine(body, "Ingredients", [...node.ings].slice(0, 10));
    appendDataLine(body, "Strong links", relatedRecipes(node));

    const open = labeledButton("Open", "pen", "btn btn-secondary graph-detail-open");
    open.addEventListener("click", () => {
      const current = selectedRecipe();
      if (current) store.update((state) => loadRecipe(state, current));
    });
    details.append(body, open);
  }

  function draw() {
    const line = css("--teal-geo");
    const crocus = css("--crocus");
    const ink = css("--ink");
    const surface = css("--surface");
    const terracotta = css("--terracotta");
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.save();
    ctx.translate(cssW / 2 + panX, cssH / 2 + panY);
    ctx.scale(zoom, zoom);
    for (const e of visibleEdges) {
      const a = nodes[e.a]!;
      const b = nodes[e.b]!;
      const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      grad.addColorStop(0, crocus);
      grad.addColorStop(1, line);
      ctx.strokeStyle = grad;
      ctx.globalAlpha = isCompact() ? 0.24 : 0.48;
      ctx.lineWidth = Math.min(e.w, isCompact() ? 2.5 : 4) / zoom;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const labelSize = isCompact() ? 11 : 12;
    const labelWidth = isCompact() ? 90 : 140;
    ctx.font = `${labelSize / zoom}px "Source Sans 3", system-ui, sans-serif`;
    ctx.textAlign = "center";
    for (const n of nodes) {
      const r = radius(n);
      const selected = n.id === selectedId;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = line;
      ctx.fill();
      ctx.lineWidth = (selected ? 3 : 1.5) / zoom;
      ctx.strokeStyle = selected ? terracotta : crocus;
      ctx.stroke();
      if (!selected && !labeledIds.has(n.id) && zoom < (isCompact() ? 1.05 : 0.8)) continue;
      ctx.fillStyle = ink;
      ctx.shadowColor = surface;
      ctx.shadowBlur = 4;
      ctx.fillText(n.title, n.x, n.y + r + labelSize / zoom, labelWidth / zoom);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  function loop() {
    const ke = step(nodes, visibleEdges, isCompact());
    draw();
    if (ke > 0.5) raf = requestAnimationFrame(loop);
    else raf = 0;
  }

  function restart() {
    cancelAnimationFrame(raf);
    raf = 0;
    const hasGraph = nodes.length >= 2;
    canvas.hidden = !hasGraph;
    empty.hidden = hasGraph;
    hint.hidden = !hasGraph;
    if (!hasGraph) return;
    prepareGraph();
    renderDetails();

    const dense = nodes.length > 30 || visibleEdges.length > 120;
    const settleSteps = dense || reduced ? 360 : 160;
    for (let i = 0; i < settleSteps; i++) step(nodes, visibleEdges, dense || isCompact());
    fitGraph();
    draw();

    if (!reduced && !dense) {
      raf = requestAnimationFrame(loop);
    } else {
      raf = 0;
    }
  }

  function rebuild() {
    const g = buildGraph(store.get().library);
    nodes = g.nodes;
    allEdges = g.edges;
    if (selectedId && !nodes.some((node) => node.id === selectedId)) selectedId = null;
  }

  zoomOut.addEventListener("click", () => setZoom(zoom / 1.25));
  zoomIn.addEventListener("click", () => setZoom(zoom * 1.25));
  resetZoom.addEventListener("click", resetView);

  // pointer: drag to pan, click (no drag) to inspect the recipe under the cursor
  let down = false;
  let moved = 0;
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener("pointerdown", (e) => {
    down = true;
    moved = 0;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    moved += Math.abs(dx) + Math.abs(dy);
    panX += dx;
    panY += dy;
    lastX = e.clientX;
    lastY = e.clientY;
    if (!raf) draw();
  });
  canvas.addEventListener("pointerup", (e) => {
    down = false;
    if (moved > 6) return;
    const rect = canvas.getBoundingClientRect();
    const wx = (e.clientX - rect.left - cssW / 2 - panX) / zoom;
    const wy = (e.clientY - rect.top - cssH / 2 - panY) / zoom;
    const hitPad = Math.max(4, 12 / zoom);
    const hit = nodes.find((n) => (n.x - wx) ** 2 + (n.y - wy) ** 2 <= (radius(n) + hitPad) ** 2);
    if (hit) {
      selectedId = hit.id;
      renderDetails();
    } else {
      selectedId = null;
      renderDetails();
    }
    draw();
  });
  canvas.addEventListener("pointercancel", () => {
    down = false;
  });
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setZoom(zoom * factor);
    },
    { passive: false }
  );

  const resizeObserver = new ResizeObserver(() => {
    if (el.hidden) return;
    resize();
    restart();
  });
  resizeObserver.observe(canvas);

  const unsub = store.select(
    (s) => s.library,
    () => {
      rebuild();
      if (!el.hidden) restart();
    }
  );

  function show() {
    rebuild();
    requestAnimationFrame(() => {
      resize();
      restart();
    });
  }

  rebuild();

  return {
    el,
    show,
    destroy: () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      unsub();
    }
  };
}
