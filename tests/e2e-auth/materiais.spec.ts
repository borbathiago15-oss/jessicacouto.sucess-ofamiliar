import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { entrarComo, semViolacoes, serviceKey, supabaseUrl } from "./sessao";

/**
 * Guia gratuito de ponta a ponta contra Supabase local efêmero: a JC envia o PDF e
 * coloca no site; uma pessoa se cadastra, baixa o arquivo e aparece nos pedidos.
 * PDF e dados 100% fictícios.
 */
test.skip(!supabaseUrl || !serviceKey, "Requer Supabase local (job auth-e2e do CI).");
test.describe.configure({ mode: "serial", timeout: 180_000 });

const sufixo = randomUUID().slice(0, 6);
const titulo = `Guia fictício ${sufixo}`;
const nome = `Leitora Fictícia ${sufixo}`;
const email = `guia.${sufixo}@exemplo.test`;
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);

test.beforeAll(async () => {
  const s = createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false } });
  // Outros materiais ativos de execuções anteriores saem do site.
  await s.from("materials").update({ is_active: false }).eq("is_active", true);
  const aviso = await s
    .from("privacy_notice_versions")
    .select("id")
    .not("published_at", "is", null)
    .limit(1);
  if (!aviso.data?.length)
    await s.from("privacy_notice_versions").insert({
      version: `e2e-mat-${sufixo}`,
      summary: "Aviso fictício",
      published_at: new Date().toISOString(),
    });
});

test("a JC envia o PDF e coloca o guia no site", async ({ browser }) => {
  const { contexto, page } = await entrarComo(browser, "admin", "mat-jc");
  try {
    await page.goto("/admin");
    await page.getByRole("link", { name: "Guias e materiais" }).click();
    await page.getByLabel("Título").fill(titulo);
    await page.getByLabel(/Descrição curta/).fill("Descrição fictícia do guia.");
    await page.getByLabel(/Arquivo PDF/).setInputFiles({
      name: "guia.pdf",
      mimeType: "application/pdf",
      buffer: PDF,
    });
    await page.getByRole("button", { name: "Salvar material" }).click();
    await expect(page.getByTestId("material-novo-aviso")).toContainText("Material salvo");
    const item = page
      .getByTestId("materiais-lista")
      .getByRole("listitem")
      .filter({ hasText: titulo });
    await expect(item).toContainText("Fora do site");
    await item.getByRole("button", { name: "Colocar no site" }).click();
    await expect(item.getByTestId("material-site-aviso")).toHaveText("O material está no site.");
    await semViolacoes(page);
  } finally {
    await contexto.close();
  }
});

test("uma pessoa se cadastra e baixa o guia; a JC vê o pedido", async ({ browser }) => {
  const contexto = await browser.newContext();
  const page = await contexto.newPage();
  try {
    await page.goto("/guias");
    await expect(page.getByRole("heading", { name: "Receba o guia" })).toBeVisible();
    await semViolacoes(page);
    await page.getByLabel("Seu nome").fill(nome);
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Seu papel na empresa familiar").selectOption("successor");
    // Quem se cadastra de verdade leva alguns segundos.
    await page.waitForTimeout(3500);
    await page.getByRole("button", { name: "Receber o guia" }).click();
    const pronto = page.getByTestId("material-pronto");
    await expect(pronto).toContainText(titulo);
    const link = await pronto
      .getByRole("link", { name: "Baixar o guia (PDF)" })
      .getAttribute("href");
    expect(link).toMatch(/^\/guias\/baixar\/[0-9a-f-]{36}$/);
    const resposta = await page.request.get(link!);
    expect(resposta.status()).toBe(200);
    expect(resposta.headers()["content-type"]).toBe("application/pdf");
    expect((await resposta.body()).subarray(0, 5).toString()).toBe("%PDF-");

    // Link inválido volta para o cadastro.
    const invalido = await page.request.get(`/guias/baixar/${randomUUID()}`, { maxRedirects: 0 });
    expect(invalido.status()).toBe(303);
  } finally {
    await contexto.close();
  }

  const jc = await entrarComo(browser, "admin", "mat-jc2");
  try {
    await jc.page.goto("/admin/materiais");
    await expect(jc.page.getByTestId("materiais-pedidos")).toContainText(nome);
    await expect(jc.page.getByTestId("materiais-pedidos")).toContainText(titulo);
  } finally {
    await jc.contexto.close();
  }
});
