import { expect, test } from "@playwright/test";
import { entrarComo, semViolacoes, serviceKey, supabaseUrl } from "./sessao";

/**
 * Menu da equipe: a administradora encontra a Equipe (com ela mesma e o papel)
 * e a visão do Portal do cliente pelo menu lateral. Dados fictícios.
 */
test.skip(!supabaseUrl || !serviceKey, "Requer Supabase local (job auth-e2e do CI).");
test.describe.configure({ timeout: 120_000 });

test("a administradora acessa Equipe e Portal do cliente pelo menu", async ({ browser }) => {
  const { contexto, page } = await entrarComo(browser, "admin", "equipe-jc");
  try {
    await page.goto("/admin");
    const menu = page.getByRole("navigation", { name: "Áreas do sistema" });
    await menu.getByRole("link", { name: "Equipe" }).click();
    await expect(page.getByRole("heading", { name: "Equipe", level: 1 })).toBeVisible();
    const voce = page.getByTestId("equipe-lista").getByRole("listitem").filter({ hasText: "Você" });
    await expect(voce).toContainText("Administradora");
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await semViolacoes(page);

    await menu.getByRole("link", { name: "Portal do cliente" }).click();
    await expect(page.getByRole("heading", { name: "Portal do cliente", level: 1 })).toBeVisible();
    await semViolacoes(page);
  } finally {
    await contexto.close();
  }
});
