import { test, expect } from "@playwright/test";
import { login } from "./helpers";

test.describe("archive", () => {
  test("lists past editions grouped by day", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Archive" }).click();
    await page.waitForURL(/\/archive$/);

    await expect(page.getByRole("heading", { name: "Past editions" })).toBeVisible();
    const card = page.getByText("Morning edition").first();
    await expect(card).toBeVisible();
    await expect(card.locator("xpath=ancestor::a")).toHaveAttribute("href", /\/newspaper\//);
  });
});

test.describe("search", () => {
  test("full-text search returns newspaper links", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Search" }).click();
    await page.waitForURL(/\/search$/);

    await page.fill('input[name="q"]', "закон");
    await page.locator('form[role="search"] button[type="submit"]').click();
    await page.waitForURL(/\/search\?q=/);

    await expect(page.getByText(/results/)).toBeVisible();
    const links = page.locator('a[href*="/newspaper/"]');
    await expect(links.first()).toBeVisible();
    expect(await links.count()).toBeGreaterThan(0);
  });
});

test.describe("settings", () => {
  test("language preference persists and drives the interface", async ({ page }) => {
    // Isolated user so the shared demo account's language stays stable for
    // parallel tests.
    const email = `settings-${Date.now()}@fun.test`;
    await page.goto("/register");
    await page.fill("#name", "Settings Tester");
    await page.fill("#email", email);
    await page.fill("#password", "password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("/");

    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("button", { name: "Русский" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved")).toBeVisible();

    await page.getByRole("link", { name: "Archive" }).click();
    await expect(page.getByRole("heading", { name: "Прошедшие выпуски" })).toBeVisible();

    await page.getByRole("link", { name: "Settings" }).click();
    await page.getByRole("button", { name: "English" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved")).toBeVisible();
  });
});

test.describe("my newspaper", () => {
  test("renders a personalized digest from the latest edition", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "My Paper" }).click();
    await page.waitForURL(/\/mypaper$/);

    await expect(page.getByRole("heading", { name: "Your personal digest" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Open the full edition/ })).toBeVisible();
    const items = page.locator("ul a[href*='/newspaper/']");
    await expect(items.first()).toBeVisible();
  });
});

test.describe("admin", () => {
  test("admin sees the operations dashboard", async ({ page }) => {
    await login(page);
    await page.getByRole("link", { name: "Admin" }).click();
    await page.waitForURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Operations dashboard" })).toBeVisible();
    await expect(page.getByText("Channels").first()).toBeVisible();
  });

  test("non-admins are redirected away from /admin", async ({ page }) => {
    const reader = `reader-${Date.now()}@fun.test`;
    await page.goto("/register");
    await page.fill("#name", "Plain Reader");
    await page.fill("#email", reader);
    await page.fill("#password", "password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("/");

    await page.goto("/admin");
    await page.waitForURL("/");
    await expect(page.getByText("Latest edition")).toBeVisible();
  });
});

test.describe("personalization", () => {
  test("source weights persist and My Newspaper stays reachable", async ({ page }) => {
    await login(page);
    await page.goto("/settings");

    await expect(page.getByText("Источники")).toBeVisible();
    const row = page.locator("li").filter({ hasText: "@bbbreaking" }).first();
    await expect(row).toBeVisible();

    const weightSelect = row.getByLabel("Вес источника Раньше всех. Ну почти.");
    await expect(weightSelect).toHaveValue("5");
    // selectOption fires an async PUT; reload must wait for it to commit,
    // otherwise the server may still hold the old weight (flaky under load).
    const saved = page.waitForResponse(
      (res) => res.url().includes("/api/me/sources") && res.request().method() === "PUT",
    );
    await weightSelect.selectOption("8");
    await saved;

    await page.reload();
    await expect(page.getByText("Источники")).toBeVisible();
    await expect(
      page
        .locator("li")
        .filter({ hasText: "@bbbreaking" })
        .first()
        .getByLabel("Вес источника Раньше всех. Ну почти."),
    ).toHaveValue("8");

    await page.goto("/mypaper");
    await expect(page.getByText(/Your personal digest|Ваш личный дайджест/)).toBeVisible();
  });
});