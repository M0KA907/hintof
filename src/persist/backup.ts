import type { Recipe } from "../model/types";
import { normalizeRecipe } from "./migrate";
import type { StoredDraft } from "./repo/types";

export const BACKUP_VERSION = 2;
export const RECIPE_SCHEMA_VERSION = 2;

export interface HintofBackupV2 {
  format: "hintof-backup";
  backupVersion: 2;
  recipeSchemaVersion: number;
  exportedAt: string;
  recipes: Recipe[];
  draft: StoredDraft | null;
  checksum: string;
}

type UnsignedBackup = Omit<HintofBackupV2, "checksum">;

// Deterministic JSON: object keys sorted recursively, array order preserved.
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const entries = Object.keys(obj)
    .sort()
    .filter((k) => obj[k] !== undefined) // match JSON.stringify: drop undefined-valued keys
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return `{${entries.join(",")}}`;
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createBackup(
  recipes: Recipe[],
  draft: StoredDraft | null,
  exportedAt: string
): Promise<HintofBackupV2> {
  const unsigned: UnsignedBackup = {
    format: "hintof-backup",
    backupVersion: BACKUP_VERSION,
    recipeSchemaVersion: RECIPE_SCHEMA_VERSION,
    exportedAt,
    recipes,
    draft
  };
  const checksum = `sha256-${await sha256Hex(canonicalJson(unsigned))}`;
  return { ...unsigned, checksum };
}

// Detects accidental corruption only — NOT a tamper-proof signature.
export async function verifyChecksum(backup: HintofBackupV2): Promise<boolean> {
  const { checksum, ...unsigned } = backup;
  const expected = `sha256-${await sha256Hex(canonicalJson(unsigned))}`;
  return checksum === expected;
}

export interface RestoreEntry {
  id: string;
  title: string;
  updated: string;
}
export interface RestoreConflict extends RestoreEntry {
  existingUpdated: string;
}
export interface InvalidRestoreEntry {
  index: number;
  reason: string;
}
export interface RestorePreview {
  newRecipes: RestoreEntry[];
  updatedRecipes: RestoreEntry[];
  exactDuplicates: RestoreEntry[];
  conflicts: RestoreConflict[];
  invalidEntries: InvalidRestoreEntry[];
  draftAction: "add" | "replace" | "conflict" | "none";
  checksumValid: boolean | null;
}

function entry(r: Recipe): RestoreEntry {
  return { id: r.id, title: r.title || "Untitled", updated: r.updated };
}

/**
 * Parse + classify a backup against the current library WITHOUT writing anything.
 * `checksumValid` is null when caller hasn't verified (sync classify); pass the
 * verifyChecksum() result through if known.
 */
export function classifyRestore(
  backup: { recipes?: unknown; draft?: unknown },
  existing: Recipe[],
  existingHasDraft: boolean,
  checksumValid: boolean | null = null
): RestorePreview {
  const byId = new Map(existing.map((r) => [r.id, r]));
  const preview: RestorePreview = {
    newRecipes: [],
    updatedRecipes: [],
    exactDuplicates: [],
    conflicts: [],
    invalidEntries: [],
    draftAction: "none",
    checksumValid
  };

  const incoming = Array.isArray(backup.recipes) ? backup.recipes : [];
  incoming.forEach((raw, index) => {
    const r = normalizeRecipe(raw);
    if (!r) {
      preview.invalidEntries.push({ index, reason: "Invalid or unsupported recipe schema." });
      return;
    }
    const current = byId.get(r.id);
    if (!current) {
      preview.newRecipes.push(entry(r));
    } else if (canonicalJson(current) === canonicalJson(r)) {
      preview.exactDuplicates.push(entry(r));
    } else if (r.updated.localeCompare(current.updated) > 0) {
      preview.updatedRecipes.push(entry(r));
    } else {
      preview.conflicts.push({ ...entry(r), existingUpdated: current.updated });
    }
  });

  if (backup.draft) preview.draftAction = existingHasDraft ? "replace" : "add";
  return preview;
}

export interface RestoreApplyResult {
  recipes: Recipe[];
  added: number;
  updated: number;
  skipped: number;
  invalid: number;
}

/**
 * Compute the recipe list a restore would produce — pure, no I/O.
 * `replace` returns only the (valid) incoming recipes. `merge` keeps existing,
 * adds new ids, overwrites only when the incoming copy is strictly newer, and
 * skips exact duplicates and older/divergent ids (the conflicts the preview
 * flags) so a merge never silently downgrades a saved recipe.
 */
export function applyRestore(
  backup: { recipes?: unknown },
  existing: Recipe[],
  mode: "merge" | "replace"
): RestoreApplyResult {
  const valid: Recipe[] = [];
  let invalid = 0;
  for (const raw of Array.isArray(backup.recipes) ? backup.recipes : []) {
    const r = normalizeRecipe(raw);
    if (r) valid.push(r);
    else invalid += 1;
  }

  if (mode === "replace") {
    return { recipes: valid, added: valid.length, updated: 0, skipped: 0, invalid };
  }

  const byId = new Map(existing.map((r) => [r.id, r]));
  let added = 0;
  let updated = 0;
  let skipped = 0;
  for (const r of valid) {
    const current = byId.get(r.id);
    if (!current) {
      byId.set(r.id, r);
      added += 1;
    } else if (canonicalJson(current) === canonicalJson(r)) {
      skipped += 1;
    } else if (r.updated.localeCompare(current.updated) > 0) {
      byId.set(r.id, r);
      updated += 1;
    } else {
      skipped += 1; // older or divergent incoming — keep the saved copy
    }
  }
  return { recipes: [...byId.values()], added, updated, skipped, invalid };
}
