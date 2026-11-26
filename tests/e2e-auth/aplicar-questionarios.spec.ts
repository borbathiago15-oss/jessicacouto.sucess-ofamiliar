import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { entrarComo, semViolacoes, serviceKey, supabaseUrl } from "./sessao";

/**
 * Aplicação de questionário de ponta a ponta contra Supabase local efêmero:
 * a equipe gera o link, a pessoa responde sem conta (salva, volta e conclui)
 * e o resultado aparece para a equipe. Conteúdo 100% fictício.
 */
test.skip(!supabaseUrl || !serviceKey, "Requer Supabase local (job auth-e2e do CI).");
test.describe.configure({ mode: "serial", timeout: 180_000 });

const sufixo = randomUUID().slice(0, 6);
const empresa = `Empresa Fictícia Q ${sufixo}`;
const titulo = `Questionário fictício ${sufixo}`;
const org = randomUUID();
let jc: { contexto: BrowserContext; page: Page };
let link = "";

test.beforeAll(async ({ browser }) => {
  const s = createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false } });
  const ok = <T extends { error: unknown }>(r: T) => {
    if (r.error) throw r.error;
    return r;
  };
  const aprovador = await s.auth.admin.createUser({
    email: `aprova.${sufixo}@exemplo.test`,
    email_confirm: true,
  });
  if (aprovador.error || !aprovador.data.user) throw aprovador.error;

  ok(await s.from("organizations").insert({ id: org, trade_name: empresa }));
  const instr = randomUUID();
  const quest = randomUUID();
  const versao = randomUUID();
  const dim = randomUUID();
  const p1 = randomUUID();
  const p2 = randomUUID();
  ok(
    await s
      .from("instruments")
      .insert({ id: instr, key: `instr_${sufixo}`, name: `Instrumento ${sufixo}` }),
  );
  ok(await s.from("questionnaires").insert({ id: quest, instrument_id: instr, title: titulo }));
  ok(
    await s
      .from("questionnaire_versions")
      .insert({ id: versao, questionnaire_id: quest, version_number: 1 }),
  );
  ok(
    await s
      .from("dimensions")
      .insert({ id: dim, version_id: versao, key: "dim_a", title: "Dimensão fictícia" }),
  );
  ok(
    await s.from("questions").insert([
      {
        id: p1,
        version_id: versao,
        dimension_id: dim,
        key: "p1",
        prompt: "Pergunta fictícia de escala",
        kind: "scale",
        is_required: true,
        position: 1,
      },
      {
        id: p2,
        version_id: versao,
        dimension_id: null,
        key: "p2",
        prompt: "Comentário fictício",
        kind: "long_text",
        is_required: false,
        position: 2,
      },
    ]),
  );
  ok(
    await s.from("question_options").insert([
      { question_id: p1, label: "Nunca", value: 0, position: 1 },
      { question_id: p1, label: "Às vezes", value: 2, position: 2 },
      { question_id: p1, label: "Sempre", value: 4, position: 3 },
    ]),
  );
  ok(
    await s
      .from("questionnaire_versions")
      .update({ status: "published", approved_by: aprovador.data.user.id })
      .eq("id", versao),
  );

  jc = await entrarComo(browser, "admin", "aplicar");
});
test.afterAll(async () => {
  await jc?.contexto.close();
});

test("equipe gera o link de resposta", async () => {
  const page = jc.page;
  await page.goto(`/admin/empresas/${org}`);
  await page.getByRole("link", { name: "Abrir os questionários" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Questionários");
  await semViolacoes(page);

  await page.locator("#ql-versao").selectOption({ label: `${titulo} · versão 1` });
  await page.getByLabel("Identificação do respondente").fill("Respondente Fictício");
  await page.getByRole("button", { name: "Gerar link de resposta" }).click();
  await expect(page.getByTestId("questionario-link-aviso")).toContainText("Link pronto");
  link = await page.getByTestId("questionario-link").inputValue();
  expect(link).toMatch(/\/responder\/[0-9a-f]{64}$/);
});

test("pessoa responde sem conta: salva, volta e conclui", async ({ browser }) => {
  const contexto = await browser.newContext();
  const p = await contexto.newPage();
  try {
    const caminho = new URL(link).pathname;
    await p.goto(caminho);
    await expect(p.getByRole("heading", { level: 1 })).toHaveText(titulo);
    await semViolacoes(p);

    // Concluir sem a obrigatória não passa.
    await p.getByRole("button", { name: "Concluir e enviar" }).click();
    await expect(p.getByTestId("resposta-aviso")).toContainText("precisam de atenção");

    await p.getByLabel("Comentário fictício").fill("Texto fictício de teste");
    await p.getByRole("button", { name: "Salvar e continuar depois" }).click();
    await expect(p.getByTestId("resposta-aviso")).toContainText("Respostas salvas");

    await p.goto(caminho);
    await expect(p.getByLabel("Comentário fictício")).toHaveValue("Texto fictício de teste");
    await p.getByLabel("Sempre").check();
    await p.getByRole("button", { name: "Concluir e enviar" }).click();
    await expect(p.getByTestId("resposta-concluida")).toBeVisible();

    await p.goto(caminho);
    await expect(p.getByTestId("resposta-indisponivel")).toContainText("já foi respondido");
  } finally {
    await contexto.close();
  }
});

test("equipe vê a resposta e o resultado", async () => {
  const page = jc.page;
  await page.goto(`/admin/empresas/${org}/questionarios`);
  const linha = page.getByTestId("questionario-sessoes").getByRole("row", {
    name: /Respondente Fictício/,
  });
  await expect(linha).toContainText("Respondido");
  await expect(linha).toContainText("100 de 100");
  await expect(page.getByTestId("questionario-consolidado")).toContainText("Dimensão fictícia");
});

test("link inexistente não revela nada", async ({ page }) => {
  await page.goto(`/responder/${"a".repeat(64)}`);
  await expect(page.getByTestId("resposta-indisponivel")).toContainText("Link não encontrado");
});
