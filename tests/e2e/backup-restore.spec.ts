import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

async function fillTitle(page: Page, title: string): Promise<void> {
  await page.getByLabel("Title").fill(title);
}

async function save(page: Page): Promise<void> {
  await page.locator(".header-actions").getByRole("button", { name: "Save" }).click();
  await page.getByRole("menuitem", { name: "Library" }).click();
  await page.waitForTimeout(600);
}

const openLibrary = (page: Page) =>
  page.locator(".header-pill").getByRole("button", { name: "Library" }).click();

// Export a v2 backup, then re-import it through the review screen and Merge.
test("backup export round-trips through the import review screen", async ({ page }) => {
  await page.goto("/");

  await fillTitle(page, "Backup Soup");
  await save(page);

  await openLibrary(page);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator(".library-toolbar").getByRole("button", { name: "Export" }).click()
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
