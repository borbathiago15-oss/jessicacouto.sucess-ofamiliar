import { randomUUID } from "node:crypto";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { entrarComo, semViolacoes, serviceKey, supabaseUrl } from "./sessao";

/**
 * Funil e agenda de ponta a ponta contra Supabase local efêmero, com o papel de
 * RELACIONAMENTO (não administradora), para exercitar as regras de acesso reais.
 * Dados 100% fictícios.
 */
test.skip(!supabaseUrl || !serviceKey, "Requer Supabase local (job auth-e2e do CI).");
test.describe.configure({ mode: "serial", timeout: 120_000 });

const sufixo = randomUUID().slice(0, 6);
const empresa = `Empresa Fictícia ${sufixo}`;
const projeto = `Projeto fictício ${sufixo}`;
const tarefa = `Tarefa fictícia ${sufixo}`;
let contexto: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }) => {
  ({ contexto, page } = await entrarComo(browser, "relationship", "funil"));
});
test.afterAll(async () => {
  await contexto?.close();
});

test("relacionamento cadastra empresa (sem ser administradora)", async () => {
  await page.goto("/admin/empresas");
  await page.locator("#ne-nome").fill(empresa);
  await page.getByRole("button", { name: "Cadastrar empresa" }).click();
  await expect(page).toHaveURL(/\/admin\/empresas\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(empresa);
  // Análises e cofre são restritos à administradora.
  await expect(page.getByText("Raio-X Financeiro")).toHaveCount(0);
});

test("funil: cria, define próxima ação e move de etapa", async () => {
  await page.goto("/admin/funil");
  await page.locator("#op-empresa").selectOption({ label: empresa });
  await page.locator("#op-titulo").fill(projeto);
  await page.locator("#op-valor").fill("50.000");
  await page.getByRole("button", { name: "Criar oportunidade" }).click();
  await expect(page.getByTestId("funil-aviso")).toHaveText("Oportunidade criada.");

  const novo = page.getByRole("region", { name: "Novo contato" });
  const cartao = novo.getByRole("listitem").filter({ hasText: projeto });
  await expect(cartao).toContainText("R$ 50.000");
  await expect(cartao).toContainText("Sem próxima ação");
  await semViolacoes(page);

  await cartao.getByText("Editar ou mover").click();
  await cartao.getByLabel("Próxima ação", { exact: true }).fill("Enviar proposta");
  await cartao.getByLabel("Data da próxima ação").fill("2020-01-15");
  await cartao.getByLabel("Etapa").selectOption({ label: "Proposta enviada" });
  await cartao.getByRole("button", { name: "Salvar" }).click();

  const proposta = page
    .getByRole("region", { name: "Proposta enviada" })
    .getByRole("listitem")
    .filter({ hasText: projeto });
  await expect(proposta).toContainText("15/01/2020: Enviar proposta (atrasada)");
  await expect(novo.getByRole("listitem").filter({ hasText: projeto })).toHaveCount(0);
});

test("funil: perder exige motivo", async () => {
  const cartao = page
    .getByRole("region", { name: "Proposta enviada" })
    .getByRole("listitem")
    .filter({ hasText: projeto });
  await cartao.getByText("Editar ou mover").click();
  await cartao.getByLabel("Etapa").selectOption({ label: "Não avançou" });
  await cartao.getByLabel("Motivo do encerramento").fill("Sem orçamento este ano");
  await cartao.getByRole("button", { name: "Salvar" }).click();
  const perdido = page
    .getByRole("region", { name: "Não avançou" })
    .getByRole("listitem")
    .filter({ hasText: projeto });
  await expect(perdido).toContainText("Motivo: Sem orçamento este ano");
});

test("agenda: tarefa atrasada aparece e pode ser concluída", async () => {
  await page.goto("/admin/agenda");
  await page.locator("#tar-empresa").selectOption({ label: empresa });
  await page.locator("#tar-resumo").fill(tarefa);
  await page.locator("#tar-prazo").fill("2020-02-01");
  await page.getByRole("button", { name: "Criar tarefa" }).click();
  await expect(page.getByTestId("agenda-aviso")).toHaveText("Tarefa criada.");

  const atrasadas = page.getByTestId("agenda-atrasadas");
  await expect(atrasadas).toContainText(tarefa);
  // A oportunidade encerrada não aparece mais como próxima ação.
  await expect(page.getByText("Enviar proposta")).toHaveCount(0);
  await semViolacoes(page);

  await atrasadas.getByRole("button", { name: `Concluir ${tarefa}` }).click();
  await expect(page.getByText(tarefa)).toHaveCount(0);
});

test("histórico da empresa recebe os movimentos do funil", async () => {
  await page.goto("/admin/empresas?ver=todas");
  await page.getByRole("link", { name: empresa }).click();
  await page.getByRole("link", { name: "Abrir o histórico" }).click();
  const linha = page.getByTestId("historico-linha");
  await expect(linha).toContainText(`Oportunidade "${projeto}" aberta em Novo contato.`);
  await expect(linha).toContainText("passou para Não avançou. Motivo: Sem orçamento este ano");
  await expect(linha).toContainText(tarefa);
});
