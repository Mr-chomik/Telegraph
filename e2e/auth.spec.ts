import { test, expect } from "@playwright/test";
import { login, DEMO_EMAIL } from "./helpers";

const uniqueReader = `reader-${Date.now()}@telegraph.test`;

test.describe("authentication", () => {
  test("registers a new account and signs in", async ({ page }) => {
    await page.goto("/register");
    await page.fill("#name", "E2E Reader");
    await page.fill("#email", uniqueReader);
    await page.fill("#password", "password123");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("/");
    await expect(page.getByText("Latest edition")).toBeVisible();
    await expect(page.getByRole("main").getByText("E2E Reader")).toBeVisible();
  });

  test("login rejects a wrong password", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", DEMO_EMAIL);
    await page.fill("#password", "definitely-wrong");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("p[role='alert']")).toContainText("Invalid email or password");
  });

  test("signing out returns to the login page", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("/login");
    await expect(page.getByText("New reader?")).toBeVisible();
  });
});