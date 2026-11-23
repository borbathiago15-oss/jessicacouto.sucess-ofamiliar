import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { entrarComo, entrarComoCliente, semViolacoes, serviceKey, supabaseUrl } from "./sessao";

/**
 * Portal do cliente de ponta a ponta contra Supabase local efêmero.
 * A JC compartilha e publica; o cliente X vê só o que é dele e foi compartilhado,
 * e não alcança a empresa Y nem o painel da equipe. Dados 100% fictícios.
 */
test.skip(!supabaseUrl || !serviceKey, "Requer Supabase local (job auth-e2e do CI).");
test.describe.configure({ mode: "serial", timeout: 180_000 });

const sufixo = randomUUID().slice(0, 6);
const nomeX = `Empresa Fictícia X ${sufixo}`;
const nomeY = `Empresa Fictícia Y ${sufixo}`;
let orgX = "";
let orgY = "";
let docCompartilhado = "";
let docInterno = "";
let jc: { contexto: BrowserContext; page: Page };
let cli: { contexto: BrowserContext; page: Page; email: string };

test.beforeAll(async ({ browser }) => {
  const s = createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false } });
  orgX = randomUUID();
  orgY = randomUUID();
  docCompartilhado = randomUUID();
  docInterno = randomUUID();
  const ok = (r: { error: unknown }) => {
    if (r.error) throw r.error;
  };
  ok(
    await s.from("organizations").insert([
      { id: orgX, trade_name: nomeX },
      { id: orgY, trade_name: nomeY },
    ]),
  );
  ok(
    await s.from("financial_periods").insert({
      organization_id: orgX,
      label: "2025",
      values: { receitaBruta: 1_000_000, cmv: 500_000, despesasPessoais: 30_000, caixa: 100_000 },
    }),
  );
  ok(
    await s.from("priority_items").insert([
      { organization_id: orgX, title: "Ação compartilhada fictícia", shared_with_client: true },
      { organization_id: orgX, title: "Ação interna fictícia", shared_with_client: false },
      { organization_id: orgY, title: "Ação da empresa Y", shared_with_client: true },
    ]),
  );
  for (const [id, nome, compartilhado] of [
    [docCompartilhado, "documento-compartilhado.txt", true],
    [docInterno, "documento-interno.txt", false],
  ] as const) {
    const caminho = `empresas/${orgX}/${id}`;
    ok(
      await s.storage
        .from("vault")
        .upload(caminho, Buffer.from(`conteúdo ${nome}`), { contentType: "text/plain" }),
    );
    ok(
      await s.from("vault_documents").insert({
        id,
        organization_id: orgX,
        storage_path: caminho,
        file_name: nome,
        mime_type: "text/plain",
        size_bytes: 20,
        sha256: "a".repeat(64),
        status: "active",
        shared_with_client: compartilhado,
      }),
    );
  }

  jc = await entrarComo(browser, "admin", "portal-jc");
  cli = await entrarComoCliente(browser, [orgX], "portal-cliente");
});
test.afterAll(async () => {
  await jc?.contexto.close();
  await cli?.contexto.close();
});

test("JC publica o relatório e vê o que o cliente verá", async () => {
  const page = jc.page;
  await page.goto(`/admin/empresas/${orgX}/relatorio`);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Publicar para o cliente" }).click();
  await expect(page.getByTestId("publicar-aviso")).toHaveText(
    "Relatório publicado no portal do cliente.",
  );

  await page.goto(`/admin/empresas/${orgX}/portal`);
  await expect(page.getByTestId("portal-membros")).toContainText(cli.email);
  await expect(page.getByTestId("portal-publicacoes")).toContainText("Relatório Executivo");
  await semViolacoes(page);

  await page.getByRole("link", { name: "Ver como o cliente vê" }).click();
  await expect(page.getByTestId("portal-plano")).toContainText("Ação compartilhada fictícia");
  await expect(page.getByTestId("portal-plano")).not.toContainText("Ação interna fictícia");
});

test("cliente vê só a própria empresa e só o que foi compartilhado", async () => {
  const page = cli.page;
  await page.goto("/portal");
  await expect(page).toHaveURL(new RegExp(`/portal/${orgX}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(nomeX);
  const visao = page.getByTestId("portal-visao");
  await expect(visao).toContainText("Ação compartilhada fictícia");
  await expect(visao).not.toContainText("Ação interna fictícia");
  await expect(visao).not.toContainText("Ação da empresa Y");
  await expect(page.getByTestId("portal-documentos")).toContainText("documento-compartilhado.txt");
  await expect(page.getByTestId("portal-documentos")).not.toContainText("documento-interno.txt");
  await semViolacoes(page);

  await page.getByTestId("portal-relatorios").getByRole("link").first().click();
  await expect(
    page.getByTestId("relatorio-executivo").getByRole("heading", { level: 1 }),
  ).toHaveText(nomeX);
});

test("cliente baixa só o documento compartilhado", async () => {
  const req = cli.page.request;
  const ok = await req.get(`/portal/${orgX}/documentos/${docCompartilhado}`);
  expect(ok.status()).toBe(200);
  expect(await ok.text()).toBe("conteúdo documento-compartilhado.txt");
  expect((await req.get(`/portal/${orgX}/documentos/${docInterno}`)).status()).toBe(404);
  // Nem pelo endereço do painel da equipe.
  expect((await req.get(`/admin/empresas/${orgX}/cofre/${docInterno}`)).status()).not.toBe(200);
});

test("cliente não alcança a empresa Y nem o painel da equipe", async () => {
  const page = cli.page;
  const y = await page.goto(`/portal/${orgY}`);
  expect(y?.status()).toBe(404);
  await page.goto("/admin");
  await expect(page).toHaveURL(new RegExp(`/portal/${orgX}$`));
  await page.goto(`/admin/empresas/${orgX}`);
  await expect(page.getByText(nomeX)).toHaveCount(0);
});

test("JC retira o acesso e o cliente deixa de ver a empresa", async () => {
  const page = jc.page;
  await page.goto(`/admin/empresas/${orgX}/portal`);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: `Retirar acesso de ${cli.email}` }).click();
  await expect(page.getByTestId("retirar-aviso")).toContainText("Acesso retirado");

  const r = await cli.page.goto(`/portal/${orgX}`);
  expect(r?.status()).toBe(404);
  await cli.page.goto("/portal");
  await expect(cli.page.getByTestId("portal-sem-acesso")).toBeVisible();
});
