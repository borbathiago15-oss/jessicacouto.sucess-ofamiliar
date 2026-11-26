import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const ROTAS_PUBLICAS = [
  "/",
  "/conheca-jessica",
  "/metodologia",
  "/diagnosticos",
  "/servicos",
  "/guias",
  "/contato",
  "/privacidade",
  "/privacidade/solicitacao",
];

// Acessibilidade automática (WCAG 2.1 A e AA), com e sem o banner de cookies.
for (const rota of [
  ...ROTAS_PUBLICAS,
  "/artigos",
  "/design",
  "/design/relatorio",
  "/admin/login",
  "/admin/recuperar-senha",
]) {
  test(`sem violações de acessibilidade em ${rota}`, async ({ page }) => {
    await page.goto(rota);
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
  });
}

test("sem Supabase, as páginas públicas mostram aviso neutro, nunca texto inventado", async ({
  page,
}) => {
  for (const rota of ROTAS_PUBLICAS.slice(0, 8)) {
    await page.goto(rota);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Conteúdo em preparação");
  }
});

test("banner de cookies: só necessários por padrão, escolha registrada com versão", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Preferências de cookies" });
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: "Somente necessários" }).click();
  await expect(banner).toBeHidden();
  const cookie = (await context.cookies()).find((c) => c.name === "jc_cookies");
  expect(decodeURIComponent(cookie?.value ?? "")).toMatch(/^1:necessarios:\d{4}-\d{2}-\d{2}$/);
  await page.reload();
  await expect(page.getByRole("region", { name: "Preferências de cookies" })).toBeHidden();
});

test("menu principal leva às páginas do site", async ({ page }) => {
  await page.goto("/");
  // No celular, a navegação fica atrás do botão de menu.
  const abrir = page.getByRole("button", { name: "Abrir menu" });
  if (await abrir.isVisible()) await abrir.click();
  await page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("link", { name: "Metodologia" })
    .click();
  await expect(page).toHaveURL(/\/metodologia$/);
});

test("página inexistente responde 404", async ({ page }) => {
  const r = await page.goto("/pagina-que-nao-existe");
  expect(r?.status()).toBe(404);
});
