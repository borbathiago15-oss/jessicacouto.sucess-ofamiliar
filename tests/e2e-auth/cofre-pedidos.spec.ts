import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { entrarComo, entrarComoCliente, semViolacoes, serviceKey, supabaseUrl } from "./sessao";

/**
 * Pedidos de documentos de ponta a ponta contra Supabase local efêmero.
 * A JC pede; o familiar X1 envia pelo portal; o familiar X2 (mesma empresa) não
 * abre o arquivo; a JC analisa; X1 apaga. Dados 100% fictícios.
 */
test.skip(!supabaseUrl || !serviceKey, "Requer Supabase local (job auth-e2e do CI).");
test.describe.configure({ mode: "serial", timeout: 180_000 });

const sufixo = randomUUID().slice(0, 6);
const nomeX = `Empresa Fictícia Cofre ${sufixo}`;
const pedido = `Contrato social fictício ${sufixo}`;
const arquivo = `contrato-ficticio-${sufixo}.pdf`;
const pdf = Buffer.from("%PDF-1.4\n% documento ficticio de teste\n%%EOF\n");
let orgX = "";
let jc: { contexto: BrowserContext; page: Page };
let x1: { contexto: BrowserContext; page: Page; email: string };
let x2: { contexto: BrowserContext; page: Page; email: string };

test.beforeAll(async ({ browser }) => {
  const s = createClient(supabaseUrl!, serviceKey!, { auth: { persistSession: false } });
  orgX = randomUUID();
  const r = await s.from("organizations").insert({ id: orgX, trade_name: nomeX });
  if (r.error) throw r.error;
  jc = await entrarComo(browser, "admin", "cofre-jc");
  x1 = await entrarComoCliente(browser, [orgX], "cofre-x1");
  x2 = await entrarComoCliente(browser, [orgX], "cofre-x2");
});
test.afterAll(async () => {
  await jc?.contexto.close();
  await x1?.contexto.close();
  await x2?.contexto.close();
});

test("a JC pede um documento à família", async () => {
  const page = jc.page;
  await page.goto(`/admin/empresas/${orgX}/cofre`);
  await page.getByLabel("Documento necessário").fill(pedido);
  await page.getByLabel("Observação para a família (opcional)").fill("Pode ser a versão assinada");
  await page.getByRole("button", { name: "Pedir documento" }).click();
  await expect(page.getByTestId("pedido-aviso")).toContainText("Pedido criado");
  await expect(page.getByTestId("pedidos-lista")).toContainText(pedido);
  await expect(page.getByTestId("pedidos-lista")).toContainText("Pendente");
  await semViolacoes(page);
});

test("o familiar vê a pendência e envia direto no cofre", async () => {
  const page = x1.page;
  await page.goto(`/portal/${orgX}`);
  const lista = page.getByTestId("portal-pedidos");
  await expect(lista).toContainText(pedido);
  await expect(lista).toContainText("Pendente");
  await expect(page.getByText("Falta 1 documento")).toBeVisible();
  await semViolacoes(page);

  // Arquivo com nome de PDF mas conteúdo de outra coisa é recusado.
  await lista.getByLabel("Escolher arquivo").setInputFiles({
    name: "falso.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("MZ executavel ficticio"),
  });
  await lista.getByRole("button", { name: `Guardar no cofre: ${pedido}` }).click();
  await expect(lista.getByTestId("envio-aviso")).toContainText("não corresponde");

  await lista
    .getByLabel("Escolher arquivo")
    .setInputFiles({ name: arquivo, mimeType: "application/pdf", buffer: pdf });
  await lista.getByRole("button", { name: `Guardar no cofre: ${pedido}` }).click();
  await expect(lista.getByTestId("envio-aviso")).toContainText("Documento guardado no cofre");
  await expect(lista).toContainText(arquivo);
  await expect(lista).toContainText("Enviado. A Jéssica vai analisar");

  const r = await page.request.get(
    await lista
      .getByRole("link", { name: arquivo })
      .getAttribute("href")
      .then((h) => h!),
  );
  expect(r.status()).toBe(200);
  expect(await r.text()).toBe(pdf.toString());
});

test("outro familiar da mesma empresa não abre o arquivo", async () => {
  const page = x2.page;
  await page.goto(`/portal/${orgX}`);
  const lista = page.getByTestId("portal-pedidos");
  await expect(lista).toContainText(pedido);
  await expect(lista).not.toContainText(arquivo);
  await expect(lista).toContainText("Outra pessoa da família já enviou 1 arquivo(s)");
});

test("a JC vê o envio, abre e pede ajuste", async () => {
  const page = jc.page;
  await page.goto(`/admin/empresas/${orgX}/cofre`);
  await expect(page.getByTestId("pedidos-lista")).toContainText("Enviado, aguardando análise");
  await expect(page.getByTestId("cofre-lista")).toContainText(arquivo);
  await expect(page.getByTestId("cofre-lista")).toContainText("Enviado pela família no portal");
  const baixar = await page.request.get(
    (await page
      .getByTestId("cofre-lista")
      .getByRole("link", { name: `Baixar ${arquivo}` })
      .getAttribute("href"))!,
  );
  expect(baixar.status()).toBe(200);

  await page.getByRole("button", { name: `Pedir ajuste: ${pedido}` }).click();
  await page.getByLabel(/O que precisa ser ajustado/).fill("Falta a última página");
  await page.getByRole("button", { name: "Enviar pedido de ajuste" }).click();
  await expect(page.getByTestId("revisao-aviso")).toContainText("Ajuste pedido");
  await expect(page.getByTestId("pedidos-lista")).toContainText("Precisa de ajuste");

  await page.goto("/admin/agenda");
  await expect(page.getByText(`Documento recebido no cofre: ${arquivo}`).first()).toBeVisible();
});

test("o familiar vê o ajuste e apaga o que enviou", async () => {
  const page = x1.page;
  await page.goto(`/portal/${orgX}`);
  const lista = page.getByTestId("portal-pedidos");
  await expect(lista).toContainText("Falta a última página");
  await expect(lista).toContainText("aberto pela equipe JC 1 vez(es)");

  await lista.getByRole("button", { name: `Apagar ${arquivo}` }).click();
  await lista.getByLabel("Para confirmar, digite APAGAR").fill("APAGAR");
  await lista.getByRole("button", { name: "Apagar de vez" }).click();
  await expect(lista.getByTestId("apagar-aviso")).toContainText("apagado de vez");
  await expect(lista).not.toContainText(arquivo);
  await expect(lista).toContainText("Pendente");

  const jcPage = jc.page;
  await jcPage.goto(`/admin/empresas/${orgX}/cofre`);
  await expect(jcPage.getByTestId("cofre-comprovantes")).toContainText(arquivo);
  await expect(jcPage.getByTestId("cofre-comprovantes")).toContainText(
    "Apagado pelo cliente no portal",
  );
});
