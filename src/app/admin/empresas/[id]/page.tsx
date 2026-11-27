import Link from "next/link";
import { BotaoLink, Cartao, Chamada, Selo, Titulo } from "@/components/ui";
import { montarRoteiro, progresso, proximaEtapa } from "@/modules/atendimento/roteiro";
import type { StatusContrato } from "@/modules/contratos/schema";
import { ROTULO_SITUACAO_CLIENTE, situacaoDoCliente } from "@/modules/contratos/situacao";
import { brl } from "@/modules/raiox/calculo";
import { carregarEmpresa } from "./carregar";
import { ConcluirAtendimento } from "./concluir";

export const metadata = { title: "Empresa" };

const fuso = "America/Sao_Paulo";
const dia = (v: string) => new Date(v).toLocaleDateString("pt-BR", { timeZone: fuso });
const diaSimples = (d: string) => d.split("-").reverse().join("/");

const contar = (r: { count: number | null }) => r.count ?? 0;
const semAcesso = Promise.resolve(null);

/**
 * Central do cliente: situação, próximo passo, roteiro do atendimento e os últimos
 * registros em uma tela só. Cada etapa leva direto à ferramenta e volta para cá.
 */
export default async function EmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { acesso, supabase, empresa } = await carregarEmpresa(
    id,
    `/admin/empresas/${id}`,
    "organizations.read",
  );
  const base = `/admin/empresas/${id}`;
  const pode = {
    contratos: acesso.pode("proposals.read"),
    gerirContratos: acesso.pode("proposals.manage"),
    analises: acesso.pode("analyses.read"),
    pessoas: acesso.pode("participants.read"),
    questionarios: acesso.pode("diagnostics.read"),
    portal: acesso.pode("portal.manage"),
    cofre: acesso.pode("vault.read"),
    historico: acesso.pode("activities.read"),
  };
  const contagem = (tabela: string) =>
    supabase.from(tabela).select("id", { count: "exact", head: true }).eq("organization_id", id);

  const [
    contratosR,
    pessoasR,
    sessoesR,
    periodosR,
    cargosR,
    acoesR,
    publicadosR,
    membrosR,
    documentosR,
    registrosR,
  ] = await Promise.all([
    pode.contratos
      ? supabase
          .from("contracts")
          .select("id, service_name, total_value, status, proposal_id, ends_on")
          .eq("organization_id", id)
          .order("created_at", { ascending: false })
      : semAcesso,
    pode.pessoas
      ? supabase
          .from("organization_participants")
          .select("participant_id", { count: "exact", head: true })
          .eq("organization_id", id)
      : semAcesso,
    pode.questionarios
      ? supabase.from("diagnostic_sessions").select("status").eq("organization_id", id)
      : semAcesso,
    pode.analises ? contagem("financial_periods") : semAcesso,
    pode.analises ? contagem("org_positions").eq("scenario", "current") : semAcesso,
    pode.analises
      ? supabase.from("priority_items").select("phase").eq("organization_id", id)
      : semAcesso,
    pode.portal ? contagem("portal_publications").is("revoked_at", null) : semAcesso,
    pode.portal
      ? supabase
          .from("portal_members")
          .select("user_id", { count: "exact", head: true })
          .eq("organization_id", id)
          .is("revoked_at", null)
      : semAcesso,
    pode.cofre ? contagem("vault_documents").eq("status", "active") : semAcesso,
    pode.historico
      ? supabase
          .from("activities")
          .select("id, summary, occurred_at, created_at")
          .eq("organization_id", id)
          .order("created_at", { ascending: false })
          .limit(6)
      : semAcesso,
  ]);

  const contratos = contratosR?.data ?? [];
  const ativos = contratos.filter((c) => c.status === "active");
  const [textoSituacao, tomSituacao] =
    ROTULO_SITUACAO_CLIENTE[situacaoDoCliente(contratos.map((c) => c.status as StatusContrato))];
  const sessoes = sessoesR?.data ?? [];
  const acoes = (acoesR?.data ?? []).filter((a) => a.phase !== "discarded");

  const etapas = montarRoteiro(base, {
    contratos: pode.contratos ? { ativos: ativos.length, total: contratos.length } : undefined,
    pessoas: pessoasR ? contar(pessoasR) : undefined,
    questionarios: sessoesR
      ? {
          enviados: sessoes.filter((s) => s.status !== "abandoned").length,
          respondidos: sessoes.filter((s) => s.status === "completed").length,
        }
      : undefined,
    periodos: periodosR ? contar(periodosR) : undefined,
    cargos: cargosR ? contar(cargosR) : undefined,
    acoes: acoesR
      ? { total: acoes.length, concluidas: acoes.filter((a) => a.phase === "done").length }
      : undefined,
    relatorio:
      pode.analises && publicadosR
        ? { publicados: contar(publicadosR) }
        : pode.analises
          ? { publicados: 0 }
          : undefined,
    portal:
      publicadosR && membrosR
        ? { membros: contar(membrosR), publicados: contar(publicadosR) }
        : undefined,
  });
  const proxima = proximaEtapa(etapas);
  const { feitas, total, fracao } = progresso(etapas);
  const concluido = contratos.length > 0 && ativos.length === 0;
  const registros = registrosR?.data ?? [];
  const MARCA: Record<string, string> = {
    feito: "border-ok bg-ok text-white",
    andamento: "border-terra bg-blush text-terra-texto",
    pendente: "border-linho bg-papel text-mudo",
  };
  const ROTULO_ETAPA: Record<string, string> = {
    feito: "Feito",
    andamento: "Em andamento",
    pendente: "A fazer",
  };

  return (
    <main className="mx-auto grid max-w-6xl gap-7 px-6 py-12">
      <header className="grid gap-2">
        <Chamada>
          <Link href="/admin/empresas" className="text-terra-texto underline">
            Clientes
          </Link>
        </Chamada>
        <div className="flex flex-wrap items-center gap-3">
          <Titulo>{empresa.trade_name}</Titulo>
          {pode.contratos ? <Selo tom={tomSituacao}>{textoSituacao}</Selo> : null}
        </div>
        <p className="text-mudo m-0">
          {[
            empresa.segment,
            ativos.length ? `Em andamento: ${ativos.map((c) => c.service_name).join(", ")}` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Sem serviço em andamento."}
        </p>
      </header>

      {etapas.length ? (
        <Cartao className="grid gap-4" superficie="borda">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid max-w-[46ch] gap-1">
              <h2 className="font-display m-0 text-xl" id="proximo">
                {concluido
                  ? "Atendimento concluído"
                  : proxima
                    ? `Próximo passo: ${proxima.titulo}`
                    : "Tudo feito: falta só concluir"}
              </h2>
              <p className="text-mudo m-0 text-[15px]" data-testid="empresa-proximo">
                {concluido
                  ? "Os contratos deste cliente foram concluídos. Para um novo trabalho, registre um contrato ou crie uma proposta."
                  : proxima
                    ? `${proxima.paraQue} Hoje: ${proxima.resumo.toLowerCase()}.`
                    : "Todas as etapas do roteiro estão feitas. Conclua o atendimento para encerrar o processo."}
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              {proxima && !concluido ? (
                <BotaoLink href={proxima.href}>{`Ir para ${proxima.titulo}`}</BotaoLink>
              ) : null}
              {pode.analises ? (
                <BotaoLink href={`${base}/relatorio`} variante="secundario">
                  Gerar relatório
                </BotaoLink>
              ) : null}
              {pode.gerirContratos && ativos.length ? (
                <ConcluirAtendimento
                  empresaId={id}
                  servicos={ativos.map((c) => c.service_name)}
                  pendentes={etapas.filter((e) => e.situacao !== "feito").map((e) => e.titulo)}
                />
              ) : null}
            </div>
          </div>
          <div className="grid gap-1.5">
            <span className="text-mudo text-[13px]" data-testid="empresa-progresso">
              {feitas} de {total} etapas feitas
            </span>
            <div className="bg-linho h-1.5 overflow-hidden rounded-full" aria-hidden="true">
              <div className="bg-terra h-full" style={{ width: `${Math.round(fracao * 100)}%` }} />
            </div>
          </div>
        </Cartao>
      ) : null}

      <div className="grid gap-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
        <section aria-labelledby="roteiro" className="grid gap-3">
          <h2 id="roteiro" className="font-display m-0 text-xl">
            Roteiro do atendimento
          </h2>
          {etapas.length ? (
            <ol
              className="border-linho m-0 grid list-none border-t p-0"
              data-testid="empresa-roteiro"
            >
              {etapas.map((e, i) => (
                <li
                  key={e.chave}
                  className="border-linho grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-3 border-b py-3.5"
                >
                  <span
                    aria-hidden="true"
                    className={`font-display grid size-9 place-items-center rounded-full border text-[15px] font-semibold ${MARCA[e.situacao]}`}
                  >
                    {e.situacao === "feito" ? "✓" : i + 1}
                  </span>
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <div className="grid gap-0.5">
                      <b className="font-display text-[1.1rem] font-semibold">{e.titulo}</b>
                      <span className="text-mudo text-[14px]">
                        <span className="sr-only">{ROTULO_ETAPA[e.situacao]}: </span>
                        {e.resumo}
                      </span>
                    </div>
                    <Link
                      href={e.href}
                      className="text-terra-texto text-[14.5px] font-semibold underline"
                    >
                      {e.acao}
                    </Link>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-mudo m-0">
              As ferramentas desta empresa são restritas. Peça acesso a uma administradora.
            </p>
          )}
          {pode.cofre ? (
            <p className="m-0 text-[14.5px]">
              <Link href={`${base}/cofre`} className="text-terra-texto font-semibold underline">
                Abrir o cofre
              </Link>
              <span className="text-mudo">
                {" · "}
                {documentosR && contar(documentosR)
                  ? `${contar(documentosR)} documento(s) guardado(s)`
                  : "nenhum documento guardado"}
              </span>
            </p>
          ) : null}
        </section>

        <aside className="grid gap-6">
          {pode.contratos ? (
            <section aria-labelledby="contratos" className="grid gap-2">
              <h2 id="contratos" className="font-display m-0 text-xl">
                Contratos e propostas
              </h2>
              {contratos.length ? (
                <ul className="m-0 grid list-none gap-2 p-0" data-testid="empresa-contratos">
                  {contratos.map((c) => (
                    <li
                      key={c.id}
                      className="border-linho grid gap-0.5 border-b pb-2 text-[14.5px]"
                    >
                      <b>{c.service_name}</b>
                      <span className="text-mudo">
                        {[
                          c.total_value !== null ? brl(Number(c.total_value)) : null,
                          c.status === "active"
                            ? "em andamento"
                            : c.status === "completed"
                              ? `concluído${c.ends_on ? ` em ${diaSimples(c.ends_on)}` : ""}`
                              : "cancelado",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <span className="flex flex-wrap gap-x-4">
                        <Link
                          href={`${base}/contratos/${c.id}/documento`}
                          className="text-terra-texto underline"
                        >
                          Contrato
                        </Link>
                        {c.proposal_id ? (
                          <Link
                            href={`/admin/propostas/${c.proposal_id}/documento`}
                            className="text-terra-texto underline"
                          >
                            Proposta
                          </Link>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-mudo m-0 text-[14.5px]">
                  Nenhum contrato registrado: esta empresa ainda está em negociação.
                </p>
              )}
            </section>
          ) : null}

          {pode.historico ? (
            <section aria-labelledby="registros" className="grid gap-2">
              <h2 id="registros" className="font-display m-0 text-xl">
                Últimos registros
              </h2>
              {registros.length ? (
                <ul className="m-0 grid list-none gap-2 p-0">
                  {registros.map((r) => (
                    <li key={r.id} className="grid gap-0.5 text-[14px]">
                      <span className="text-mudo text-[12.5px] tabular-nums">
                        {dia((r.occurred_at ?? r.created_at) as string)}
                      </span>
                      <span>{r.summary}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-mudo m-0 text-[14.5px]">Nenhum registro ainda.</p>
              )}
              <Link
                href={`${base}/historico`}
                className="text-terra-texto text-[14.5px] font-semibold underline"
              >
                Abrir o histórico
              </Link>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
