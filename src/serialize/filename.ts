const RESERVED = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  ...Array.from({ length: 9 }, (_, i) => `COM${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `LPT${i + 1}`)
]);

export function sanitizeTitle(title: string): string {
  let s = title
    .replace(/[/\\:*?"<>|#^[\]|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/, "");

  if (!s) s = "Untitled";

  if (RESERVED.has(s.toUpperCase())) s = `${s}_`;

  const encoder = new TextEncoder();
  let bytes = encoder.encode(s);
  if (bytes.length > 200) {
    while (bytes.length > 200 && s.length) {
      s = s.slice(0, -1);
      bytes = encoder.encode(s);
    }
    s = s.trimEnd() || "Untitled";
  }

  return s;
}

export function recipeFilename(created: string, title: string, collision = 0): string {
  const base = `${created} ${sanitizeTitle(title)}`;
  const suffix = collision > 1 ? ` (${collision})` : "";
  const name = `${base}${suffix}.md`;
  const encoder = new TextEncoder();
  if (encoder.encode(name).length <= 255) return name;

  const maxTitleBytes =
    255 - encoder.encode(`${created} .md`).length - encoder.encode(suffix).length;
  let safe = sanitizeTitle(title);
  while (encoder.encode(safe).length > maxTitleBytes && safe.length) {
    safe = safe.slice(0, -1).trimEnd();
  }
  if (!safe) safe = "Untitled";
  return `${created} ${safe}${suffix}.md`;
}

export function nextCollisionIndex(existing: string[], candidate: string): number {
  const stem = candidate.replace(/\.md$/i, "");
  const re = new RegExp(`^${escapeRe(stem)}(?: \\((\\d+)\\))?\\.md$`, "i");
  let max = 1;
  for (const name of existing) {
    const m = name.match(re);
    if (!m) continue;
    const n = m[1] ? Number(m[1]) : 1;
    if (n >= max) max = n + 1;
  }
  return max;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
