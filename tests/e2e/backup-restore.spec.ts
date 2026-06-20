import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Recipe } from "../../src/model/types";

async function fillTitle(page: Page, title: string): Promise<void> {
  await page.getByLabel("Title").fill(title);
}

async function save(page: Page): Promise<void> {
  await page.locator(".header-actions").getByRole("button", { name: "Save" }).click();
  await page.getByRole("menuitem", { name: "Library" }).click();
  await page.waitForTimeout(600);
}

const openLibrary = (page: Page) => page.getByRole("button", { name: "Library" }).last().click();

// Export a v2 backup, then re-import it through the review screen and Merge.
test("backup export round-trips through the import review screen", async ({ page }) => {
  await page.goto("/");

  await fillTitle(page, "Backup Soup");
  await save(page);

  await openLibrary(page);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator(".library-toolbar").getByRole("button", { name: "Export library" }).click()
  ]);
  const backup = readFileSync(await download.path());
  // exported file is a checksummed v2 backup
  const parsed = JSON.parse(backup.toString());
  expect(parsed.format).toBe("hintof-backup");
  expect(parsed.backupVersion).toBe(2);
  expect(String(parsed.checksum)).toMatch(/^sha256-/);

  // add a second recipe so a merge has something to combine with
  await page.getByRole("button", { name: "New" }).first().click();
  await fillTitle(page, "Fresh Stew");
  await save(page);

  await openLibrary(page);
  await page
    .locator(".library-toolbar")
    .getByRole("button", { name: "Import" })
    .click()
    .catch(() => {});
  await page.setInputFiles('input[type="file"]', {
    name: "hintof-backup.json",
    mimeType: "application/json",
    buffer: backup
  });

  // review screen appears (no native confirm), then Merge
  const dialog = page.getByRole("dialog", { name: "Review import" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Merge" }).click();
  await expect(dialog).toBeHidden();

  await openLibrary(page);
  const titles = page.locator(".library-card-title");
  await expect(titles.filter({ hasText: "Backup Soup" })).toBeVisible();
  await expect(titles.filter({ hasText: "Fresh Stew" })).toBeVisible();
});

test("replacement import keeps library controls visible with a large backup", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await openLibrary(page);

  const backup = makeBackup(50);
  await page.setInputFiles('input[type="file"]', {
    name: "hintof-large-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup))
  });

  const dialog = page.getByRole("dialog", { name: "Review import" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Replace" }).click();
  await expect(dialog).toBeHidden();

  const toolbar = page.locator(".library-toolbar");
  await expect(toolbar.getByRole("button", { name: "Export library" })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "Import" })).toBeVisible();

  const toolbarBox = await toolbar.boundingBox();
  const searchBox = await page.locator(".library-search").boundingBox();
  expect(toolbarBox).not.toBeNull();
  expect(searchBox).not.toBeNull();
  expect(searchBox!.y).toBeGreaterThanOrEqual(toolbarBox!.y + toolbarBox!.height);
});

function makeBackup(count: number): { recipes: Recipe[]; draft: null } {
  const recipes = Array.from({ length: count }, (_, i): Recipe => {
    const n = String(i + 1).padStart(12, "0");
    return {
      id: `00000000-0000-4000-8000-${n}`,
      schemaVersion: 2,
      title: `Imported Recipe ${i + 1}`,
      tags: ["imported"],
      cuisine: i % 2 ? "Italian" : "American",
      ingredientGroups: [{ ingredients: [{ item: "salt" }] }],
      stepSections: [{ steps: ["Season to taste."] }],
      created: "2026-06-20",
      updated: "2026-06-20",
      options: {
        wikiLinks: { ingredients: false, cuisine: false },
        callouts: false,
        fractionStyle: "unicode"
      }
    };
  });
  return { recipes, draft: null };
}
