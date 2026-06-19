// Minimal, safe Markdown → DOM renderer for the live preview.
// Builds nodes with createElement/textContent only — never innerHTML with note content.
// Covers what recipeToNote emits: frontmatter, headings, lists, callouts, wiki-links, emphasis.

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*|_[^_]+_)|(\[\[[^\]]+\]\])/g;

function inline(text: string, parent: HTMLElement): void {
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text))) {
    if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
    const tok = m[0];
    if (m[1]) {
      const c = document.createElement("code");
      c.textContent = tok.slice(1, -1);
      parent.append(c);
    } else if (m[2]) {
      const b = document.createElement("strong");
      b.textContent = tok.slice(2, -2);
      parent.append(b);
    } else if (m[3]) {
      const i = document.createElement("em");
      i.textContent = tok.slice(1, -1);
      parent.append(i);
    } else if (m[4]) {
      const inner = tok.slice(2, -2);
      const s = document.createElement("span");
      s.className = "wikilink";
      s.textContent = inner.includes("|") ? inner.slice(inner.indexOf("|") + 1) : inner;
      parent.append(s);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
}

function renderFrontmatter(props: string[]): HTMLElement {
  const box = document.createElement("div");
  box.className = "note-props";
  for (const raw of props) {
    // continuation / YAML list item → fold into the previous value
    if (/^(\s+|-\s)/.test(raw)) {
      const val = box.lastElementChild?.querySelector<HTMLElement>(".note-prop-val");
      if (val) {
        const piece = raw
          .replace(/^\s*-\s*/, "")
          .replace(/^\s+/, "")
          .replace(/^["']|["']$/g, "");
        val.textContent = val.textContent ? `${val.textContent}, ${piece}` : piece;
      }
      continue;
    }
    const idx = raw.indexOf(":");
    if (idx < 0) continue;
    const row = document.createElement("div");
    row.className = "note-prop";
    const k = document.createElement("span");
    k.className = "note-prop-key";
    k.textContent = raw.slice(0, idx).trim();
    const v = document.createElement("span");
    v.className = "note-prop-val";
    v.textContent = raw
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    row.append(k, v);
    box.append(row);
  }
  return box;
}

function renderQuote(lines: string[]): HTMLElement {
  const bq = document.createElement("blockquote");
  let body = lines;
  const callout = lines[0]?.match(/^\[!(\w+)\]\s*(.*)$/);
  if (callout) {
    bq.className = `callout callout-${callout[1]!.toLowerCase()}`;
    const title = document.createElement("p");
    title.className = "callout-title";
    title.textContent = callout[2] || callout[1]!;
    bq.append(title);
    body = lines.slice(1);
  }
  if (body.some((l) => l.trim())) {
    const p = document.createElement("p");
    inline(body.join(" ").trim(), p);
    bq.append(p);
  }
  return bq;
}

const BLOCK_START = /^(#{1,6}\s|>|[-*]\s|\d+\.\s|-{3,}$|\*{3,}$)/;

export function renderMarkdown(md: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const lines = md.split("\n");
  let i = 0;

  if (lines[0] === "---") {
    const props: string[] = [];
    i = 1;
    while (i < lines.length && lines[i] !== "---") props.push(lines[i++]!);
    i++; // closing ---
    frag.append(renderFrontmatter(props));
  }

  for (; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.trim()) continue;

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const h = document.createElement(`h${heading[1]!.length}`);
      inline(heading[2]!, h);
      frag.append(h);
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      frag.append(document.createElement("hr"));
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i]!))
        buf.push(lines[i++]!.replace(/^>\s?/, ""));
      i--;
      frag.append(renderQuote(buf));
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const ul = document.createElement("ul");
      while (i < lines.length && /^[-*]\s+/.test(lines[i]!)) {
        const li = document.createElement("li");
        inline(lines[i++]!.replace(/^[-*]\s+/, ""), li);
        ul.append(li);
      }
      i--;
      frag.append(ul);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const ol = document.createElement("ol");
      while (i < lines.length && /^\d+\.\s+/.test(lines[i]!)) {
        const li = document.createElement("li");
        inline(lines[i++]!.replace(/^\d+\.\s+/, ""), li);
        ol.append(li);
      }
      i--;
      frag.append(ol);
      continue;
    }

    const buf = [line];
    while (i + 1 < lines.length && lines[i + 1]!.trim() && !BLOCK_START.test(lines[i + 1]!)) {
      buf.push(lines[++i]!);
    }
    const p = document.createElement("p");
    inline(buf.join(" "), p);
    frag.append(p);
  }

  return frag;
}
