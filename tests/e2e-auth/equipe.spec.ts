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

test("convite por link: a pessoa abre o link, aceita e cria a senha", async ({ browser }) => {
  const sufixo = Math.random().toString(36).slice(2, 8);
  const { contexto, page } = await entrarComo(browser, "admin", "equipe-link");
  let link = "";
  try {
    await page.goto("/admin/equipe");
    await page.getByLabel("Nome").fill(`Pessoa Fictícia ${sufixo}`);
    await page.getByLabel("E-mail").fill(`convite.${sufixo}@exemplo.test`);
    await page.getByRole("button", { name: "Gerar link de convite" }).click();
    await expect(page.getByTestId("equipe-convite-aviso")).toContainText("Link de convite pronto");
    link = await page.getByTestId("equipe-convite-link").inputValue();
    expect(link).toMatch(/\/admin\/convite\?t=[A-Za-z0-9_-]+&tipo=invite$/);
    await expect(page.getByTestId("equipe-lista")).toContainText(`Pessoa Fictícia ${sufixo}`);
  } finally {
    await contexto.close();
  }

  // Abrir o link (como faz a prévia do WhatsApp) não usa o convite; o clique usa.
  const convidado = await browser.newContext();
  const p = await convidado.newPage();
  try {
    const caminho = new URL(link).pathname + new URL(link).search;
    await p.goto(caminho);
    await p.goto(caminho);
    await expect(p.getByRole("heading", { level: 1 })).toHaveText(
      "Você recebeu um convite para a área da JC",
    );
    await semViolacoes(p);
    await p.getByRole("link", { name: "Aceitar convite e criar senha" }).click();
    await expect(p).toHaveURL(/\/admin\/redefinir-senha/);
  } finally {
    await convidado.close();
  }
});
