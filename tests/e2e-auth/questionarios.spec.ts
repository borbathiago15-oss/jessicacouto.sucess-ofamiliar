import { randomBytes, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { totp } from "./totp";

/**
 * Construtor de questionários de ponta a ponta contra Supabase local efêmero:
 * criar, montar com condição, prévia, publicar (imutável) e nova versão.
 * Conteúdo 100% fictício.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

test.skip(!url || !serviceKey, "Requer Supabase local (job auth-e2e do CI).");
test.describe.configure({ mode: "serial", timeout: 120_000 });

const email = `quest.${randomUUID().slice(0, 8)}@exemplo.test`;
const password = `Aa1${randomBytes(18).toString("base64url")}`;
const titulo = `Questionário de teste ${randomUUID().slice(0, 6)}`;
let contexto: BrowserContext;
let page: Page;
let endereco = "";

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

  // Contexto explícito: o axe precisa dele para analisar a página.
  contexto = await browser.newContext();
  page = await contexto.newPage();
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin\/mfa\/cadastrar$/);
  await page.getByRole("button", { name: "Gerar código QR" }).click();
  const segredo = (await page.getByTestId("totp-secret").textContent())?.trim() ?? "";
  // Evita gerar o código nos últimos segundos do intervalo de 30 s.
  const resto = Date.now() % 30000;
  if (resto > 26000) await page.waitForTimeout(30000 - resto + 300);
  await page.getByLabel("Código de 6 dígitos").fill(totp(segredo));
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
});

test.afterAll(async () => {
  await contexto?.close();
});

test("cria questionário e abre a versão 1 em rascunho", async () => {
  await page.goto("/admin/questionarios");
  await page.locator("#nq-instrumento").selectOption({ label: "Instrumento de exemplo" });
  await page.getByLabel("Título do questionário").fill(titulo);
  await page.getByRole("button", { name: "Criar questionário" }).click();
  await expect(page).toHaveURL(/\/admin\/questionarios\/[0-9a-f-]{36}\/v\/1$/);
  endereco = page.url().replace(/\/v\/1$/, "");
  await expect(page.getByText("Rascunho", { exact: true })).toBeVisible();
});

test("monta perguntas com condição e a prévia segue a condição", async () => {
  await page.getByRole("button", { name: "Adicionar pergunta" }).click();
  await page.locator("#q0-prompt").fill("Pergunta fictícia 1");
  await page.getByRole("button", { name: "Adicionar pergunta" }).click();
  await page.locator("#q1-prompt").fill("Pergunta fictícia 2");
  await page.locator("#q1-tipo").selectOption("short_text");
  await page.locator("#q1-cond").selectOption("p1");
  await page.locator("#q1-cond-0").check(); // "Sim"

  const previa = page.getByRole("region", { name: "Prévia do questionário" });
  await expect(previa.getByText("Pergunta fictícia 2")).toBeHidden();
  await previa.getByLabel("Sim").check();
  await expect(previa.getByText("Pergunta fictícia 2")).toBeVisible();
  await previa.getByLabel("Não").check();
  await expect(previa.getByText("Pergunta fictícia 2")).toBeHidden();

  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByTestId("editor-aviso")).toHaveText("Rascunho salvo.");

  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
});

test("o conteúdo salvo volta igual ao recarregar", async () => {
  await page.reload();
  await expect(page.locator("#q0-prompt")).toHaveValue("Pergunta fictícia 1");
  await expect(page.locator("#q1-cond")).toHaveValue("p1");
});

test("publicar trava a versão; nova versão começa como cópia", async () => {
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByTestId("editor-aviso")).toHaveText("Versão publicada.");
  await expect(page.getByText("Publicada", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvar rascunho" })).toHaveCount(0);
  await expect(page.locator("#q0-prompt")).toBeDisabled();

  await page.goto(endereco);
  await page.getByRole("button", { name: "Criar nova versão" }).click();
  await expect(page).toHaveURL(/\/v\/2$/);
  await expect(page.locator("#q0-prompt")).toHaveValue("Pergunta fictícia 1");
  await expect(page.locator("#q0-prompt")).toBeEnabled();
});
