const RESERVED = new Set(["true", "false", "yes", "no", "null", "~", "on", "off"]);

const PLAIN_UNSAFE_START = /^[!&*\-?{}[\],#|>@\\"'%]/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const NUMBER_RE = /^-?\d+(\.\d+)?$/;

function needsQuotes(s: string): boolean {
  if (!s || s !== s.trim()) return true;
  if (PLAIN_UNSAFE_START.test(s)) return true;
  if (s.includes(": ") || s.includes(" #")) return true;
  // eslint-disable-next-line no-control-regex -- YAML control chars must be quoted
  if (/[\u0000-\u001f\u007f]/.test(s)) return true;
  if (RESERVED.has(s.toLowerCase())) return true;
  if (NUMBER_RE.test(s)) return true;
  if (DATE_RE.test(s)) return true;
  if (DATE_TIME_RE.test(s)) return true;
  return false;
}

export function yamlString(value: string): string {
  if (!needsQuotes(value)) return value;
  return (
    '"' +
    value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t") +
    '"'
  );
}

export function yamlScalar(value: string | number): string {
  if (typeof value === "number") return String(value);
  return yamlString(value);
}

export function yamlList(key: string, items: string[], indent = 0): string[] {
  const pad = " ".repeat(indent);
  const nonEmpty = items.map((i) => i.trim()).filter(Boolean);
  if (!nonEmpty.length) return [];
  const lines = [`${pad}${key}:`];
  for (const item of nonEmpty) {
    lines.push(`${pad}  - ${yamlString(item)}`);
  }
  return lines;
}

export function yamlBlock(lines: string[]): string {
  return lines.join("\n");
}

export function isNonEmpty(value: string | undefined): value is string {
  return Boolean(value?.trim());
}

export function isNonEmptyList(values: string[] | undefined): values is string[] {
  return Boolean(values?.some((v) => v.trim()));
}

export function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, "-").replace(/^#/, "");
}
