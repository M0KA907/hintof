import { expect, test, type Page } from "@playwright/test";

const basics = (page: Page) =>
  page
    .locator("details.form-section")
    .filter({ has: page.getByText("Recipe basics", { exact: true }) });

async function openBasics(page: Page): Promise<void> {
  const section = basics(page);
  if (!(await section.evaluate((d) => (d as HTMLDetailsElement).open))) {
    await section.locator("summary").click();
  }
  await expect(page.getByLabel("Title")).toBeVisible();
}

async function fillTitle(page: Page, title: string): Promise<void> {
  await openBasics(page);
  await page.getByLabel("Title").fill(title);
}

async function save(page: Page): Promise<void> {
  // Save is now a dropdown pill: open it, then choose "Library".
  await page.locator(".header-actions").getByRole("button", { name: "Save" }).click();
  await page.getByRole("menuitem", { name: "Library" }).click();
  // autosave debounces the draft 500ms; let it flush so reload restores deterministically
  await page.waitForTimeout(600);
}
const pressNew = (page: Page) =>
  page.locator(".header-actions").getByRole("button", { name: "New" }).click();
const openLibrary = (page: Page) =>
  page.locator(".header-pill").getByRole("button", { name: "Library" }).click();

test("creates and persists two independent recipes", async ({ page }) => {
  await page.goto("/");

  await fillTitle(page, "Recipe A");
  await save(page);
  await expect(page.getByText("Saved to library.")).toBeVisible();

  await pressNew(page);
  await expect(page.getByLabel("Title")).toHaveValue("");

  await fillTitle(page, "Recipe B");
  await save(page);
  await expect(page.getByText("Saved to library.")).toBeVisible();

  await page.reload();
  await openLibrary(page);

  const cardTitles = page.locator(".library-card-title");
  await expect(cardTitles.filter({ hasText: "Recipe A" })).toBeVisible();
  await expect(cardTitles.filter({ hasText: "Recipe B" })).toBeVisible();

  await page
    .locator(".library-card")
    .filter({ hasText: "Recipe A" })
    .getByRole("button", { name: "Open" })
    .click();
  await expect(page.getByLabel("Title")).toHaveValue("Recipe A");

  await openLibrary(page);
  await page
    .locator(".library-card")
    .filter({ hasText: "Recipe B" })
    .getByRole("button", { name: "Open" })
    .click();
  await expect(page.getByLabel("Title")).toHaveValue("Recipe B");
});

test("saving twice without New updates one recipe instead of duplicating", async ({ page }) => {
  await page.goto("/");

  await fillTitle(page, "Solo Recipe");
  await save(page);
  await expect(page.getByText("Saved to library.")).toBeVisible();

  await page.getByLabel("Title").fill("Solo Recipe Edited");
  await save(page);
  await expect(page.getByText("Saved to library.")).toBeVisible();

  await page.reload();
  await openLibrary(page);

  await expect(page.locator(".library-card")).toHaveCount(1);
  await expect(
    page.locator(".library-card-title").filter({ hasText: "Solo Recipe Edited" })
  ).toBeVisible();
});
