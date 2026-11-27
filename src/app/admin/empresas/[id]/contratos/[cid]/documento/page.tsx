import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { FaixaDocumento, FioContinuidade } from "@/components/ui";
import { CLAUSULAS_DE_EXEMPLO, paragrafosDasClausulas } from "@/modules/contratos/schema";
import { brl, parcelar } from "@/modules/propostas/calculo";
import { carregarEmpresa } from "../../../carregar";
import { BotaoImprimir } from "../../../raio-x/relatorio/imprimir";

export const metadata = { title: "Contrato" };

const fuso = "America/Sao_Paulo";
const dataLonga = (dia: string) =>
  new Date(`${dia}T12:00:00-03:00`).toLocaleDateString("pt-BR", {
    timeZone: fuso,
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/**
 * Contrato gerado a partir do que foi fechado: partes, objeto (com o escopo da
 * proposta aprovada), investimento, vigência e as cláusulas do modelo cadastrado.
 */
export default async function ContratoDocumentoPage({
  params,
}: {
  params: Promise<{ id: string; cid: string }>;
}) {
  const { id, cid } = await params;
  if (!z.uuid().safeParse(cid).success) notFound();
  const { supabase, empresa } = await carregarEmpresa(
    id,
    `/admin/empresas/${id}/contratos/${cid}/documento`,
    "proposals.read",
  );

  const [contratoR, configR, orgR] = await Promise.all([
    supabase
      .from("contracts")
      .select(
        "id, service_name, total_value, starts_on, ends_on, notes, created_at, proposal_id, proposals(number, installments, payment_terms, proposal_items(name, description, position))",
      )
      .eq("id", cid)
      .eq("organization_id", id)
      .maybeSingle(),
    supabase.from("proposal_settings").select("contract_clauses").maybeSingle(),
    supabase.from("organizations").select("legal_name").eq("id", id).maybeSingle(),
  ]);
  const c = contratoR.data;
  if (!c) notFound();

  const proposta = (Array.isArray(c.proposals) ? c.proposals[0] : c.proposals) as {
    number: string | null;
    installments: number;
    payment_terms: string;
    proposal_items: { name: string; description: string | null; position: number }[];
  } | null;
  const etapas = [...(proposta?.proposal_items ?? [])].sort((a, b) => a.position - b.position);
  const cadastradas = paragrafosDasClausulas(configR.data?.contract_clauses as string | null);
  const exemplo = cadastradas.length === 0;
  const clausulas = exemplo ? [...CLAUSULAS_DE_EXEMPLO] : cadastradas;
  const total = c.total_value === null ? null : Number(c.total_value);
  const parcelas = total !== null && proposta ? parcelar(total, proposta.installments) : [];
  const contratante = (orgR.data?.legal_name as string | null) || empresa.trade_name;
  const referencia = proposta?.number ?? c.id.slice(0, 8).toUpperCase();
  const h2 = "font-display text-terra-texto text-xl font-semibold";
  const secao = "grid gap-3 break-inside-avoid";

  return (
    <main
      className="mx-auto grid max-w-[820px] gap-8 px-6 py-10 print:max-w-none print:p-0"
      data-testid="contrato-documento"
    >
      <style>{"@page { size: A4; margin: 16mm 14mm }"}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/admin/empresas/${id}/contratos`} className="text-terra-texto underline">
          Voltar aos contratos
        </Link>
        <BotaoImprimir />
      </div>

      <FaixaDocumento>
        <b className="text-porcelana text-[14px]">Contrato de prestação de serviços</b>
        <span>{referencia}</span>
      </FaixaDocumento>

      {exemplo ? (
        <p
          className="bg-atencao-fundo text-atencao m-0 rounded-[10px] px-4 py-3 text-sm font-semibold"
          data-testid="contrato-exemplo"
        >
          Atenção: as condições gerais abaixo são um texto de exemplo, sem validade jurídica.
          Cadastre o modelo de contrato em Propostas → Catálogo antes de enviar para assinatura.
        </p>
      ) : null}

      <header className="grid gap-3">
        <h1 className="font-display text-[2.1rem] leading-tight font-semibold">{c.service_name}</h1>
        <FioContinuidade className="max-w-xs" />
      </header>

      <section className={secao}>
        <h2 className={h2}>Partes</h2>
        <p className="m-0">
          <b>Contratante:</b> {contratante}
        </p>
        <p className="m-0">
          <b>Contratada:</b> Jéssica Couto · Sucessão de Sucesso
        </p>
      </section>

      <section className="grid gap-3">
        <h2 className={h2}>Objeto</h2>
        <p className="m-0">
          Prestação do serviço <b>{c.service_name}</b>
          {proposta?.number ? `, conforme a proposta comercial ${proposta.number}` : ""}.
        </p>
        {etapas.length ? (
          <ol className="m-0 grid gap-3 p-0" style={{ listStyle: "none" }}>
            {etapas.map((e, k) => (
              <li key={k} className="border-linho grid break-inside-avoid gap-1 border-l-2 pl-4">
                <span className="font-semibold">
                  {k + 1}. {e.name}
                </span>
                {e.description ? (
                  <span className="text-mudo whitespace-pre-wrap">{e.description}</span>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}
        {c.notes ? <p className="m-0 whitespace-pre-wrap">{c.notes}</p> : null}
      </section>

      <section className={secao}>
        <h2 className={h2}>Investimento e vigência</h2>
        <div className="bg-papel border-linho grid gap-2 rounded-2xl border p-5">
          <div className="font-display flex justify-between text-xl font-semibold">
            <span>Valor total</span>
            <span className="tabular-nums">{total === null ? "A definir" : brl(total)}</span>
          </div>
          {parcelas.length ? (
            <div className="flex justify-between text-sm">
              <span>Forma de pagamento</span>
              <span className="tabular-nums">
                {parcelas.length > 1
                  ? `${parcelas.length} parcelas de ${brl(parcelas.at(-1)!)}`
                  : "Pagamento único"}
              </span>
            </div>
          ) : null}
          <div className="flex justify-between text-sm">
            <span>Vigência</span>
            <span>
              {c.starts_on ? dataLonga(c.starts_on) : "Início a definir"}
              {c.ends_on ? ` a ${dataLonga(c.ends_on)}` : ""}
            </span>
          </div>
        </div>
        {proposta?.payment_terms?.trim() ? (
          <p className="m-0 text-sm whitespace-pre-wrap">{proposta.payment_terms}</p>
        ) : null}
      </section>

      <section className="grid gap-3">
        <h2 className={h2}>Condições gerais{exemplo ? " (texto de exemplo)" : ""}</h2>
        <ol className="m-0 grid gap-3 pl-5">
          {clausulas.map((t, k) => (
            <li key={k} className="break-inside-avoid leading-relaxed whitespace-pre-wrap">
              {t}
            </li>
          ))}
        </ol>
      </section>

      <section className={secao}>
        <h2 className={h2}>Assinaturas</h2>
        <p className="m-0 text-sm">E, por estarem de acordo, as partes assinam este contrato.</p>
        <div className="grid gap-10 pt-8 sm:grid-cols-2">
          {[contratante, "Jéssica Couto · Sucessão de Sucesso"].map((nome) => (
            <div key={nome} className="grid gap-1">
              <span className="border-cacau border-t" aria-hidden="true" />
              <span className="text-sm">{nome}</span>
              <span className="text-mudo text-xs">Data: ____/____/______</span>
            </div>
          ))}
        </div>
      </section>

      <p className="border-linho text-mudo m-0 border-t pt-3 text-xs">
        Documento confidencial, preparado exclusivamente para {contratante}. Referência {referencia}
        .
      </p>
    </main>
  );
}
