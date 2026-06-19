import { loadRecipe } from "../../store/actions";
import type { AppState } from "../../store/actions";
import type { Recipe } from "../../model/types";
import type { createStore } from "../../store/store";

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

function buildGraph(recipes: Recipe[]): { nodes: Node[]; edges: Edge[] } {
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

function step(nodes: Node[], edges: Edge[]): number {
  const REPEL = 7000;
  const SPRING = 0.02;
  const CENTER = 0.012;
  const DAMP = 0.85;
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
    n.x += n.vx;
    n.y += n.vy;
    ke += n.vx * n.vx + n.vy * n.vy;
  }
  return ke;
}

const radius = (n: Node) => 6 + Math.min(n.deg, 8) * 1.6;

export function createGraph(store: Store): {
  el: HTMLElement;
  show: () => void;
  destroy: () => void;
} {
  const el = document.createElement("div");
  el.className = "graph-panel";
  const hint = document.createElement("p");
  hint.className = "graph-hint";
  hint.textContent = "Linked by shared tags and ingredients · tap a node to open.";
  const canvas = document.createElement("canvas");
  canvas.className = "graph-canvas";
  const empty = document.createElement("p");
  empty.className = "empty-state";
  empty.textContent = "Save at least two recipes to see connections.";
  el.append(hint, canvas, empty);

  const ctx = canvas.getContext("2d")!;
  let nodes: Node[] = [];
  let edges: Edge[] = [];
  let raf = 0;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let cssW = 0;
  let cssH = 0;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function css(name: string) {
    return getComputedStyle(el).getPropertyValue(name).trim() || "#888";
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    cssW = canvas.clientWidth;
    cssH = canvas.clientHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw() {
    const line = css("--teal-geo");
    const crocus = css("--crocus");
    const ink = css("--ink");
    const surface = css("--surface");
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.save();
    ctx.translate(cssW / 2 + panX, cssH / 2 + panY);
    ctx.scale(zoom, zoom);
    for (const e of edges) {
      const a = nodes[e.a]!;
      const b = nodes[e.b]!;
      const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      grad.addColorStop(0, crocus);
      grad.addColorStop(1, line);
      ctx.strokeStyle = grad;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = Math.min(e.w, 4) / zoom;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.font = `${12 / zoom}px "Source Sans 3", system-ui, sans-serif`;
    ctx.textAlign = "center";
    for (const n of nodes) {
      const r = radius(n);
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = line;
      ctx.fill();
      ctx.lineWidth = 1.5 / zoom;
      ctx.strokeStyle = crocus;
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.shadowColor = surface;
      ctx.shadowBlur = 4;
      ctx.fillText(n.title, n.x, n.y + r + 12 / zoom);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  function loop() {
    const ke = step(nodes, edges);
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
    if (reduced) {
      for (let i = 0; i < 400; i++) step(nodes, edges);
      draw();
    } else {
      raf = requestAnimationFrame(loop);
    }
  }

  function rebuild() {
    const g = buildGraph(store.get().library);
    nodes = g.nodes;
    edges = g.edges;
  }

  // pointer: drag to pan, click (no drag) to open the recipe under the cursor
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
    const hit = nodes.find((n) => (n.x - wx) ** 2 + (n.y - wy) ** 2 <= (radius(n) + 4) ** 2);
    if (hit) {
      const recipe = store.get().library.find((r) => r.id === hit.id);
      if (recipe) store.update((s) => loadRecipe(s, recipe));
    }
  });
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      zoom = Math.max(0.3, Math.min(3, zoom * factor));
      if (!raf) draw();
    },
    { passive: false }
  );

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
      unsub();
    }
  };
}
