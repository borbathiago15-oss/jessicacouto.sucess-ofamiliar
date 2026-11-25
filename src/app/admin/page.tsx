import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { enforceAdminRoute } from "@/lib/auth/guard";
import { ADMIN_LOGIN } from "@/lib/auth/admin-routes";
import { PORTAL_HOME } from "@/lib/auth/destino";
import { umDe } from "@/lib/supabase/relacao";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Selo } from "@/components/ui";
import { ROTULO_NIVEL, TOM_NIVEL, type Nivel } from "@/modules/diagnostico/schema";
import { revokeOtherSessions } from "./actions";
import { FormMessage, buttonClass } from "./_components/auth-card";

const accessSchema = z.object({
  user_id: z.uuid(),
  aal2: z.boolean(),
  session_valid: z.boolean(),
  is_active: z.boolean(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
});

const roleNames: Record<string, string> = {
  admin: "Administradora",
  relationship: "Equipe de relacionamento",
  methodology_analyst: "Analista metodológico",
  executive_viewer: "Leitura executiva",
};

const fuso = "America/Sao_Paulo";
const dataCurta = (v: string) =>
  new Date(v).toLocaleDateString("pt-BR", { timeZone: fuso, day: "2-digit", month: "short" });
const dataHora = (v: string) =>
  new Date(v).toLocaleString("pt-BR", {
    timeZone: fuso,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

type Supabase = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

/** Números e listas do painel, cada bloco só para quem tem a permissão. */
async function carregarPainel(supabase: Supabase, pode: (p: string) => boolean) {
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const contar = (tabela: string) =>
    supabase
      .from(tabela)
      .select("id", { count: "exact", head: true })
      .gte("created_at", desde) as PromiseLike<{ count: number | null }>;
  const vazio = Promise.resolve({ count: null as number | null });
  const nada = Promise.resolve({ data: null });

  const [
    contatos,
    diagnosticos,
    pedidos,
    etapas,
    oportunidades,
    proximas,
    tarefas,
    recentes,
    alertas,
  ] = await Promise.all([
    pode("participants.read") ? contar("participants") : vazio,
    pode("diagnostics.read_answers") ? contar("triage_submissions") : vazio,
    pode("cms.read") ? contar("material_downloads") : vazio,
    pode("opportunities.read")
      ? supabase
          .from("pipeline_stages")
          .select("id, name, position, is_closed")
          .eq("is_active", true)
          .order("position")
      : nada,
    pode("opportunities.read")
      ? supabase.from("opportunities").select("stage_id").limit(2000)
      : nada,
    pode("opportunities.read")
      ? supabase
          .from("opportunities")
          .select("id, title, next_action, next_action_at, pipeline_stages!inner(is_closed)")
          .eq("pipeline_stages.is_closed", false)
          .not("next_action_at", "is", null)
          .order("next_action_at")
          .limit(5)
      : nada,
    pode("activities.read")
      ? supabase
          .from("activities")
          .select("id, summary, due_at")
          .eq("kind", "task")
          .is("completed_at", null)
          .order("due_at", { nullsFirst: false })
          .limit(5)
      : nada,
    pode("activities.read")
      ? supabase
          .from("activities")
          .select("id, summary, created_at, participants(full_name), organizations(trade_name)")
          .neq("kind", "task")
          .order("created_at", { ascending: false })
          .limit(7)
      : nada,
    pode("vault.read")
      ? supabase
          .from("security_alerts")
          .select("id", { count: "exact", head: true })
          .is("seen_at", null)
      : vazio,
  ]);

  const porEtapa = new Map<string, number>();
  for (const o of (oportunidades.data ?? []) as { stage_id: string }[])
    porEtapa.set(o.stage_id, (porEtapa.get(o.stage_id) ?? 0) + 1);
  const funil = ((etapas.data ?? []) as { id: string; name: string; is_closed: boolean }[])
    .filter((e) => !e.is_closed)
    .map((e) => ({ nome: e.name, total: porEtapa.get(e.id) ?? 0 }));

  return {
    contatos: contatos.count,
    diagnosticos: diagnosticos.count,
    pedidos: pedidos.count,
    abertas: pode("opportunities.read") ? funil.reduce((s, e) => s + e.total, 0) : null,
    funil,
    proximas: (proximas.data ?? []) as {
      id: string;
      title: string;
      next_action: string | null;
      next_action_at: string;
    }[],
    tarefas: (tarefas.data ?? []) as { id: string; summary: string; due_at: string | null }[],
    recentes: (recentes.data ?? []) as {
      id: string;
      summary: string;
      created_at: string;
      participants: unknown;
      organizations: unknown;
    }[],
    alertas: alertas.count,
  };
}

type Lead = {
  id: string;
  nome: string;
  origem: string;
  quando: string;
  href: string;
  nivel: Nivel | null;
};

/** Clientes com etapa e atalhos, e os leads mais recentes do site. */
async function carregarCerebro(supabase: Supabase, pode: (p: string) => boolean) {
  const nada = Promise.resolve({ data: null });
  const [empresas, diagnosticos, pedidos] = await Promise.all([
    pode("organizations.read")
      ? supabase
          .from("organizations")
          .select(
            "id, trade_name, updated_at, opportunities(updated_at, pipeline_stages(name, is_closed))",
          )
          .order("updated_at", { ascending: false })
          .limit(8)
      : nada,
    pode("diagnostics.read_answers")
      ? supabase
          .from("triage_submissions")
          .select("id, level, created_at, participants(full_name)")
          .order("created_at", { ascending: false })
          .limit(6)
      : nada,
    pode("cms.read")
      ? supabase
          .from("material_downloads")
          .select("id, created_at, participants(full_name), materials(title)")
          .order("created_at", { ascending: false })
          .limit(6)
      : nada,
  ]);

  type Op = { updated_at: string; pipeline_stages: unknown };
  const clientes = (
    (empresas.data ?? []) as {
      id: string;
      trade_name: string;
      updated_at: string;
      opportunities: Op[] | null;
    }[]
  ).map((e) => {
    const abertas = (e.opportunities ?? [])
      .map((o) => ({
        quando: o.updated_at,
        etapa: umDe(o.pipeline_stages as never) as unknown as
          { name: string; is_closed: boolean } | undefined,
      }))
      .filter((o) => o.etapa && !o.etapa.is_closed)
      .sort((a, b) => b.quando.localeCompare(a.quando));
    const ultima = [e.updated_at, ...(e.opportunities ?? []).map((o) => o.updated_at)]
      .sort()
      .at(-1)!;
    return {
      id: e.id,
      nome: e.trade_name,
      etapa: abertas[0]?.etapa?.name ?? null,
      atualizada: ultima,
    };
  });

  const nomeDe = (r: unknown) =>
    (umDe(r as never) as unknown as { full_name?: string } | undefined)?.full_name ??
    "Pessoa removida";
  const leads: Lead[] = [
    ...(
      (diagnosticos.data ?? []) as {
        id: string;
        level: Nivel;
        created_at: string;
        participants: unknown;
      }[]
    ).map((d) => ({
      id: `d-${d.id}`,
      nome: nomeDe(d.participants),
      origem: "Diagnóstico de Sucessão",
      quando: d.created_at,
      href: "/admin/diagnostico",
      nivel: d.level,
    })),
    ...(
      (pedidos.data ?? []) as {
        id: string;
        created_at: string;
        participants: unknown;
        materials: unknown;
      }[]
    ).map((m) => ({
      id: `m-${m.id}`,
      nome: nomeDe(m.participants),
      origem: `Baixou: ${(umDe(m.materials as never) as unknown as { title?: string } | undefined)?.title ?? "material"}`,
      quando: m.created_at,
      href: "/admin/materiais",
      nivel: null,
    })),
  ]
    .sort((a, b) => b.quando.localeCompare(a.quando))
    .slice(0, 7);

  return { clientes, leads };
}

function Indicador({
  rotulo,
  valor,
  detalhe,
  href,
  testid,
}: {
  rotulo: string;
  valor: number | null;
  detalhe: string;
  href: string;
  testid: string;
}) {
  if (valor === null) return null;
  return (
    <Link
      href={href}
      data-testid={testid}
      className="bg-papel border-linho hover:border-terra group grid gap-1 rounded-2xl border px-5 py-4 no-underline transition-colors"
    >
      <span className="text-mudo text-[13px] font-semibold">{rotulo}</span>
      <span className="font-display text-cacau text-[2.4rem] leading-none font-semibold">
        {valor}
      </span>
      <span className="text-mudo text-[12.5px]">{detalhe}</span>
    </Link>
  );
}

function Painel({
  titulo,
  acao,
  children,
}: {
  titulo: string;
  acao?: { href: string; rotulo: string };
  children: React.ReactNode;
}) {
  const id = `painel-${titulo.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section
      aria-labelledby={id}
      className="bg-papel border-linho grid content-start gap-3 rounded-2xl border px-5 py-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="font-display m-0 text-[1.2rem] font-semibold">
          {titulo}
        </h2>
        {acao ? (
          <Link href={acao.href} className="text-terra-texto text-[13px] font-semibold">
            {acao.rotulo}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ sessoes?: string }>;
}) {
  await enforceAdminRoute("/admin");
  const { sessoes } = await searchParams;
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect(`${ADMIN_LOGIN}?erro=configuracao`);

  // O próprio banco informa se a sessão continua válida (revogação imediata).
  const { data, error } = await supabase.rpc("my_access");
  const access = accessSchema.safeParse(data);
  if (error || !access.success || !access.data.session_valid || !access.data.is_active) {
    redirect("/admin/sair?motivo=sessao");
  }
  if (!access.data.aal2) redirect("/admin/mfa/verificar");

  const { roles, permissions } = access.data;
  // Cliente convidado não usa o painel da equipe: vai ao portal.
  if (roles.length === 0) {
    const { data: empresas } = await supabase.rpc("portal_my_organizations");
    if (Array.isArray(empresas) && empresas.length > 0) redirect(PORTAL_HOME);
    return (
      <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-6 px-6 py-16">
        <header className="flex items-start justify-between gap-4">
          <h1 className="font-display text-[2rem] leading-tight font-semibold">
            Ambiente da equipe JC
          </h1>
          <form action="/admin/sair" method="post">
            <button type="submit" className="text-terra-texto text-sm underline">
              Sair
            </button>
          </form>
        </header>
        <p data-testid="no-roles">Nenhum papel atribuído. Solicite acesso a uma administradora.</p>
      </main>
    );
  }

  const permissoes = new Set(permissions);
  const pode = (p: string) => permissoes.has(p);
  const [p, c, perfil] = await Promise.all([
    carregarPainel(supabase, pode),
    carregarCerebro(supabase, pode),
    supabase.from("profiles").select("display_name").eq("id", access.data.user_id).maybeSingle(),
  ]);
  const nome = perfil.data?.display_name?.trim().split(" ")[0];
  const maiorEtapa = Math.max(1, ...p.funil.map((e) => e.total));

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-5 py-8 sm:px-8 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <p className="text-terra-texto m-0 text-[13.5px] font-semibold">Painel</p>
          <h1 className="font-display m-0 text-[clamp(1.9rem,3.4vw,2.5rem)] leading-tight font-semibold">
            {nome ? `Olá, ${nome}` : "Olá"}
          </h1>
          <p className="text-mudo m-0">
            O que aconteceu nos últimos 30 dias e o que vem pela frente.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {pode("diagnostics.read_answers") ? (
            <Link href="/admin/diagnostico" className={buttonClass}>
              Ver respostas recentes
            </Link>
          ) : null}
        </div>
      </header>

      {sessoes ? <FormMessage tone="info">As outras sessões foram encerradas.</FormMessage> : null}

      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          rotulo="Novos contatos"
          valor={p.contatos}
          detalhe="pessoas que entraram no CRM"
          href="/admin/funil"
          testid="kpi-contatos"
        />
        <Indicador
          rotulo="Diagnósticos respondidos"
          valor={p.diagnosticos}
          detalhe="pelo site, nos últimos 30 dias"
          href="/admin/diagnostico"
          testid="kpi-diagnosticos"
        />
        <Indicador
          rotulo="Pedidos do guia"
          valor={p.pedidos}
          detalhe="cadastros com download"
          href="/admin/materiais"
          testid="kpi-pedidos"
        />
        <Indicador
          rotulo="Oportunidades abertas"
          valor={p.abertas}
          detalhe="em andamento no funil"
          href="/admin/funil"
          testid="kpi-oportunidades"
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {pode("organizations.read") ? (
          <Painel titulo="Clientes" acao={{ href: "/admin/empresas", rotulo: "Todas as empresas" }}>
            {c.clientes.length === 0 ? (
              <p className="text-mudo m-0 text-sm">
                Nenhum cliente ainda. No funil, use “Converter em cliente”.
              </p>
            ) : (
              <ul className="m-0 grid list-none gap-0 p-0" data-testid="painel-clientes">
                {c.clientes.map((e) => (
                  <li
                    key={e.id}
                    className="border-linho grid gap-1.5 border-b py-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <span className="grid gap-0.5">
                      <Link
                        href={`/admin/empresas/${e.id}`}
                        className="text-cacau text-[15px] font-semibold"
                      >
                        {e.nome}
                      </Link>
                      <span className="text-mudo text-[12.5px]">
                        {e.etapa ?? "Sem oportunidade aberta"} · atualizada em{" "}
                        {dataCurta(e.atualizada)}
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
                      {pode("analyses.read") ? (
                        <>
                          <Link
                            href={`/admin/empresas/${e.id}/raio-x`}
                            className="text-terra-texto"
                          >
                            Raio-X<span className="sr-only"> de {e.nome}</span>
                          </Link>
                          <Link
                            href={`/admin/empresas/${e.id}/relatorio`}
                            className="text-terra-texto"
                          >
                            Relatório<span className="sr-only"> de {e.nome}</span>
                          </Link>
                        </>
                      ) : null}
                      {pode("portal.manage") ? (
                        <Link href={`/admin/empresas/${e.id}/portal`} className="text-terra-texto">
                          Portal<span className="sr-only"> de {e.nome}</span>
                        </Link>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Painel>
        ) : null}

        {c.leads.length ? (
          <Painel titulo="Leads do site">
            <ul className="m-0 grid list-none gap-0 p-0" data-testid="painel-leads">
              {c.leads.map((l) => (
                <li
                  key={l.id}
                  className="border-linho grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b py-2.5 last:border-0"
                >
                  <span className="grid gap-0.5">
                    <Link href={l.href} className="text-cacau text-[14px] font-semibold">
                      {l.nome}
                    </Link>
                    <span className="text-mudo text-[12.5px]">
                      {l.origem} · {dataHora(l.quando)}
                    </span>
                  </span>
                  {l.nivel ? <Selo tom={TOM_NIVEL[l.nivel]}>{ROTULO_NIVEL[l.nivel]}</Selo> : null}
                </li>
              ))}
            </ul>
          </Painel>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {pode("opportunities.read") ? (
          <Painel titulo="Funil por etapa" acao={{ href: "/admin/funil", rotulo: "Abrir o funil" }}>
            {p.funil.length === 0 ? (
              <p className="text-mudo m-0 text-sm">Nenhuma etapa configurada.</p>
            ) : (
              <ul className="m-0 grid list-none gap-2.5 p-0" data-testid="painel-funil">
                {p.funil.map((e) => (
                  <li
                    key={e.nome}
                    className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_2rem] items-center gap-3"
                  >
                    <span className="truncate text-[14px]">{e.nome}</span>
                    <span
                      className="bg-linho h-2.5 overflow-hidden rounded-full"
                      aria-hidden="true"
                    >
                      <span
                        className="bg-terra block h-full rounded-full"
                        style={{ width: `${(e.total / maiorEtapa) * 100}%` }}
                      />
                    </span>
                    <b className="text-right text-[14px]">{e.total}</b>
                  </li>
                ))}
              </ul>
            )}
          </Painel>
        ) : null}

        {pode("opportunities.read") || pode("activities.read") ? (
          <Painel
            titulo="Próximas ações"
            acao={{ href: "/admin/agenda", rotulo: "Abrir a agenda" }}
          >
            {p.proximas.length === 0 && p.tarefas.length === 0 ? (
              <p className="text-mudo m-0 text-sm">Nada agendado. Bom momento para planejar.</p>
            ) : (
              <ul className="m-0 grid list-none gap-0 p-0" data-testid="painel-proximas">
                {p.proximas.map((o) => (
                  <li
                    key={o.id}
                    className="border-linho grid gap-0.5 border-b py-2.5 last:border-0"
                  >
                    <span className="text-[14px] font-semibold">{o.next_action ?? o.title}</span>
                    <span className="text-mudo text-[12.5px]">
                      {o.title} · {dataCurta(o.next_action_at)}
                    </span>
                  </li>
                ))}
                {p.tarefas.map((t) => (
                  <li
                    key={t.id}
                    className="border-linho grid gap-0.5 border-b py-2.5 last:border-0"
                  >
                    <span className="text-[14px] font-semibold">{t.summary}</span>
                    <span className="text-mudo text-[12.5px]">
                      Tarefa{t.due_at ? ` · ${dataCurta(t.due_at)}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Painel>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        {pode("activities.read") ? (
          <Painel titulo="Atividade recente">
            {p.recentes.length === 0 ? (
              <p className="text-mudo m-0 text-sm">Nenhuma atividade registrada ainda.</p>
            ) : (
              <ul className="m-0 grid list-none gap-0 p-0" data-testid="painel-atividades">
                {p.recentes.map((a) => {
                  const pessoa = umDe(a.participants as never) as unknown as {
                    full_name?: string;
                  } | null;
                  const empresa = umDe(a.organizations as never) as unknown as {
                    trade_name?: string;
                  } | null;
                  return (
                    <li
                      key={a.id}
                      className="border-linho grid grid-cols-[0.6rem_minmax(0,1fr)] gap-3 border-b py-2.5 last:border-0"
                    >
                      <span className="bg-terra mt-[7px] size-2 rounded-full" aria-hidden="true" />
                      <span className="grid gap-0.5">
                        <span className="text-[14px]">{a.summary}</span>
                        <span className="text-mudo text-[12.5px]">
                          {[pessoa?.full_name, empresa?.trade_name, dataHora(a.created_at)]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Painel>
        ) : null}

        <Painel titulo="Sua conta e segurança">
          <ul data-testid="roles" className="m-0 flex list-none flex-wrap gap-2 p-0">
            {roles.map((role) => (
              <li
                key={role}
                className="bg-blush text-terra-texto rounded-full px-3 py-1 text-[13px] font-semibold"
              >
                {roleNames[role] ?? role}
              </li>
            ))}
          </ul>
          <p className="text-mudo m-0 text-[13.5px]" data-testid="permission-count">
            {permissions.length} permissões ativas · verificação em duas etapas concluída
          </p>
          {p.alertas !== null ? (
            <p className="m-0 text-[14px]" data-testid="alertas-resumo">
              {p.alertas
                ? `${p.alertas === 1 ? "1 alerta" : `${p.alertas} alertas`} de segurança em aberto. `
                : "Nenhum alerta de segurança em aberto. "}
              <Link href="/admin/seguranca" className="text-terra-texto underline">
                Ver alertas
              </Link>
            </p>
          ) : null}
          <form action={revokeOtherSessions}>
            <button type="submit" className={buttonClass}>
              Encerrar minhas outras sessões
            </button>
          </form>
        </Painel>
      </div>
    </main>
  );
}
