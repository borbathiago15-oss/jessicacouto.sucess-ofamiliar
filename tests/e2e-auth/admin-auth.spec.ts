import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { currentStep, totp } from "./totp";

/**
 * Fluxo real de autenticação do /admin contra um Supabase local efêmero (CI).
 * Usuário fictício criado pela API administrativa; nenhum dado real.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = process.env.SUPABASE_DB_URL;

test.skip(!url || !serviceKey || !dbUrl, "Requer Supabase local (job auth-e2e do CI).");
test.describe.configure({ mode: "serial", timeout: 120_000 });

const email = `admin.${randomUUID().slice(0, 8)}@exemplo.test`;
// Senha aleatória gerada em tempo de execução (atende às regras de complexidade).
const password = `Aa1${randomBytes(18).toString("base64url")}`;
let userId = "";
let secret = "";
let lastUsedStep = -1;

test.beforeAll(async () => {
  const admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("Falha ao criar usuário de teste");
  userId = data.user.id;
  const grant = await admin.from("user_roles").insert({ user_id: userId, role_key: "admin" });
  if (grant.error) throw grant.error;
});

async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

/** Um código TOTP não deve ser reutilizado: espera o próximo intervalo se preciso. */
async function freshCode(): Promise<string> {
  while (currentStep() <= lastUsedStep) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  lastUsedStep = currentStep();
  return totp(secret);
}

test("sem sessão, o /admin exige login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("senha errada é recusada com mensagem genérica", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(`${password}x`);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert")).toHaveText("E-mail ou senha inválidos.");
});

test("primeiro acesso: senha correta exige cadastrar o autenticador", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/admin\/mfa\/cadastrar$/);

  // Em AAL1 o painel continua bloqueado.
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/mfa\/cadastrar$/);

  await page.getByRole("button", { name: "Gerar código QR" }).click();
  secret = (await page.getByTestId("totp-secret").textContent())?.trim() ?? "";
  expect(secret).toMatch(/^[A-Z2-7]+=*$/);

  await page.getByLabel("Código de 6 dígitos").fill(await freshCode());
  await page.getByRole("button", { name: "Confirmar" }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByTestId("roles")).toContainText("Administradora");
  await expect(page.getByTestId("permission-count")).toContainText(
    "verificação em duas etapas concluída",
  );
});

test("novo login exige o código do autenticador; código errado é recusado", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/admin\/mfa\/verificar$/);

  // Cadastrar outro autenticador sem verificar o atual não é permitido.
  await page.goto("/admin/mfa/cadastrar");
  await expect(page).toHaveURL(/\/admin\/mfa\/verificar/);

  await page.getByLabel("Código").fill(totp(secret, Date.now(), 100));
  await page.getByRole("button", { name: "Verificar" }).click();
  await expect(page.getByRole("alert")).toHaveText("Código inválido ou expirado.");

  await page.getByLabel("Código").fill(await freshCode());
  await page.getByRole("button", { name: "Verificar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByTestId("roles")).toContainText("Administradora");
});

test("sessão revogada no banco perde o acesso imediatamente", async ({ page }) => {
  await login(page);
  await page.getByLabel("Código").fill(await freshCode());
  await page.getByRole("button", { name: "Verificar" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  // Revogação administrativa (equivalente a public.admin_revoke_user_sessions).
  execFileSync(
    "psql",
    [
      dbUrl!,
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `delete from auth.sessions where user_id = '${userId}'`,
    ],
    {
      stdio: "ignore",
    },
  );

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("sair encerra a sessão", async ({ page }) => {
  await login(page);
  await page.getByLabel("Código").fill(await freshCode());
  await page.getByRole("button", { name: "Verificar" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});
