// SSRF-safe URL validator retained for external tooling experiments only.
// The GitHub Pages app does not fetch user-supplied URLs or ship a backend.
//
// This module is pure and synchronous. It performs syntactic checks and
// literal-host / literal-IP classification only.
//
// IMPORTANT (caller responsibility): a hostname that is NOT a literal IP
// (e.g. "example.com") can still resolve via DNS to a blocked address
// (DNS rebinding / internal records). The runtime that actually fetches the
// URL MUST re-resolve the hostname at connect time and re-validate every
// resolved IP with `isBlockedIp`, and must re-validate every redirect target
// (Location header) with `validateImportUrl` / the classifiers below.
// This function alone is NOT sufficient protection against SSRF.

export type UrlGuardResult = { ok: true; url: URL } | { ok: false; reason: string };

const MAX_URL_LENGTH = 2048;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Validate a user-supplied URL for server-side fetching.
 * Never throws; returns a tagged result.
 */
export function validateImportUrl(input: string): UrlGuardResult {
  if (typeof input !== "string") {
    return { ok: false, reason: "URL must be a string" };
  }
  if (input.length > MAX_URL_LENGTH) {
    return { ok: false, reason: "URL exceeds maximum length" };
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "URL could not be parsed" };
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { ok: false, reason: `Protocol not allowed: ${url.protocol}` };
  }

  // Reject embedded credentials (user:pass@host) outright.
  if (url.username !== "" || url.password !== "") {
    return { ok: false, reason: "Userinfo is not allowed in the URL" };
  }

  if (isBlockedHostname(url.hostname)) {
    return { ok: false, reason: "Hostname is blocked" };
  }

  return { ok: true, url };
}

/**
 * Returns true if the hostname must be blocked.
 * Reused for redirect re-validation by the caller.
 *
 * Handles: well-known internal names, and any hostname that is itself a
 * literal IP (IPv4, IPv6, or bracketed IPv6) in a blocked range.
 */
export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();

  if (host === "") return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "metadata.google.internal") return true;

  // Bracketed IPv6 literal, e.g. "[::1]".
  if (host.startsWith("[") && host.endsWith("]")) {
    return isBlockedIp(host.slice(1, -1));
  }

  // Bare literal IP (URL already strips brackets from url.hostname for IPv6,
  // but be defensive for direct callers).
  if (isBlockedIp(host)) return true;

  return false;
}

/**
 * Returns true if the IP literal falls in a blocked range.
 * Handles IPv4, IPv6, and IPv4-mapped IPv6 (::ffff:a.b.c.d).
 * Non-IP strings return false (they are not literal IPs).
 */
export function isBlockedIp(ip: string): boolean {
  const s = ip.trim().toLowerCase();

  // Strip brackets if a bracketed IPv6 literal was passed in directly.
  const bare = s.startsWith("[") && s.endsWith("]") ? s.slice(1, -1) : s;

  if (bare.includes(":")) {
    return isBlockedIpv6(bare);
  }

  const v4 = parseIpv4(bare);
  if (v4 === null) return false;
  return isBlockedIpv4(v4);
}

// --- IPv4 -----------------------------------------------------------------

/**
 * Parse a strict dotted-quad IPv4 address into 4 octets (0-255 each).
 * Returns null if the string is not a canonical dotted-quad.
 * (Deliberately rejects octal/hex/short forms; those are not valid hosts
 * for our purposes and a non-parse simply means "not a literal IPv4".)
 */
function parseIpv4(s: string): [number, number, number, number] | null {
  const parts = s.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n < 0 || n > 255) return null;
    octets.push(n);
  }
  return [octets[0], octets[1], octets[2], octets[3]];
}

function isBlockedIpv4(octets: [number, number, number, number]): boolean {
  const [a, b] = octets;

  // 0.0.0.0/8  "this network"
  if (a === 0) return true;
  // 10.0.0.0/8  private
  if (a === 10) return true;
  // 127.0.0.0/8  loopback
  if (a === 127) return true;
  // 169.254.0.0/16  link-local (includes 169.254.169.254 metadata)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12  private
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16  private
  if (a === 192 && b === 168) return true;
  // 100.64.0.0/10  carrier-grade NAT
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 224.0.0.0/4  multicast (224-239)
  if (a >= 224 && a <= 239) return true;

  return false;
}

