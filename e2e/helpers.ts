import { type Page } from "@playwright/test";

export const DEMO_EMAIL = "demo@telegraph.app";
export const DEMO_PASSWORD = "demo1234";

export async function login(page: Page, email = DEMO_EMAIL, password = DEMO_PASSWORD): Promise<void> {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("/");
}