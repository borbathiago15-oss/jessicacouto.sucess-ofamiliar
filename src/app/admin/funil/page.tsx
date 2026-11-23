import Link from "next/link";
import { redirect } from "next/navigation";
import { Cartao, Chamada, Titulo } from "@/components/ui";
import { meuAcesso } from "@/lib/auth/access";
import { enforceAdminRoute } from "@/lib/auth/guard";
import { umDe } from "@/lib/supabase/relacao";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { brl, diaDe, montarQuadro, type Etapa, type Oportunidade } from "@/modules/funil/schema";
import { EditarOportunidade, NovaOportunidade } from "./formularios";

export const metadata = { title: "Funil comercial" };

const dataCurta = (dia: string) => dia.split("-").reverse().join("/");

export default async function FunilPage() {
  await enforceAdminRoute("/admin/funil");
  const acesso = await meuAcesso();
  if (!acesso?.session_valid) redirect("/admin/sair?motivo=sessao");

  if (!acesso.pode("opportunities.read") || !acesso.pode("pipeline.read")) {
    return (
      <main className="mx-auto grid max-w-3xl gap-4 px-6 py-16">
        <Titulo>Funil comercial</Titulo>
        <p>Você não tem acesso ao funil. Peça a uma administradora.</p>
      </main>
    );
  }

  const supabase = (await createSupabaseServerClient())!;
  const [etapasR, oportunidadesR, empresasR] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("id, name, position, is_closed, is_won")
      .eq("is_active", true)
      .order("position"),
    supabase
      .from("opportunities")
      .select(
        "id, title, stage_id, estimated_value, next_action, next_action_at, closed_reason, organizations(trade_name)",
      )
      .order("updated_at", { ascending: false })
      .limit(500),
    acesso.pode("organizations.read")
      ? supabase.from("organizations").select("id, trade_name").order("trade_name")
      : Promise.resolve({ data: [] }),
  ]);

  const etapas = (etapasR.data ?? []) as Etapa[];
  const oportunidades: Oportunidade[] = (oportunidadesR.data ?? []).map((o) => ({
    id: o.id,
    title: o.title,
    stage_id: o.stage_id,
    empresa: umDe(o.organizations)?.trade_name ?? "Sem empresa",
    estimated_value: o.estimated_value === null ? null : Number(o.estimated_value),
    next_action: o.next_action,
    next_action_at: o.next_action_at,
    closed_reason: o.closed_reason,
  }));
  const quadro = montarQuadro(etapas, oportunidades);
  const podeEditar = acesso.pode("opportunities.update");
  const hoje = diaDe(new Date());

  return (
    <main className="mx-auto grid max-w-[1500px] gap-7 px-6 py-12">
      <header className="grid gap-2">
        <Chamada>
          <Link href="/admin" className="text-terra-texto underline">
            Ambiente administrativo
          </Link>
        </Chamada>
        <Titulo>Funil comercial</Titulo>
        <p className="text-mudo" data-testid="funil-resumo">
          {quadro.emAberto} oportunidade(s) em aberto, somando {brl(quadro.valorEmAberto)}.
          Contratos fechados: {brl(quadro.valorGanho)}.
        </p>
      </header>

      {acesso.pode("opportunities.create") ? (
        <Cartao className="grid gap-3">
          <h2 className="font-display text-xl">Nova oportunidade</h2>
          {(empresasR.data ?? []).length ? (
            <NovaOportunidade empresas={empresasR.data ?? []} />
          ) : (
            <p className="text-mudo text-sm">
              Cadastre uma empresa antes em{" "}
              <Link href="/admin/empresas" className="text-terra-texto underline">
                Empresas
              </Link>
              .
            </p>
          )}
        </Cartao>
      ) : null}

      <div className="overflow-x-auto pb-2">
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${quadro.colunas.length}, minmax(15rem, 1fr))` }}
        >
          {quadro.colunas.map(({ etapa, itens, total }) => (
            <section
              key={etapa.id}
              aria-labelledby={`etapa-${etapa.id}`}
              className="bg-papel border-linho grid content-start gap-2.5 rounded-2xl border p-3"
            >
              <header className="grid">
                <h2 id={`etapa-${etapa.id}`} className="font-display text-[1.05rem] font-semibold">
                  {etapa.name}
                </h2>
                <span className="text-mudo text-xs">
                  {itens.length} · {brl(total)}
                </span>
              </header>
              {itens.length === 0 ? <p className="text-mudo m-0 text-[13px]">Vazia.</p> : null}
              <ul className="m-0 grid list-none gap-2 p-0">
                {itens.map((o) => {
                  const dia = o.next_action_at ? diaDe(o.next_action_at) : null;
                  const atrasada = dia !== null && dia < hoje && !etapa.is_closed;
                  return (
                    <li
                      key={o.id}
                      className="border-linho bg-porcelana grid gap-1.5 rounded-xl border p-2.5"
                    >
                      <span className="font-semibold">{o.title}</span>
                      <span className="text-mudo text-[13px]">
                        {o.empresa}
                        {o.estimated_value !== null ? ` · ${brl(o.estimated_value)}` : ""}
                      </span>
                      {o.next_action ? (
                        <span className={`text-[13px] ${atrasada ? "text-critico" : ""}`}>
                          {dia ? `${dataCurta(dia)}: ` : ""}
                          {o.next_action}
                          {atrasada ? " (atrasada)" : ""}
                        </span>
                      ) : !etapa.is_closed ? (
                        <span className="text-atencao text-[13px]">Sem próxima ação</span>
                      ) : null}
                      {etapa.is_closed && o.closed_reason ? (
                        <span className="text-mudo text-[13px]">Motivo: {o.closed_reason}</span>
                      ) : null}
                      {podeEditar ? <EditarOportunidade o={o} etapas={etapas} /> : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
