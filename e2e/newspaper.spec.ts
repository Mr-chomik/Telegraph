import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("newspaper viewer", () => {
  test("opens the latest edition and exercises TOC, article modal and page turn", async ({ page }) => {
    await login(page);

    const latest = page.getByText("Latest edition");
    await expect(latest).toBeVisible();
    await page.getByRole("link", { name: "Read →" }).click();
    await page.waitForURL(/\/newspaper\/.+/);

    const tocButton = page.getByRole("button", { name: "Table of contents" });
    await expect(tocButton).toBeVisible();

    const drawer = page.locator('aside[aria-label="Table of contents"]');
    await tocButton.click();
    await expect(drawer).toBeInViewport();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();

    const headline = page.locator("button.group").first();
    await expect(headline).toBeVisible();
    await headline.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Sources");
    await dialog.getByRole("button", { name: "Back to page" }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Next page" }).click();
    await expect(page.getByRole("button", { name: "Previous page" })).toBeVisible();
  });

  test("the edition is reachable from the archive", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Archive" }).click();
    await page.waitForURL(/\/archive$/);

    const morning = page.getByText("Morning edition").first();
    await expect(morning).toBeVisible();
    await morning.click();
    await page.waitForURL(/\/newspaper\/.+/);
    await expect(page.getByRole("button", { name: "Table of contents" })).toBeVisible();
  });
});