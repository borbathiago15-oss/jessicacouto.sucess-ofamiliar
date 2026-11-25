import { randomUUID } from "node:crypto";
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { entrarComo, entrarComoCliente, semViolacoes, serviceKey, supabaseUrl } from "./sessao";

/**
 * Organograma de ponta a ponta contra Supabase local efêmero: a JC registra a
 * estrutura atual, vê os pontos de atenção, leva um para a matriz, monta a
 * proposta, compara e publica; o cliente vê só a proposta. Dados 100% fictícios.
 */
test.skip(!supabaseUrl || !serviceKey, "Requer Supabase local (job auth-e2e do CI).");
test.describe.configure({ mode: "serial", timeout: 180_000 });

const empresa = `Empresa Fictícia Organograma ${randomUUID().slice(0, 6)}`;
const FUNDADOR = "Fundador Fictício";
const CONCENTRACAO = `Decisões concentradas em ${FUNDADOR}`;
let contexto: BrowserContext;
let page: Page;
let endereco = "";
let orgId = "";

test.beforeAll(async ({ browser }) => {
  ({ contexto, page } = await entrarComo(browser, "admin", "organo"));
  await page.goto("/admin/empresas");
  await page.locator("#ne-nome").fill(empresa);
  await page.getByRole("button", { name: "Cadastrar empresa" }).click();
  await expect(page).toHaveURL(/\/admin\/empresas\/[0-9a-f-]{36}$/);
  endereco = page.url();
  orgId = endereco.split("/").at(-1)!;
});
test.afterAll(async () => {
  await contexto?.close();
});

async function incluir(
  form: Locator,
  c: { cargo: string; quem?: string; superior?: string; socio?: boolean; familia?: boolean },
) {
  await form.getByLabel("Cargo", { exact: true }).fill(c.cargo);
  await form.getByLabel("Quem ocupa (vazio = vago)").fill(c.quem ?? "");
  if (c.superior) await form.getByLabel(/^Responde a/).selectOption({ label: c.superior });
  if (c.socio) await form.getByLabel("É sócio(a)").check();
  if (c.familia) await form.getByLabel("É da família").check();
  await form.getByRole("button", { name: "Incluir cargo" }).click();
  await expect(form.getByTestId("cargo-aviso")).toHaveText(`Cargo “${c.cargo}” incluído.`);
}

test("a JC registra a estrutura atual e vê os pontos de atenção", async () => {
  await page.goto(endereco);
  await page.getByRole("link", { name: "Abrir o organograma" }).click();
  await expect(page.getByRole("heading", { name: "Organograma", level: 1 })).toBeVisible();
  const form = page.locator("form").filter({ has: page.locator("#novo-current-title") });

  await incluir(form, { cargo: "Diretoria", quem: FUNDADOR, socio: true });
  await incluir(form, { cargo: "Compras", quem: FUNDADOR, superior: `Diretoria (${FUNDADOR})` });
  await incluir(form, {
    cargo: "Vendas",
    quem: "Herdeira Fictícia",
    superior: `Diretoria (${FUNDADOR})`,
    familia: true,
  });

  const arvore = page.getByTestId("organograma-current");
  await expect(arvore.locator('[data-cargo="Compras"]')).toBeVisible();
  await expect(page.getByTestId("organograma-resumo")).toContainText("Cargos3");
  const pontos = page.getByTestId("organograma-pontos");
  await expect(pontos).toContainText(`Crítico: ${CONCENTRACAO}`);
  await expect(pontos).toContainText("Familiares sem papel e critérios definidos");
  await semViolacoes(page);

  // Ciclo recusado pelo banco, com mensagem clara.
  const diretoria = arvore.locator('[data-cargo="Diretoria"]').first();
  await diretoria.getByText("Editar", { exact: true }).click();
  await diretoria.getByLabel(/^Responde a/).selectOption({ label: "Compras (Fundador Fictício)" });
  await diretoria.getByRole("button", { name: "Salvar" }).click();
  await expect(diretoria.getByTestId("cargo-edicao-aviso")).toHaveText(
    "Essa subordinação criaria um ciclo na estrutura.",
  );
});

