import { randomBytes, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { totp } from "./totp";

/**
 * Empresas, Raio-X Financeiro e Cofre de ponta a ponta contra Supabase local
 * efêmero. Dados 100% fictícios.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.skip(!url || !serviceKey, "Requer Supabase local (job auth-e2e do CI).");
test.describe.configure({ mode: "serial", timeout: 120_000 });

const email = `emp.${randomUUID().slice(0, 8)}@exemplo.test`;
const password = `Aa1${randomBytes(18).toString("base64url")}`;
const nome = `Empresa Fictícia ${randomUUID().slice(0, 6)}`;
const conteudo = `Documento fictício ${randomUUID()}`;
let contexto: BrowserContext;
let page: Page;
let endereco = "";

async function semViolacoes(p: Page) {
  const { violations } = await new AxeBuilder({ page: p })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  const admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("Falha ao criar usuária de teste");
  const r = await admin.from("user_roles").insert({ user_id: data.user.id, role_key: "admin" });
  if (r.error) throw r.error;

  contexto = await browser.newContext();
  page = await contexto.newPage();
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin\/mfa\/cadastrar$/);
  await page.getByRole("button", { name: "Gerar código QR" }).click();
  const segredo = (await page.getByTestId("totp-secret").textContent())?.trim() ?? "";
  const resto = Date.now() % 30000;
  if (resto > 26000) await page.waitForTimeout(30000 - resto + 300);
  await page.getByLabel("Código de 6 dígitos").fill(totp(segredo));
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
});

test.afterAll(async () => {
  await contexto?.close();
});

test("cadastra a empresa e abre a ficha", async () => {
  await page.goto("/admin/empresas");
  await page.locator("#ne-nome").fill(nome);
  await page.getByRole("button", { name: "Cadastrar empresa" }).click();
  await expect(page).toHaveURL(/\/admin\/empresas\/[0-9a-f-]{36}$/);
  endereco = page.url();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(nome);
});

test("Raio-X: calcula ao digitar, salva e mantém ao recarregar", async () => {
  await page.goto(`${endereco}/raio-x`);
  await page.locator("#novo-periodo").fill("2025");
  await page.getByRole("button", { name: "Adicionar período" }).click();

  // Resposta de uma IA colada: preenche os campos para conferência, sem salvar.
  await page.getByText("Tenho um PDF: preencher com a ajuda de uma IA").click();
  await expect(page.getByTestId("ia-instrucoes")).toHaveValue(/receitaBruta:/);
  await page
    .getByLabel("2. Cole aqui a resposta da IA")
    .fill("- **estoques:** R$ 350.000,00
caixa: 100000
meses: 12
observacoes: teste fictício");
  await page.getByRole("button", { name: "Preencher os campos" }).click();
  await expect(page.getByTestId("ia-resultado")).toContainText("2 de 23 campos preenchidos");
  await expect(page.locator("#c-estoques")).toHaveValue("350.000,00");

  const valores: Record<string, string> = {
    receitaBruta: "10.000.000,00",
    deducoes: "1.500.000",
    cmv: "5.200.000",
    despesasOperacionais: "1.900.000",
    proLabore: "480000",
    salariosFamiliares: "240000",
    despesasPessoais: "120000",
    distribuicoes: "600000",
  };
  for (const [k, v] of Object.entries(valores)) await page.locator(`#c-${k}`).fill(v);

  const kpis = page.getByTestId("raiox-kpis");
  await expect(kpis).toContainText("8.500.000"); // receita líquida
  await expect(kpis).toContainText("560.000"); // EBITDA
  await expect(page.getByTestId("raiox-alertas")).toContainText(
    "A família retira mais do que a empresa gera",
  );

  await page.getByRole("button", { name: "Salvar período" }).click();
  await expect(page.getByTestId("raiox-aviso")).toHaveText("Período criado.");
  await semViolacoes(page);

  await page.reload();
  await expect(page.locator("#c-receitaBruta")).toHaveValue("10.000.000,00");
  await expect(page.getByTestId("raiox-kpis")).toContainText("560.000");
});

test("relatório do Raio-X mostra a empresa e os indicadores", async () => {
  await page.goto(`${endereco}/raio-x/relatorio`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(nome);
  await expect(page.getByTestId("raiox-kpis")).toContainText("8.500.000");
  await semViolacoes(page);
});

test("cofre: guarda, baixa com registro e exclui com comprovante", async () => {
  await page.goto(`${endereco}/cofre`);
  await page.locator("#doc-arquivo").setInputFiles({
    name: "contrato-ficticio.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(conteudo),
  });
  await page.getByRole("button", { name: "Guardar no cofre" }).click();
  await expect(page.getByTestId("cofre-envio-aviso")).toHaveText("Documento guardado no cofre.");
  const lista = page.getByTestId("cofre-lista");
  await expect(lista).toContainText("contrato-ficticio.txt");
  await expect(lista).toContainText("Ainda não foi aberto");
  await semViolacoes(page);

  // Download autenticado devolve o mesmo conteúdo.
  const link = await lista.getByRole("link", { name: /Baixar/ }).getAttribute("href");
  const baixado = await page.request.get(link!);
  expect(baixado.status()).toBe(200);
  expect(await baixado.text()).toBe(conteudo);
  expect(baixado.headers()["content-disposition"]).toContain("attachment");

  // Sem sessão, o mesmo endereço não entrega o arquivo.
  const anon = await page.context().browser()!.newContext();
  const semSessao = await anon.request.get(link!, { maxRedirects: 0 });
  expect(semSessao.status()).not.toBe(200);
  await anon.close();

  await page.reload();
  await expect(page.getByTestId("cofre-lista")).toContainText("Aberto 1 vez(es)");

  // Exclusão definitiva: exige a palavra de confirmação.
  await page.getByRole("button", { name: /^Excluir/ }).click();
  await page.getByLabel("Motivo (ex.: pedido do cliente)").fill("Pedido do cliente");
  await page.getByLabel("Para confirmar, digite EXCLUIR").fill("errado");
  await page.getByRole("button", { name: "Excluir definitivamente" }).click();
  await expect(page.getByTestId("cofre-exclusao-aviso")).toHaveText(
    "Digite EXCLUIR para confirmar.",
  );
  await page.getByLabel("Para confirmar, digite EXCLUIR").fill("EXCLUIR");
  await page.getByRole("button", { name: "Excluir definitivamente" }).click();

  await expect(page.getByTestId("cofre-comprovantes")).toContainText("contrato-ficticio.txt");
  await expect(page.getByTestId("cofre-comprovantes")).toContainText("Pedido do cliente");
  await expect(page.getByTestId("cofre-lista")).toHaveCount(0);

  const depois = await page.request.get(link!);
  expect(depois.status()).toBe(404);
});
