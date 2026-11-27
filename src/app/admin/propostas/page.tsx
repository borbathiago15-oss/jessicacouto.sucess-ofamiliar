import Link from "next/link";
import { redirect } from "next/navigation";
import { Cartao, Chamada, Selo, Titulo } from "@/components/ui";
import { meuAcesso } from "@/lib/auth/access";
import { enforceAdminRoute } from "@/lib/auth/guard";
import { umDe } from "@/lib/supabase/relacao";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { diaDe } from "@/modules/funil/schema";
import {
  brl,
  FILTROS_STATUS,
  filtroDaProposta,
  ROTULO_FILTRO,
  rotuloDaProposta,
  type FiltroStatus,
  type StatusProposta,
} from "@/modules/propostas/calculo";
import { NovaProposta, type OpcaoEmpresa } from "./nova";

export const metadata = { title: "Propostas comerciais" };

export default async function PropostasPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; oportunidade?: string; status?: string }>;
}) {
  await enforceAdminRoute("/admin/propostas");
  const acesso = await meuAcesso();
  if (!acesso?.session_valid) redirect("/admin/sair?motivo=sessao");
  if (!acesso.pode("proposals.read")) {
    return (
      <main className="mx-auto grid max-w-3xl gap-4 px-6 py-16">
        <Titulo>Propostas comerciais</Titulo>
        <p>Você não tem acesso às propostas. Peça a uma administradora.</p>
      </main>
    );
  }
  const { empresa, oportunidade, status: statusPedido } = await searchParams;
  const filtro = (FILTROS_STATUS as readonly string[]).includes(statusPedido ?? "")
    ? (statusPedido as FiltroStatus)
    : null;

  const supabase = (await createSupabaseServerClient())!;
  const [propostasR, empresasR, configR] = await Promise.all([
    supabase
      .from("proposals")
      .select(
        "id, number, title, status, total_value, valid_until, created_at, organizations(trade_name)",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("organizations")
      .select("id, trade_name, opportunities(id, title, pipeline_stages(is_closed))")
      .order("trade_name"),
    supabase.from("proposal_settings").select("hourly_rate").maybeSingle(),
  ]);

  const empresas: OpcaoEmpresa[] = (empresasR.data ?? []).map((e) => ({
    id: e.id,
    trade_name: e.trade_name,
    oportunidades: (e.opportunities ?? [])
      .filter((o) => !umDe(o.pipeline_stages)?.is_closed)
      .map((o) => ({ id: o.id, title: o.title })),
  }));
  const semValorHora = !Number(configR.data?.hourly_rate);
  const hoje = diaDe(new Date());
  const todas = (propostasR.data ?? []).map((p) => ({
    ...p,
    filtro: filtroDaProposta(p.status as StatusProposta, p.valid_until as string | null, hoje),
  }));
  const contagem = new Map<FiltroStatus, number>();
  for (const p of todas) contagem.set(p.filtro, (contagem.get(p.filtro) ?? 0) + 1);
  const propostas = filtro ? todas.filter((p) => p.filtro === filtro) : todas;
  const chip = (ativo: boolean) =>
    `rounded-full border px-3 py-1 text-[13.5px] no-underline ${
      ativo
        ? "border-terra-texto bg-terra-texto font-semibold text-white"
        : "border-linho bg-papel text-cacau hover:border-terra-texto"
    }`;

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-6 py-14">
      <header className="grid gap-2">
        <Chamada>
          <Link href="/admin" className="text-terra-texto underline">
            Ambiente administrativo
          </Link>
        </Chamada>
        <Titulo>Propostas comerciais</Titulo>
        <p className="text-mudo max-w-[66ch]">
          Monte a proposta pelas etapas e horas de esforço. O preço sai do valor-hora, do fator de
          complexidade e do desconto, e o documento de envio segue o padrão JC com o logo do
          cliente.
        </p>
        {acesso.pode("proposals.catalog") ? (
          <Link href="/admin/propostas/catalogo" className="text-terra-texto underline">
            Catálogo de etapas e condições padrão
          </Link>
        ) : null}
      </header>

      {semValorHora ? (
        <p className="bg-atencao-fundo text-atencao rounded-[10px] px-3 py-2 text-sm">
          O valor-hora ainda não foi definido. Sem ele, a proposta não pode ser enviada.
          {acesso.pode("proposals.catalog") ? " Defina no catálogo." : " Peça à administradora."}
        </p>
      ) : null}

      {acesso.pode("proposals.manage") && empresas.length ? (
        <Cartao className="grid gap-3">
          <h2 className="font-display text-xl">Nova proposta</h2>
          <NovaProposta
            empresas={empresas}
            empresaInicial={empresa}
            oportunidadeInicial={oportunidade}
          />
        </Cartao>
      ) : null}

      {todas.length ? (
        <nav aria-label="Filtrar por status" className="flex flex-wrap gap-2">
          <Link
            href="/admin/propostas"
            className={chip(!filtro)}
            aria-current={!filtro ? "true" : undefined}
          >
            Todas ({todas.length})
          </Link>
          {FILTROS_STATUS.filter((f) => contagem.get(f)).map((f) => (
            <Link
              key={f}
              href={`/admin/propostas?status=${f}`}
              className={chip(filtro === f)}
              aria-current={filtro === f ? "true" : undefined}
            >
              {ROTULO_FILTRO[f]} ({contagem.get(f)})
            </Link>
          ))}
        </nav>
      ) : null}

      {propostas.length === 0 ? (
        <p className="text-mudo">
          {todas.length ? "Nenhuma proposta com este status." : "Nenhuma proposta ainda."}
        </p>
      ) : (
        <ul className="border-linho m-0 grid list-none border-t p-0" data-testid="propostas-lista">
          {propostas.map((p) => {
            const [rotulo, tom] = rotuloDaProposta(
              p.status as StatusProposta,
              p.valid_until as string | null,
              hoje,
            );
            return (
              <li
                key={p.id}
                className="border-linho flex flex-wrap items-center justify-between gap-3 border-b py-4"
              >
                <div className="grid">
                  <Link
                    href={`/admin/propostas/${p.id}`}
                    className="font-display text-cacau text-lg font-semibold no-underline hover:underline"
                  >
                    {p.number} · {p.title}
                  </Link>
                  <span className="text-mudo text-[13px]">
                    {umDe(p.organizations)?.trade_name}
                    {p.total_value !== null ? ` · ${brl(Number(p.total_value))}` : ""}
                  </span>
                </div>
                <Selo tom={tom}>{rotulo}</Selo>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
