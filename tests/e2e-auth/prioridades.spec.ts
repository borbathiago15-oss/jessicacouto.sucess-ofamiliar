import { randomUUID } from "node:crypto";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { entrarComo, semViolacoes, serviceKey, supabaseUrl } from "./sessao";

/**
 * Do alerta do Raio-X até o PDCA concluído, contra Supabase local efêmero.
 * Dados 100% fictícios.
 */
test.skip(!supabaseUrl || !serviceKey, "Requer Supabase local (job auth-e2e do CI).");
test.describe.configure({ mode: "serial", timeout: 120_000 });

const empresa = `Empresa Fictícia ${randomUUID().slice(0, 6)}`;
const ALERTA = "Mistura entre pessoa física e empresa";
let contexto: BrowserContext;
let page: Page;
let endereco = "";

test.beforeAll(async ({ browser }) => {
  ({ contexto, page } = await entrarComo(browser, "admin", "prio"));
  await page.goto("/admin/empresas");
  await page.locator("#ne-nome").fill(empresa);
  await page.getByRole("button", { name: "Cadastrar empresa" }).click();
  await expect(page).toHaveURL(/\/admin\/empresas\/[0-9a-f-]{36}$/);
  endereco = page.url();
});
test.afterAll(async () => {
  await contexto?.close();
});

test("alerta do Raio-X vai para a matriz, uma vez só", async () => {
  await page.goto(`${endereco}/raio-x`);
  await page.locator("#novo-periodo").fill("2025");
  await page.getByRole("button", { name: "Adicionar período" }).click();
  await page.locator("#c-receitaBruta").fill("1.000.000");
  await page.locator("#c-despesasPessoais").fill("50.000");
  await page.getByRole("button", { name: "Salvar período" }).click();
  await expect(page.getByTestId("raiox-aviso")).toHaveText("Período criado.");

  const levar = page.getByRole("button", {
    name: `Levar para a Matriz de Prioridades: ${ALERTA}`,
  });
  await levar.click();
  await expect(page.getByTestId("raiox-aviso")).toHaveText(
    `“${ALERTA}” foi para a Matriz de Prioridades.`,
  );
  await levar.click();
  await expect(page.getByTestId("raiox-aviso")).toHaveText(
    "Este achado já está na Matriz de Prioridades.",
  );
});

test("matriz posiciona o item e o PDCA exige plano e resultado", async () => {
  await page.goto(`${endereco}/prioridades`);
  // Atenção (não crítico): impacto 4, urgência 3 → "Planejar bem".
  await expect(page.getByRole("region", { name: "Planejar bem" })).toContainText(ALERTA);
  await semViolacoes(page);

  const cartao = page
    .getByRole("region", { name: /^Planejar \(/ })
    .getByRole("listitem")
    .filter({ hasText: ALERTA });
  await cartao.getByText("Abrir plano").click();
  await cartao.getByLabel("Fase do PDCA").selectOption("do");
  await cartao.getByRole("button", { name: "Salvar" }).click();
  await expect(cartao.getByTestId("prioridade-edicao-aviso")).toHaveText(
    "Para executar, defina responsável e prazo no plano.",
  );

  await cartao.getByLabel("Responsável", { exact: true }).fill("Sócio fictício");
  await cartao.getByLabel("Prazo", { exact: true }).fill("2030-03-31");
  await cartao.getByRole("button", { name: "Salvar" }).click();
  const executando = page
    .getByRole("region", { name: /^Executar \(/ })
    .getByRole("listitem")
    .filter({ hasText: ALERTA });
  await expect(executando).toContainText("Sócio fictício · até 31/03/2030");

  await executando.getByText("Abrir plano").click();
  await executando.getByLabel("Fase do PDCA").selectOption("done");
  await executando.getByLabel("Resultado obtido").fill("Contas separadas desde março.");
  await executando.getByRole("button", { name: "Salvar" }).click();
  await expect(
    page
      .getByRole("region", { name: /^Concluído \(/ })
      .getByRole("listitem")
      .filter({ hasText: ALERTA }),
  ).toBeVisible();
  // Concluído sai da matriz.
  await expect(page.getByTestId("matriz")).not.toContainText(ALERTA);
});

test("histórico registra a jornada da prioridade", async () => {
  await page.goto(`${endereco}/historico`);
  const linha = page.getByTestId("historico-linha");
  await expect(linha).toContainText(`Prioridade incluída na matriz: ${ALERTA}.`);
  await expect(linha).toContainText(`Prioridade "${ALERTA}" passou para Executar.`);
  await expect(linha).toContainText(`Prioridade "${ALERTA}" passou para Concluído.`);
});
