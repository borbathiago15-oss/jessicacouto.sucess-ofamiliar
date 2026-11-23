import { randomUUID } from "node:crypto";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { entrarComo, semViolacoes, serviceKey, supabaseUrl } from "./sessao";

/**
 * Relatório Executivo de ponta a ponta contra Supabase local efêmero: monta a
 * partir do Raio-X, mostra conclusões com números, aceita revisão da consultora
 * e abre como apresentação. Dados 100% fictícios.
 */
test.skip(!supabaseUrl || !serviceKey, "Requer Supabase local (job auth-e2e do CI).");
test.describe.configure({ mode: "serial", timeout: 150_000 });

const empresa = `Empresa Fictícia ${randomUUID().slice(0, 6)}`;
let contexto: BrowserContext;
let page: Page;
let endereco = "";

test.beforeAll(async ({ browser }) => {
  ({ contexto, page } = await entrarComo(browser, "admin", "rel-exec"));
  await page.goto("/admin/empresas");
  await page.locator("#ne-nome").fill(empresa);
  await page.getByRole("button", { name: "Cadastrar empresa" }).click();
  await expect(page).toHaveURL(/\/admin\/empresas\/[0-9a-f-]{36}$/);
  endereco = page.url();

  await page.goto(`${endereco}/raio-x`);
  await page.locator("#novo-periodo").fill("2025");
  await page.getByRole("button", { name: "Adicionar período" }).click();
  const v: Record<string, string> = {
    receitaBruta: "10.000.000",
    deducoes: "1.500.000",
    cmv: "5.200.000",
    despesasOperacionais: "1.900.000",
    proLabore: "480.000",
    salariosFamiliares: "240.000",
    despesasPessoais: "120.000",
    distribuicoes: "600.000",
    caixa: "400.000",
  };
  for (const [k, x] of Object.entries(v)) await page.locator(`#c-${k}`).fill(x);
  await page.getByRole("button", { name: "Salvar período" }).click();
  await expect(page.getByTestId("raiox-aviso")).toHaveText("Período criado.");
});
test.afterAll(async () => {
  await contexto?.close();
});

test("relatório começa pelas conclusões, com números e o que está em jogo", async () => {
  await page.goto(`${endereco}/relatorio`);
  const rel = page.getByTestId("relatorio-executivo");
  await expect(rel.getByRole("heading", { level: 1 })).toHaveText(empresa);
  await expect(page.getByTestId("mensagens-chave")).toContainText(
    "A família retira mais do que a empresa gera",
  );
  await expect(page.getByTestId("em-jogo")).toContainText("por ano");
  await expect(
    rel.getByRole("heading", {
      // Com estes números o caixa não zera em 24 meses; o ganho é a liberação anual.
      name: /^Ajustar as retiradas libera R\$\s460\.000 por ano para a empresa$/,
    }),
  ).toBeVisible();
  await expect(page.getByTestId("relatorio-pendencias")).toContainText("família não mapeada");
  await semViolacoes(page);
});

test("consultora revisa o sumário e o relatório usa o texto dela", async () => {
  await page.getByText("Revisar o sumário executivo").click();
  await page.locator("#msg-0").fill("Mensagem revisada pela consultora (fictícia).");
  await page.locator("#dec-0").fill("Decisão fictícia para a família.");
  await page.getByRole("button", { name: "Salvar sumário" }).click();
  await expect(page.getByTestId("sumario-aviso")).toHaveText(
    "Sumário salvo. O relatório já usa estas frases.",
  );
  await page.reload();
  await expect(page.getByTestId("mensagens-chave")).toContainText(
    "Mensagem revisada pela consultora (fictícia).",
  );
  await expect(page.getByTestId("relatorio-executivo")).toContainText(
    "Decisão fictícia para a família.",
  );
});

test("abre como apresentação", async () => {
  await page.getByRole("link", { name: "Ver como apresentação" }).click();
  await expect(page).toHaveURL(/modo=apresentacao/);
  await expect(page.getByRole("region", { name: "Capa" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver como documento" })).toBeVisible();
  await semViolacoes(page);
});
