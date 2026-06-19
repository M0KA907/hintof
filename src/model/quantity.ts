import type { Quantity, Rational } from "./types";

const UNICODE_FRAC: Record<string, Rational> = {
  "½": { n: 1, d: 2 },
  "⅓": { n: 1, d: 3 },
  "⅔": { n: 2, d: 3 },
  "¼": { n: 1, d: 4 },
  "¾": { n: 3, d: 4 },
  "⅕": { n: 1, d: 5 },
  "⅖": { n: 2, d: 5 },
  "⅗": { n: 3, d: 5 },
  "⅘": { n: 4, d: 5 },
  "⅙": { n: 1, d: 6 },
  "⅚": { n: 5, d: 6 },
  "⅛": { n: 1, d: 8 },
  "⅜": { n: 3, d: 8 },
  "⅝": { n: 5, d: 8 },
  "⅞": { n: 7, d: 8 }
};

const UNICODE_RENDER: [Rational, string][] = Object.entries(UNICODE_FRAC).map(
  ([glyph, r]) => [r, glyph] as [Rational, string]
);

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

export function reduce(r: Rational): Rational {
  if (r.d === 0) return { n: 0, d: 1 };
  const g = gcd(r.n, r.d);
  let n = r.n / g;
  let d = r.d / g;
  if (d < 0) {
    n = -n;
    d = -d;
  }
  return { n, d };
}

function rationalEq(a: Rational, b: Rational): boolean {
  const ra = reduce(a);
  const rb = reduce(b);
  return ra.n === rb.n && ra.d === rb.d;
}

function fromNumber(n: number): Rational {
  if (!Number.isFinite(n)) return { n: 0, d: 1 };
  const s = String(n);
  const dot = s.indexOf(".");
  if (dot === -1) return reduce({ n: Math.round(n), d: 1 });
  const places = s.length - dot - 1;
  const d = 10 ** places;
  return reduce({ n: Math.round(n * d), d });
}

function parseRationalPart(raw: string): Rational | null {
  const s = raw.trim();
  if (!s) return null;

  for (const [glyph, r] of Object.entries(UNICODE_FRAC)) {
    if (s === glyph) return reduce(r);
  }

  const mixedUnicode = s.match(/^(\d+)([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])$/);
  if (mixedUnicode) {
    const whole = Number(mixedUnicode[1]);
    const frac = UNICODE_FRAC[mixedUnicode[2]!];
    if (frac) return reduce({ n: whole * frac.d + frac.n, d: frac.d });
  }

  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const n = Number(mixed[2]);
    const d = Number(mixed[3]);
    if (d === 0) return null;
    return reduce({ n: whole * d + n, d });
  }

  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    const d = Number(frac[2]);
    if (d === 0) return null;
    return reduce({ n: Number(frac[1]), d });
  }

  if (/^-?\d*\.?\d+$/.test(s)) return fromNumber(Number(s));

  return null;
}

export function parseQuantity(input: string): Quantity | null {
  const s = input.trim();
  if (!s) return null;

  const range = s.match(/^(.+?)\s*[-–]\s*(.+)$/);
  if (range) {
    const min = parseRationalPart(range[1]!);
    const max = parseRationalPart(range[2]!);
    if (min && max) return { kind: "range", min, max };
    return null;
  }

  const single = parseRationalPart(s);
  return single ? { kind: "single", value: single } : null;
}

export function scaleRational(r: Rational, factor: number): Rational {
  if (!Number.isFinite(factor)) return { n: 0, d: 1 };
  return reduce({ n: Math.round(r.n * factor), d: r.d });
}

export function scaleQuantity(qty: Quantity, factor: number): Quantity {
  if (qty.kind === "single") {
    return { kind: "single", value: scaleRational(qty.value, factor) };
  }
  return {
    kind: "range",
    min: scaleRational(qty.min, factor),
    max: scaleRational(qty.max, factor)
  };
}

export function servingsFactor(base: number | undefined, target: number): number | null {
  if (!base || base <= 0 || target <= 0) return null;
  return target / base;
}

function renderRational(r: Rational, style: "unicode" | "ascii"): string {
  const reduced = reduce(r);
  if (reduced.d === 1) return String(reduced.n);

  const whole = Math.trunc(reduced.n / reduced.d);
  const rem = Math.abs(reduced.n % reduced.d);
  const sign = reduced.n < 0 ? "-" : "";
  const frac = reduce({ n: rem, d: reduced.d });

  if (style === "unicode") {
    for (const [ur, glyph] of UNICODE_RENDER) {
      if (rationalEq(frac, ur)) {
        if (whole) return `${sign}${Math.abs(whole)}${glyph}`;
        return `${sign}${glyph}`;
      }
    }
  }

  if (whole) return `${sign}${Math.abs(whole)} ${frac.n}/${frac.d}`;
  return `${sign}${frac.n}/${frac.d}`;
}

export function renderQuantity(qty: Quantity, style: "unicode" | "ascii"): string {
  if (qty.kind === "single") return renderRational(qty.value, style);
  return `${renderRational(qty.min, style)}–${renderRational(qty.max, style)}`;
}
