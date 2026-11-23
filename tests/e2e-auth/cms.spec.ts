import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { totp } from "./totp";

/**
 * CMS de ponta a ponta contra Supabase local efêmero: rascunho não aparece no site,
 * imagem de rascunho não é pública, publicação atualiza a página. Dados fictícios.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;

test.skip(!url || !serviceKey || !dbUrl, "Requer Supabase local (job auth-e2e do CI).");
test.describe.configure({ mode: "serial", timeout: 120_000 });

const email = `cms.${randomUUID().slice(0, 8)}@exemplo.test`;
const password = `Aa1${randomBytes(18).toString("base64url")}`;
const titulo = `Título de teste ${randomUUID().slice(0, 6)}`;
// PNG 1x1 transparente.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
let page: Page;
let caminhoImagem = "";

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

  page = await browser.newPage();
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
  await page?.close();
});

test("o site mostra o conteúdo publicado do seed", async ({ browser }) => {
  const anon = await browser.newPage();
  await anon.goto("/");
  await expect(anon.getByRole("heading", { level: 1 })).toHaveText(
    "Título de exemplo da página inicial",
  );
  await anon.close();
});

test("rascunho com imagem não aparece no site nem expõe a imagem", async ({ browser }) => {
  await page.goto("/admin/conteudo/inicio");
  await page.locator("#b0-titulo").fill(titulo);
  await page
    .locator("#b0-img")
    .setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG });
  const previa = page.locator('section[aria-label="Prévia"] img');
  await expect(previa).toHaveAttribute(
    "src",
    /^\/admin\/midia\/paginas\/inicio\/[0-9a-f-]{36}\.png$/,
  );
  caminhoImagem = ((await previa.getAttribute("src")) ?? "").replace("/admin/midia/", "");

  await page.getByRole("button", { name: "Salvar rascunho" }).click();
  await expect(page.getByTestId("editor-aviso")).toHaveText("Nova versão em rascunho criada.");

  const anon = await browser.newPage();
  await anon.goto("/");
  await expect(anon.getByRole("heading", { level: 1 })).not.toHaveText(titulo);
  const midia = await anon.request.get(`/midia/${caminhoImagem}`);
  expect(midia.status()).toBe(404);
  await anon.close();
});

test("publicação leva o conteúdo e a imagem ao site", async ({ browser }) => {
  await page.getByRole("button", { name: "Enviar para revisão" }).click();
  await expect(page.getByTestId("editor-aviso")).toHaveText("Enviado para revisão.");
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByTestId("editor-aviso")).toHaveText("Publicado no site.");

  const anon = await browser.newPage();
  await anon.goto("/");
  await expect(anon.getByRole("heading", { level: 1 })).toHaveText(titulo);
  const midia = await anon.request.get(`/midia/${caminhoImagem}`);
  expect(midia.status()).toBe(200);
  expect(midia.headers()["content-type"]).toBe("image/png");
  await anon.close();
});

test("canal do titular registra o pedido", async ({ browser }) => {
  const anon = await browser.newPage();
  const emailTitular = `titular.${randomUUID().slice(0, 8)}@exemplo.test`;
  await anon.goto("/privacidade/solicitacao");
  await anon.getByLabel("Nome").fill("Pessoa Fictícia");
  await anon.getByLabel("E-mail").fill(emailTitular);
  await anon.getByLabel("O que você precisa").selectOption("access");
  await anon.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(anon.getByTestId("titular-ok")).toBeVisible();
  await anon.close();

  const total = execFileSync(
    "psql",
    [
      dbUrl!,
      "-X",
      "-A",
      "-t",
      "-c",
      `select count(*) from public.data_subject_requests where email = '${emailTitular}'`,
    ],
    { encoding: "utf8" },
  ).trim();
  expect(total).toBe("1");
});