// --- IPv6 -----------------------------------------------------------------

/**
 * Block dangerous IPv6 ranges, and unwrap IPv4-mapped addresses to apply the
 * IPv4 rules.
 *
 * ponytail: full IPv6 CIDR math is skipped. We decode just enough to cover
 * the ranges the SSRF spec requires: ::1 (loopback), :: (unspecified),
 * fc00::/7 (unique-local), fe80::/10 (link-local), and ::ffff:a.b.c.d
 * (IPv4-mapped, unwrapped and checked against the IPv4 rules).
 */
function isBlockedIpv6(input: string): boolean {
  // Drop any zone id, e.g. "fe80::1%eth0".
  const addr = input.split("%")[0];

  // IPv4-mapped: ::ffff:a.b.c.d  (also tolerate the deprecated ::a.b.c.d form
  // when a dotted-quad tail is present).
  const dotted = addr.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (dotted) {
    const v4 = parseIpv4(dotted[1]);
    if (v4 !== null) return isBlockedIpv4(v4);
  }

  // Expand "::" and normalize to full 8 hextet groups.
  const groups = expandIpv6(addr);
  if (groups === null) return false; // not a parseable IPv6 literal

  // IPv4-mapped in hex form: ::ffff:a.b.c.d normalizes to ::ffff:XXXX:YYYY.
  // Unwrap the trailing two hextets into an IPv4 address and re-check.
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    const v4: [number, number, number, number] = [
      groups[6] >> 8,
      groups[6] & 0xff,
      groups[7] >> 8,
      groups[7] & 0xff
    ];
    return isBlockedIpv4(v4);
  }

  // Unspecified  ::
  if (groups.every((g) => g === 0)) return true;
  // Loopback  ::1
  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return true;

  const first = groups[0];
  const highByte = first >> 8;
  // fc00::/7  unique-local  (high byte 0xfc or 0xfd)
  if (highByte === 0xfc || highByte === 0xfd) return true;
  // fe80::/10  link-local  (0xfe80 .. 0xfebf -> first 10 bits == fe80>>6)
  if ((first & 0xffc0) === 0xfe80) return true;

  return false;
}

/**
 * Expand an IPv6 string (with optional "::") into 8 numeric hextets.
 * Returns null if it is not a valid-shaped IPv6 literal.
 * A trailing dotted-quad (IPv4-mapped) is collapsed into 2 hextets first.
 */
function expandIpv6(addr: string): number[] | null {
  let work = addr;

  // Convert a trailing IPv4 dotted-quad into two hextets.
  const dotted = work.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (dotted) {
    const v4 = parseIpv4(dotted[1]);
    if (v4 === null) return null;
    const h1 = (v4[0] << 8) | v4[1];
    const h2 = (v4[2] << 8) | v4[3];
    work = work.slice(0, dotted.index) + toHex(h1) + ":" + toHex(h2);
  }

  const doubleColon = work.split("::");
  if (doubleColon.length > 2) return null; // more than one "::" is invalid

  const parseSide = (side: string): number[] | null => {
    if (side === "") return [];
    const out: number[] = [];
    for (const part of side.split(":")) {
      if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
      out.push(parseInt(part, 16));
    }
    return out;
  };

  if (doubleColon.length === 2) {
    const head = parseSide(doubleColon[0]);
    const tail = parseSide(doubleColon[1]);
    if (head === null || tail === null) return null;
    const fill = 8 - head.length - tail.length;
    if (fill < 0) return null;
    return [...head, ...new Array<number>(fill).fill(0), ...tail];
  }

  const all = parseSide(work);
  if (all === null || all.length !== 8) return null;
  return all;
}

function toHex(n: number): string {
  return n.toString(16);
}