test("um ponto vai para a Matriz de Prioridades, uma vez só", async () => {
  await page.goto(`${endereco}/organograma`);
  const levar = page.getByRole("button", {
    name: `Levar para a Matriz de Prioridades: ${CONCENTRACAO}`,
  });
  await levar.click();
  await expect(page.getByTestId("matriz-aviso")).toHaveText(
    `“${CONCENTRACAO}” foi para a Matriz de Prioridades.`,
  );
  await levar.click();
  await expect(page.getByTestId("matriz-aviso")).toHaveText(
    "Este ponto já está na Matriz de Prioridades.",
  );
  await page.goto(`${endereco}/prioridades`);
  await expect(page.getByText(CONCENTRACAO).first()).toBeVisible();
});

test("a proposta parte da estrutura atual e registra o porquê", async () => {
  await page.goto(`${endereco}/organograma?ver=proposta`);
  await page.getByRole("button", { name: "Começar a partir da estrutura atual" }).click();
  await expect(page.getByTestId("copiar-aviso")).toContainText("Proposta iniciada com 3 cargo(s)");

  const compras = page.getByTestId("organograma-proposed").locator('[data-cargo="Compras"]');
  await compras.getByText("Editar", { exact: true }).click();
  await compras.getByLabel("Quem ocupa (vazio = vago)").fill("Gestora Contratada");
  await compras.getByLabel(/Por que esta mudança/).fill("Libera o fundador para a estratégia.");
  await compras.getByRole("button", { name: "Salvar" }).click();
  await expect(compras.getByTestId("cargo-edicao-aviso")).toHaveText("Cargo salvo.");

  const vendas = page.getByTestId("organograma-proposed").locator('[data-cargo="Vendas"]');
  await vendas.getByText("Editar", { exact: true }).click();
  await vendas.getByLabel(/Papel, critério de entrada e remuneração definidos/).check();
  await vendas.getByRole("button", { name: "Salvar" }).click();
  await expect(vendas.getByTestId("cargo-edicao-aviso")).toHaveText("Cargo salvo.");

  await page.locator("#resumo-proposta").fill("Separar o papel de sócio do papel de gestor.");
  await page.getByRole("button", { name: "Salvar racional" }).click();
  await expect(page.getByTestId("resumo-aviso")).toHaveText("Racional da proposta salvo.");
  await semViolacoes(page);
});

test("antes e depois mostra o que muda e o que se resolve", async () => {
  await page.goto(`${endereco}/organograma?ver=comparar`);
  const comp = page.getByTestId("organograma-comparacao");
  await expect(comp).toContainText("Separar o papel de sócio do papel de gestor.");
  await expect(comp).toContainText(`Resolvidos pela proposta: ${CONCENTRACAO}`);
  const mudancas = page.getByTestId("organograma-mudancas");
  await expect(mudancas).toContainText(`Ocupante: ${FUNDADOR} → Gestora Contratada`);
  await expect(mudancas).toContainText("Libera o fundador para a estratégia.");
  await expect(mudancas).toContainText("Papel e critérios passam a ser definidos");
  await semViolacoes(page);
});

test("publicada no portal, o cliente vê a proposta sem as marcações internas", async ({
  browser,
}) => {
  const cliente = await entrarComoCliente(browser, [orgId], "organo-cli");
  try {
    await cliente.page.goto(`/portal/${orgId}`);
    await expect(cliente.page.getByTestId("portal-organograma")).toHaveCount(0);

    await page.goto(`${endereco}/organograma?ver=proposta`);
    await page.getByRole("button", { name: "Publicar no portal do cliente" }).click();
    await expect(page.getByTestId("compartilhar-aviso")).toHaveText(
      "Proposta publicada no portal do cliente.",
    );

    await cliente.page.reload();
    const bloco = cliente.page.getByTestId("portal-organograma");
    await expect(bloco).toContainText("Estrutura proposta pela JC");
    await expect(bloco).toContainText("Separar o papel de sócio do papel de gestor.");
    await expect(bloco).toContainText("Gestora Contratada");
    await expect(bloco).toContainText("Libera o fundador para a estratégia.");
    await expect(bloco).not.toContainText("Sócio(a)");
    await expect(bloco).not.toContainText("Família");
    await semViolacoes(cliente.page);
  } finally {
    await cliente.contexto.close();
  }
});
