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

// An unsaved draft must NOT silently overwrite the editor on reload. It is
// offered through an explicit, keyboard-reachable prompt instead.
test("an unsaved draft is offered for restore, not auto-applied", async ({ page }) => {
  await page.goto("/");

  await fillTitle(page, "Draft Soup");
  // let the 500ms draft autosave commit to IndexedDB before reloading
  await page.waitForTimeout(700);
  await page.reload();

  // editor starts empty; the draft is not auto-restored
  await openBasics(page);
  await expect(page.getByLabel("Title")).toHaveValue("");

  const banner = page.locator(".restore-banner");
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: "Restore" }).click();

  await openBasics(page);
  await expect(page.getByLabel("Title")).toHaveValue("Draft Soup");
  await expect(banner).toBeHidden();
});

test("discarding the draft prompt leaves the editor empty", async ({ page }) => {
  await page.goto("/");

  await fillTitle(page, "Throwaway");
  await page.waitForTimeout(700);
  await page.reload();

  const banner = page.locator(".restore-banner");
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: "Discard" }).click();
  await expect(banner).toBeHidden();

  await openBasics(page);
  await expect(page.getByLabel("Title")).toHaveValue("");
});
