import { randomBytes, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { totp } from "./totp";

/**
 * Família e linha do tempo de ponta a ponta contra Supabase local efêmero.
 * Dados 100% fictícios.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.skip(!url || !serviceKey, "Requer Supabase local (job auth-e2e do CI).");
test.describe.configure({ mode: "serial", timeout: 120_000 });

const email = `fam.${randomUUID().slice(0, 8)}@exemplo.test`;
const password = `Aa1${randomBytes(18).toString("base64url")}`;
const nome = `Empresa Fictícia ${randomUUID().slice(0, 6)}`;
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

  await page.goto("/admin/empresas");
  await page.locator("#ne-nome").fill(nome);
  await page.getByRole("button", { name: "Cadastrar empresa" }).click();
  await expect(page).toHaveURL(/\/admin\/empresas\/[0-9a-f-]{36}$/);
  endereco = page.url();
});

test.afterAll(async () => {
  await contexto?.close();
});

async function incluir(campos: {
  nome: string;
  papel: string;
  geracao: string;
  participacao: string;
  sucessao?: string;
}) {
  await page.locator("#nova-nome").fill(campos.nome);
  await page.locator("#nova-papel").selectOption(campos.papel);
  await page.locator("#nova-geracao").fill(campos.geracao);
  await page.locator("#nova-participacao").fill(campos.participacao);
  if (campos.sucessao) await page.locator("#nova-sucessao").selectOption(campos.sucessao);
  await page.getByRole("button", { name: "Incluir pessoa" }).click();
}

test("família: inclui pessoas, resume e respeita o limite de 100%", async () => {
  await page.goto(`${endereco}/familia`);
  await incluir({ nome: "Fundador Fictício", papel: "founder", geracao: "1", participacao: "60" });
  await expect(page.getByTestId("familia-aviso")).toHaveText("Pessoa incluída.");
  await incluir({
    nome: "Herdeira Fictícia",
    papel: "heir",
    geracao: "2",
    participacao: "40",
    sucessao: "potential",
  });
  await expect(page.getByTestId("familia-lista")).toContainText("Herdeira Fictícia");

  const resumo = page.getByTestId("familia-resumo");
  await expect(resumo).toContainText("1ª, 2ª");
  await expect(resumo).toContainText("100%");
  await expect(
    page.getByText("Há sucessores em potencial ou em preparação, mas nenhum definido."),
  ).toBeVisible();

  await incluir({ nome: "Sócio Fictício", papel: "other", geracao: "1", participacao: "5" });
  await expect(page.getByTestId("familia-aviso")).toContainText("não pode passar de 100");
  await expect(page.getByTestId("familia-lista")).not.toContainText("Sócio Fictício");
  await semViolacoes(page);
});

test("família: edita a situação na sucessão", async () => {
  const item = page.getByRole("listitem").filter({ hasText: "Herdeira Fictícia" });
  await item.getByText("Editar").click();
  await item.getByLabel("Situação na sucessão").selectOption("designated");
  await item.getByRole("button", { name: "Salvar" }).click();
  await expect(item.getByText("Sucessor(a) definido(a)").first()).toBeVisible();
  await expect(page.getByTestId("familia-resumo")).toContainText("1 definido(s)");
});

test("histórico: registra decisão e mostra a linha do tempo", async () => {
  await page.goto(`${endereco}/historico`);
  await page.locator("#reg-tipo").selectOption("decision");
  await page.locator("#reg-resumo").fill("Decisão fictícia: iniciar o plano de sucessão.");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByTestId("historico-aviso")).toHaveText("Registrado no histórico.");
  const linha = page.getByTestId("historico-linha");
  await expect(linha).toContainText("Decisão fictícia: iniciar o plano de sucessão.");
  await expect(linha).toContainText("Decisão");
  await semViolacoes(page);
});
