import { expect, test } from "@playwright/test";

test("recipe form uses visible section flow", async ({ page }) => {
  await page.goto("/");

  const recipe = page.locator("section.form-section");
  const extras = page.locator("details.form-section-dropdown");

  await expect(recipe).toHaveCount(1);
  await expect(extras).toHaveCount(1);
  await expect(recipe.getByRole("heading", { name: "Recipe" })).toBeVisible();
  await expect(extras.getByText("Notes & extras", { exact: true })).toBeVisible();
  await expect(extras).toHaveJSProperty("open", false);
  await expect(page.getByLabel("Title")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ingredients" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Instructions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Source" })).toBeHidden();

  await extras.locator("summary").click();
  await expect(extras).toHaveJSProperty("open", true);
  await expect(page.getByRole("heading", { name: "Source" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Name", exact: true })).toBeVisible();
});
