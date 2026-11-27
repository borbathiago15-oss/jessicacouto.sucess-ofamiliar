import Link from "next/link";
import { redirect } from "next/navigation";
import { Cartao, Chamada, Selo, Titulo } from "@/components/ui";
import { meuAcesso } from "@/lib/auth/access";
import { enforceAdminRoute } from "@/lib/auth/guard";
import { umDe } from "@/lib/supabase/relacao";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  diasDeAtraso,
  resumoDoCaixa,
  ROTULO_FORMA,
  ROTULO_PARCELA,
  situacaoDaParcela,
  type Forma,
  type SituacaoParcela,
} from "@/modules/caixa/schema";
import { diaDe } from "@/modules/funil/schema";
import { brl } from "@/modules/propostas/calculo";
import { AcoesParcela } from "./formularios";

export const metadata = { title: "Caixa" };

const VISOES = {
  abertas: "A receber",
  atrasadas: "Em atraso",
  recebidas: "Recebidos",
  todas: "Todas",
} as const;
type Visao = keyof typeof VISOES;

const dataCurta = (d: string) => d.split("-").reverse().join("/");

/** Caixa: o que há a receber de cada cliente, o que atrasou e o que já entrou. */
export default async function CaixaPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  await enforceAdminRoute("/admin/caixa");
  const acesso = await meuAcesso();
  if (!acesso?.session_valid) redirect("/admin/sair?motivo=sessao");
  if (!acesso.pode("proposals.read")) {
    return (
      <main className="mx-auto grid max-w-3xl gap-4 px-6 py-16">
        <Titulo>Caixa</Titulo>
        <p>Você não tem acesso ao caixa. Peça a uma administradora.</p>
      </main>
    );
  }
  const { ver } = await searchParams;
  const visao: Visao = ver && ver in VISOES ? (ver as Visao) : "abertas";
  const podeGerir = acesso.pode("proposals.manage");

  const supabase = (await createSupabaseServerClient())!;
  const { data } = await supabase
    .from("contract_payments")
    .select(
      "id, label, due_on, amount, method, paid_on, paid_amount, organization_id, organizations(trade_name), contracts(service_name)",
    )
    .order("due_on")
    .limit(1000);
  const hoje = diaDe(new Date());
  const parcelas = (data ?? []).map((p) => ({
    id: p.id as string,
    label: p.label as string,
    due_on: p.due_on as string,
    amount: Number(p.amount),
    method: p.method as Forma,
    paid_on: p.paid_on as string | null,
    paid_amount: p.paid_amount === null ? null : Number(p.paid_amount),
    empresaId: p.organization_id as string,
    empresa: (umDe(p.organizations)?.trade_name as string) ?? "Empresa",
    servico: (umDe(p.contracts)?.service_name as string) ?? "",
    situacao: situacaoDaParcela(
      { due_on: p.due_on as string, paid_on: p.paid_on as string | null },
      hoje,
    ),
  }));
  const r = resumoDoCaixa(parcelas, hoje);
  const naVisao = (v: Visao, s: SituacaoParcela) =>
    v === "todas"
      ? true
      : v === "recebidas"
        ? s === "recebida"
        : v === "atrasadas"
          ? s === "atrasada"
          : s !== "recebida";
  const contagem = Object.fromEntries(
    (Object.keys(VISOES) as Visao[]).map((v) => [
      v,
      parcelas.filter((p) => naVisao(v, p.situacao)).length,
    ]),
  ) as Record<Visao, number>;
  const lista = parcelas
    .filter((p) => naVisao(visao, p.situacao))
    // Recebidos: o mais recente primeiro. O resto segue o vencimento.
    .sort((a, b) =>
      visao === "recebidas"
        ? (b.paid_on ?? "").localeCompare(a.paid_on ?? "")
        : a.due_on.localeCompare(b.due_on),
    );
  const chip = (ativo: boolean) =>
    `rounded-full border px-3 py-1 text-[13.5px] no-underline ${
      ativo
        ? "border-terra-texto bg-terra-texto font-semibold text-white"
        : "border-linho bg-papel text-cacau hover:border-terra-texto"
    }`;
  const numeros: [string, number, string, string?][] = [
    ["A receber", r.aReceber, "Tudo o que ainda não entrou"],
    [
      "Em atraso",
      r.emAtraso,
      r.atrasadas ? `${r.atrasadas} parcela(s) vencida(s)` : "Nada vencido",
      r.emAtraso ? "text-critico" : undefined,
    ],
    ["Próximos 30 dias", r.proximos30, "Previsto para entrar"],
    ["Recebido neste mês", r.recebidoNoMes, "Já entrou no caixa"],
  ];

  return (
    <main className="mx-auto grid max-w-6xl gap-7 px-6 py-12">
      <header className="grid gap-2">
        <Chamada>
          <Link href="/admin" className="text-terra-texto underline">
            Ambiente administrativo
          </Link>
        </Chamada>
        <Titulo>Caixa</Titulo>
        <p className="text-mudo m-0 max-w-[66ch]">
          As parcelas de cada contrato, pelo vencimento. O plano de pagamento é definido na ficha do
          cliente, em Contratos e propostas.
        </p>
      </header>

      {/* Lista simples (não <dl>): cada cartão é um item com título, valor e nota. */}
      <ul
        className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4"
        data-testid="caixa-resumo"
      >
        {numeros.map(([titulo, valor, nota, cor]) => (
          <li key={titulo} className="grid">
            <Cartao className="grid gap-1">
              <span className="text-mudo text-[13px] font-semibold">{titulo}</span>
              <b
                className={`font-display text-[1.7rem] leading-tight font-semibold tabular-nums ${cor ?? "text-terra-texto"}`}
              >
                {brl(valor)}
              </b>
              <span className="text-mudo text-[13px]">{nota}</span>
            </Cartao>
          </li>
        ))}
      </ul>

      <nav aria-label="Ver" className="flex flex-wrap gap-2">
        {(Object.keys(VISOES) as Visao[]).map((v) => (
          <Link
            key={v}
            href={v === "abertas" ? "/admin/caixa" : `/admin/caixa?ver=${v}`}
            className={chip(visao === v)}
            aria-current={visao === v ? "true" : undefined}
          >
            {VISOES[v]} ({contagem[v]})
          </Link>
        ))}
      </nav>

      {lista.length === 0 ? (
        <p className="text-mudo m-0" data-testid="caixa-vazio">
          {parcelas.length
            ? "Nenhuma parcela nesta visão."
            : "Nenhuma parcela registrada. Abra um cliente, vá em Contratos e propostas e gere o plano de pagamento do contrato."}
        </p>
      ) : (
        <ul className="border-linho m-0 grid list-none border-t p-0" data-testid="caixa-lista">
          {lista.map((p) => {
            const [texto, tom] = ROTULO_PARCELA[p.situacao];
            const atraso = p.situacao === "atrasada" ? diasDeAtraso(p.due_on, hoje) : 0;
            return (
              <li
                key={p.id}
                className="border-linho grid gap-3 border-b py-3.5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-center"
              >
                <span className="grid gap-0.5">
                  <Link
                    href={`/admin/empresas/${p.empresaId}/contratos`}
                    className="text-cacau font-semibold no-underline hover:underline"
                  >
                    {p.empresa}
                  </Link>
                  <span className="text-mudo text-[13.5px]">
                    {[p.servico, p.label, ROTULO_FORMA[p.method]].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="grid gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <b className="tabular-nums">{brl(p.paid_amount ?? p.amount)}</b>
                    <Selo tom={tom}>{texto}</Selo>
                  </span>
                  <span className="text-mudo text-[13.5px] tabular-nums">
                    {p.paid_on
                      ? `Recebido em ${dataCurta(p.paid_on)} · vencia em ${dataCurta(p.due_on)}`
                      : `Vence em ${dataCurta(p.due_on)}${atraso ? ` · ${atraso} dia(s) de atraso` : ""}`}
                  </span>
                </span>
                {podeGerir ? (
                  <AcoesParcela
                    id={p.id}
                    empresaId={p.empresaId}
                    descricao={`${p.label} de ${p.empresa}`}
                    recebida={!!p.paid_on}
                    hoje={hoje}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
