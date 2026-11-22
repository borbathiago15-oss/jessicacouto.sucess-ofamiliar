import { expect, test } from "@playwright/test";

test("página inicial responde e não é indexável", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("/admin sem sessão redireciona ao login e é noindex", async ({ page }) => {
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

test("rotas internas do /admin também exigem login", async ({ page }) => {
  await page.goto("/admin/mfa/cadastrar");
  await expect(page).toHaveURL(/\/admin\/login$/);
});
