import { randomUUID } from "node:crypto";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { entrarComo, semViolacoes, serviceKey, supabaseUrl } from "./sessao";

/**
 * Propostas de ponta a ponta contra Supabase local efêmero: a administradora
 * configura valor-hora e catálogo; o relacionamento monta, envia e registra o
 * aceite, e o funil acompanha. Valores e textos 100% fictícios.
 */
test.skip(!supabaseUrl || !serviceKey, "Requer Supabase local (job auth-e2e do CI).");
test.describe.configure({ mode: "serial", timeout: 150_000 });

const sufixo = randomUUID().slice(0, 6);
const empresa = `Empresa Fictícia ${sufixo}`;
const oportunidade = `Oportunidade fictícia ${sufixo}`;
const etapa = `Etapa fictícia ${sufixo}`;
// PNG 1x1 transparente.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
let adm: { contexto: BrowserContext; page: Page };
let rel: { contexto: BrowserContext; page: Page };

test.beforeAll(async ({ browser }) => {
  adm = await entrarComo(browser, "admin", "prop-adm");
  rel = await entrarComo(browser, "relationship", "prop-rel");
});
test.afterAll(async () => {
  await adm?.contexto.close();
  await rel?.contexto.close();
});

test("administradora define valor-hora e etapa do catálogo", async () => {
  const page = adm.page;
  await page.goto("/admin/propostas/catalogo");
  await page.getByLabel("Valor-hora (R$)").fill("400,00");
  await page.getByLabel("Validade padrão (dias)").fill("20");
  await page.getByLabel("Condições de pagamento padrão").fill("Condição fictícia de pagamento.");
  await page.getByRole("button", { name: "Salvar condições" }).click();
  await expect(page.getByTestId("config-aviso")).toHaveText("Condições padrão salvas.");

  await page.locator("#et-nova-nome").fill(etapa);
  await page.locator("#et-nova-horas").fill("20");
  await page.locator("#et-nova-desc").fill("Descrição fictícia da etapa.");
  await page.getByRole("button", { name: "Incluir no catálogo" }).click();
  await expect(page.getByTestId("nova-etapa-aviso")).toHaveText("Etapa incluída no catálogo.");
  await semViolacoes(page);
});

test("relacionamento não acessa o catálogo", async () => {
  await rel.page.goto("/admin/propostas/catalogo");
  await expect(rel.page).toHaveURL(/\/admin\/propostas$/);
});

test("relacionamento monta a proposta com cálculo ao vivo", async () => {
  const page = rel.page;
  await page.goto("/admin/empresas");
  await page.locator("#ne-nome").fill(empresa);
  await page.getByRole("button", { name: "Cadastrar empresa" }).click();
  await expect(page).toHaveURL(/\/admin\/empresas\/[0-9a-f-]{36}$/);
  await page.goto("/admin/funil");
  await page.locator("#op-empresa").selectOption({ label: empresa });
  await page.locator("#op-titulo").fill(oportunidade);
  await page.getByRole("button", { name: "Criar oportunidade" }).click();
  await expect(page.getByTestId("funil-aviso")).toHaveText("Oportunidade criada.");

  await page.goto("/admin/propostas");
  await page.getByLabel("Empresa").selectOption({ label: empresa });
  await page.getByLabel("Oportunidade do funil (opcional)").selectOption({ label: oportunidade });
  await page.getByLabel("Título da proposta").fill("Plano de sucessão fictício");
  await page.getByRole("button", { name: "Montar proposta" }).click();
  await expect(page).toHaveURL(/\/admin\/propostas\/[0-9a-f-]{36}$/);

  await page.getByLabel("Etapa do catálogo").selectOption({ label: `${etapa} (20 h)` });
  await page.getByRole("button", { name: "Incluir do catálogo" }).click();
  await page.getByRole("button", { name: "Etapa avulsa" }).click();
  await page.locator("#it1-nome").fill("Acompanhamento fictício");
  await page.locator("#it1-horas").fill("30");
  await page.getByLabel("Fator de complexidade").fill("1,2");
  await page.getByLabel("Desconto (%)").fill("10");
  await page.getByLabel("Parcelas").fill("3");

  // 50 h × 400 × 1,2 − 10% = 21.600,00 em 3 × 7.200,00
  const resumo = page.getByTestId("proposta-resumo");
  await expect(resumo).toContainText("50 h");
  await expect(resumo).toContainText("R$ 21.600,00");
  await expect(resumo).toContainText("3 parcelas de");
  await expect(resumo).toContainText("R$ 7.200,00");

  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByTestId("proposta-aviso")).toHaveText("Rascunho salvo.");

  await page.getByLabel("PNG, JPG ou WebP, até 2 MB").setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await page.getByRole("button", { name: "Enviar logo" }).click();
  await expect(page.getByTestId("proposta-aviso")).toHaveText("Logo do cliente atualizado.");
  await expect(page.getByAltText("Logo atual do cliente")).toBeVisible();
  await semViolacoes(page);
});

