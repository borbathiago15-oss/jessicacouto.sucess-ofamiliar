import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { diagnosticoFicticio } from "../fixtures/diagnostico-ficticio";
import { entrarComo, semViolacoes, serviceKey, supabaseUrl } from "./sessao";

/**
 * Diagnóstico de Sucessão de ponta a ponta contra Supabase local efêmero: uma
 * pessoa responde no site sem login, vê a leitura dela (sem a classificação) e a
 * JC encontra a resposta no CRM com o nível e os motivos. Conteúdo 100% fictício.
 */
test.skip(!supabaseUrl || !serviceKey, "Requer Supabase local (job auth-e2e do CI).");
test.describe.configure({ mode: "serial", timeout: 180_000 });

const sufixo = randomUUID().slice(0, 6);
const nome = `Pessoa Fictícia ${sufixo}`;
const email = `diag.${sufixo}@exemplo.test`;

test.beforeAll(async () => {
  const s = createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false } });
  const { data: ultima } = await s
    .from("triage_versions")
    .select("version_number")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const numero = (ultima?.version_number ?? 0) + 1;
  const criada = await s
    .from("triage_versions")
    .insert({ version_number: numero, config: diagnosticoFicticio })
    .select("id")
    .single();
  if (criada.error) throw criada.error;
  const publicada = await s
    .from("triage_versions")
    .update({ status: "published" })
    .eq("id", criada.data.id);
  if (publicada.error) throw publicada.error;
  const aviso = await s
    .from("privacy_notice_versions")
    .select("id")
    .not("published_at", "is", null)
    .limit(1);
  if (!aviso.data?.length)
    await s.from("privacy_notice_versions").insert({
      version: `e2e-${sufixo}`,
      summary: "Aviso fictício",
      published_at: new Date().toISOString(),
    });
});

test("uma pessoa responde no site e recebe a leitura, sem a classificação", async ({ browser }) => {
  const contexto = await browser.newContext();
  const page = await contexto.newPage();
  try {
    await page.goto("/diagnostico");
    await expect(
      page.getByRole("heading", { name: "Diagnóstico fictício", level: 1 }),
    ).toBeVisible();
    await semViolacoes(page);

    // Continuar sem responder avisa.
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Escolha uma opção para continuar.")).toBeVisible();

    await page.getByLabel("Papel fictício A").check();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Prazo fictício curto").check();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Risco fictício 1").check();
    await page.getByLabel("Risco fictício 3").check();
    await expect(page.getByLabel("Risco fictício 2")).toBeDisabled();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("textbox").fill("Tema fictício para os próximos 90 dias.");
    await page.getByRole("button", { name: "Continuar" }).click();

    await page.getByLabel("Seu nome").fill(nome);
    await page.getByLabel("E-mail").fill(email);
    await semViolacoes(page);
    // Quem responde de verdade leva alguns segundos.
    await page.waitForTimeout(8500);
    await page.getByRole("button", { name: "Ver o meu resultado" }).click();

    const resultado = page.getByTestId("diagnostico-resultado");
    await expect(resultado).toContainText("obrigada por responder");
    await expect(resultado).toContainText("Abertura fictícia A.");
    await expect(resultado).toContainText("Faria algo fictício sobre o risco 1.");
    await expect(resultado).toContainText("Próximo passo fictício: conversa imediata.");
    await expect(resultado).toContainText("Tema fictício para os próximos 90 dias.");
    await expect(resultado).not.toContainText("Motivo fictício");
    await expect(resultado).not.toContainText("Dor fictícia");
    await semViolacoes(page);
  } finally {
    await contexto.close();
  }
});

test("a JC vê a resposta no CRM com o nível e os motivos", async ({ browser }) => {
  const { contexto, page } = await entrarComo(browser, "admin", "diag-jc");
  try {
    await page.goto("/admin");
    await page.getByRole("link", { name: "Diagnóstico de Sucessão" }).click();
    const respostas = page.getByTestId("diag-respostas");
    const item = respostas.getByRole("listitem").filter({ hasText: nome });
    await expect(item).toContainText("Conversa imediata");
    await expect(item).toContainText("Motivo fictício: prazo curto.");
    await expect(item).toContainText("Motivo fictício: papel A com risco 1.");
    await expect(item).toContainText("Dor fictícia A.");
    await expect(item).toContainText(email);
    await item.getByText("Ver as respostas").click();
    await expect(item).toContainText("Risco fictício 1; Risco fictício 3");
    await semViolacoes(page);

    await page.goto("/admin/funil");
    await expect(page.getByText(`Diagnóstico de Sucessão: ${nome}`)).toBeVisible();

    await page.goto("/admin/diagnostico?ver=conteudo");
    await expect(page.getByTestId("diag-versoes")).toContainText("Publicada");
    await page.getByRole("button", { name: "Conferir" }).click();
    await expect(page.getByTestId("diag-editor-aviso")).toHaveText("Conteúdo válido.");
  } finally {
    await contexto.close();
  }
});
