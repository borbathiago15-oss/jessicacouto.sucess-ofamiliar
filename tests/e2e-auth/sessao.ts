import { randomBytes, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { totp } from "./totp";

/** Apoio aos testes com Supabase local: usuária fictícia, login com MFA e axe. */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function entrarComo(
  browser: Browser,
  papel: string,
  prefixo: string,
): Promise<{ contexto: BrowserContext; page: Page }> {
  const email = `${prefixo}.${randomUUID().slice(0, 8)}@exemplo.test`;
  const password = `Aa1${randomBytes(18).toString("base64url")}`;
  const admin = createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("Falha ao criar usuária de teste");
  const r = await admin.from("user_roles").insert({ user_id: data.user.id, role_key: papel });
  if (r.error) throw r.error;

  // Contexto explícito: o axe precisa dele para analisar a página.
  const contexto = await browser.newContext();
  const page = await contexto.newPage();
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
  return { contexto, page };
}

export async function semViolacoes(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}