test("documento de envio segue o padrão, com logo do cliente", async () => {
  const page = rel.page;
  await page.getByRole("link", { name: "Abrir documento para envio" }).click();
  const doc = page.getByTestId("proposta-documento");
  await expect(doc.getByRole("heading", { level: 1 })).toHaveText("Plano de sucessão fictício");
  await expect(doc).toContainText(empresa);
  await expect(doc).toContainText(etapa);
  await expect(page.getByTestId("documento-investimento")).toContainText("R$ 21.600,00");
  await expect(page.getByTestId("documento-investimento")).toContainText(
    "3 parcelas de R$ 7.200,00",
  );
  await expect(doc).toContainText("Condição fictícia de pagamento.");
  await expect(page.getByAltText(`Logo de ${empresa}`)).toBeVisible();
  await semViolacoes(page);
  await page.getByRole("link", { name: "Voltar à proposta" }).click();
});

test("envio congela, aceite fecha o funil", async () => {
  const page = rel.page;
  await page.getByRole("button", { name: "Marcar como enviada" }).click();
  await expect(page.getByTestId("proposta-aviso")).toHaveText(
    "Proposta marcada como enviada. Valores e validade congelados.",
  );
  await expect(page.getByText("Aguardando retorno", { exact: true })).toBeVisible();
  await expect(page.locator("#pr-titulo")).toBeDisabled();
  await expect(page.getByTestId("proposta-resumo")).toContainText("Total (congelado no envio)");

  await page.goto("/admin/funil");
  await expect(
    page
      .getByRole("region", { name: "Proposta enviada" })
      .getByRole("listitem")
      .filter({ hasText: oportunidade }),
  ).toContainText("R$ 21.600");

  await page.goto("/admin/propostas");
  await page
    .getByRole("link", { name: /Plano de sucessão fictício/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Registrar aceite" }).click();
  await expect(page.getByTestId("proposta-aviso")).toHaveText(
    "Aceite registrado. A oportunidade foi para Contrato fechado.",
  );
  await page.goto("/admin/funil");
  await expect(
    page
      .getByRole("region", { name: "Contrato fechado" })
      .getByRole("listitem")
      .filter({ hasText: oportunidade }),
  ).toBeVisible();
});

test("proposta aprovada vira contrato e a empresa entra em Clientes", async () => {
  const page = rel.page;
  // Em Clientes só aparece quem tem contrato registrado.
  await page.goto("/admin/empresas");
  await page.getByRole("link", { name: empresa }).click();
  await expect(page.getByTestId("empresa-contratos")).toContainText("Plano de sucessão fictício");
  await page.getByRole("link", { name: "Abrir contratos e propostas" }).click();
  const lista = page.getByTestId("contratos-lista");
  await expect(lista).toContainText("Plano de sucessão fictício");
  await expect(lista).toContainText("Em andamento");
  await semViolacoes(page);

  await lista.getByRole("link", { name: "Abrir o contrato" }).click();
  const doc = page.getByTestId("contrato-documento");
  await expect(doc.getByRole("heading", { level: 1 })).toHaveText("Plano de sucessão fictício");
  // Sem modelo cadastrado, o contrato avisa que as condições são de exemplo.
  await expect(page.getByTestId("contrato-exemplo")).toBeVisible();
  await semViolacoes(page);
});

test("central do cliente: próximo passo, roteiro e concluir atendimento", async () => {
  const page = rel.page;
  await page.goto("/admin/empresas");
  await page.getByRole("link", { name: empresa }).click();
  await expect(page.getByTestId("empresa-roteiro")).toContainText("Contrato");
  await expect(page.getByTestId("empresa-progresso")).toContainText("etapas feitas");
  await semViolacoes(page);

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Concluir atendimento" }).click();
  // O botão sai da tela quando o atendimento é concluído; o título confirma.
  await expect(page.getByRole("heading", { name: "Atendimento concluído" })).toBeVisible();

  await page.goto("/admin/empresas?ver=concluidos");
  await expect(page.getByRole("link", { name: empresa })).toBeVisible();
  await page.goto("/admin/empresas");
  await expect(page.getByRole("link", { name: empresa })).toHaveCount(0);
});

test("caixa: plano de pagamento do contrato, recebimento e visões", async () => {
  const page = rel.page;
  await page.goto("/admin/empresas?ver=concluidos");
  await page.getByRole("link", { name: empresa }).click();
  await page.getByRole("link", { name: "Abrir contratos e propostas" }).click();

  const pagamentos = page.getByTestId("contrato-pagamentos");
  await expect(pagamentos).toContainText("Plano de pagamento ainda não definido");
  await pagamentos.getByLabel("Parcelas (mensais)").fill("2");
  await pagamentos.getByLabel("Forma de pagamento").selectOption("boleto");
  await pagamentos.getByRole("button", { name: "Gerar parcelas" }).click();
  await expect(pagamentos).toContainText("Parcela 1 de 2");
  await expect(pagamentos).toContainText("Parcela 2 de 2");
  await expect(pagamentos).toContainText("Boleto");
  await semViolacoes(page);

  await page.goto("/admin/caixa");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Caixa");
  const linha = page.getByTestId("caixa-lista").getByRole("listitem").filter({ hasText: empresa });
  await expect(linha).toHaveCount(2);
  await semViolacoes(page);

  await page
    .getByRole("button", { name: `Marcar recebido: Parcela 1 de 2 de ${empresa}` })
    .click();
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(linha).toHaveCount(1);

  await page.goto("/admin/caixa?ver=recebidas");
  await expect(
    page.getByTestId("caixa-lista").getByRole("listitem").filter({ hasText: empresa }),
  ).toContainText("Recebido em");
});
