import { randomUUID } from "node:crypto";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { entrarComo, semViolacoes, serviceKey, supabaseUrl } from "./sessao";

/**
 * Artigos e página de serviços de ponta a ponta contra Supabase local efêmero.
 * Textos 100% fictícios.
 */
test.skip(!supabaseUrl || !serviceKey, "Requer Supabase local (job auth-e2e do CI).");
test.describe.configure({ mode: "serial", timeout: 150_000 });

const sufixo = randomUUID().slice(0, 6);
const titulo = `Artigo fictício sobre sucessão ${sufixo}`;
const resumo = `Resumo fictício do artigo ${sufixo}.`;
let contexto: BrowserContext;
let page: Page;
let endereco = "";

test.beforeAll(async ({ browser }) => {
  ({ contexto, page } = await entrarComo(browser, "admin", "artigos"));
});
test.afterAll(async () => {
  await contexto?.close();
});

test("o site mostra o artigo de exemplo publicado e a página de serviços", async ({ browser }) => {
  const anon = await browser.newContext();
  const p = await anon.newPage();
  await p.goto("/artigos");
  await expect(p.getByRole("link", { name: "Artigo de exemplo" })).toBeVisible();
  await p.getByRole("link", { name: "Artigo de exemplo" }).click();
  await expect(p.getByRole("heading", { level: 1 })).toHaveText("Artigo de exemplo");
  await expect(p.getByText("Resumo fictício de um artigo de exemplo.")).toBeVisible();
  await expect(p.getByRole("link", { name: "Fazer o diagnóstico" })).toBeVisible();
  await semViolacoes(p);

  await p.goto("/servicos");
  await expect(p.getByRole("heading", { name: "Serviços de exemplo" })).toBeVisible();
  await expect(p.getByText("Descrição fictícia de entrega.").first()).toBeVisible();
  await semViolacoes(p);
  await anon.close();
});

test("cria o artigo, edita resumo e tema, e rascunho não aparece no site", async ({ browser }) => {
  await page.goto("/admin/conteudo");
  await page.getByLabel("Título do novo artigo").fill(titulo);
  await page.getByRole("button", { name: "Criar artigo" }).click();
  await expect(page).toHaveURL(/\/admin\/conteudo\/artigos\/artigo-ficticio-sobre-sucessao-/);
  endereco = new URL(page.url()).pathname.replace("/admin/conteudo", "");

  await page.locator("#art-resumo").fill(resumo);
  await page.locator("#art-tema").selectOption("riscos");
  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByTestId("editor-aviso")).toHaveText("Rascunho salvo.");
  await semViolacoes(page);

  const anon = await browser.newContext();
  const r = await anon.request.get(endereco);
  expect(r.status()).toBe(404);
  await anon.close();
});

test("publicar leva o artigo ao site, com tema, resumo e chamada para o diagnóstico", async ({
  browser,
}) => {
  await page.getByRole("button", { name: "Enviar para revisão" }).click();
  await expect(page.getByTestId("editor-aviso")).toHaveText("Enviado para revisão.");
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByTestId("editor-aviso")).toHaveText("Publicado no site.");

  const anon = await browser.newContext();
  const p = await anon.newPage();
  await p.goto("/artigos?tema=riscos");
  await expect(p.getByRole("link", { name: titulo })).toBeVisible();
  await p.goto(endereco);
  await expect(p.getByRole("heading", { level: 1 })).toHaveText(titulo);
  await expect(p.getByText(resumo)).toBeVisible();
  await expect(p.getByRole("link", { name: "Riscos de não planejar" })).toBeVisible();
  await expect(p.getByRole("region", { name: "Próximo passo" })).toBeVisible();
  await anon.close();
});
