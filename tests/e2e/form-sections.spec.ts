import { expect, test } from "@playwright/test";

test("recipe form uses accessible collapsible sections", async ({ page }) => {
  await page.goto("/");

  const sections = page.locator("details.form-section");
  const section = (name: string) => sections.filter({ has: page.getByText(name, { exact: true }) });

  await expect(sections).toHaveCount(6);
  await expect(sections.locator("summary svg[aria-hidden='true']")).toHaveCount(6);

  const basics = section("Recipe basics");
  const ingredients = section("Ingredients");
  const source = section("Source");

  await expect(basics).toHaveJSProperty("open", true);
  await expect(ingredients).toHaveJSProperty("open", true);
  await expect(source).toHaveJSProperty("open", false);
  await expect(page.getByLabel("Title")).toBeVisible();

  await source.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(source).toHaveJSProperty("open", true);
  await expect(source.getByLabel("Name")).toBeVisible();
});
