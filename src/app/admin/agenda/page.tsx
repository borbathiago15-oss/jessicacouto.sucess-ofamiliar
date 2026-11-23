import Link from "next/link";
import { redirect } from "next/navigation";
import { Cartao, Chamada, Selo, Titulo } from "@/components/ui";
import { meuAcesso } from "@/lib/auth/access";
import { enforceAdminRoute } from "@/lib/auth/guard";
import { umDe } from "@/lib/supabase/relacao";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  agruparAgenda,
  diaDe,
  GRUPOS_AGENDA,
  ROTULO_GRUPO,
  type ItemAgenda,
} from "@/modules/funil/schema";
import { ConcluirTarefa, NovaTarefa } from "../funil/formularios";

export const metadata = { title: "Agenda" };

const dataCurta = (dia: string) => dia.split("-").reverse().join("/");

export default async function AgendaPage() {
  await enforceAdminRoute("/admin/agenda");
  const acesso = await meuAcesso();
  if (!acesso?.session_valid) redirect("/admin/sair?motivo=sessao");

  if (!acesso.pode("activities.read")) {
    return (
      <main className="mx-auto grid max-w-3xl gap-4 px-6 py-16">
        <Titulo>Agenda</Titulo>
        <p>Você não tem acesso à agenda. Peça a uma administradora.</p>
      </main>
    );
  }

  const supabase = (await createSupabaseServerClient())!;
  const [tarefasR, acoesR, empresasR] = await Promise.all([
    supabase
      .from("activities")
      .select("id, summary, due_at, organization_id, organizations(trade_name)")
      .eq("kind", "task")
      .is("completed_at", null)
      .not("due_at", "is", null)
      .order("due_at")
      .limit(300),
    acesso.pode("opportunities.read")
      ? supabase
          .from("opportunities")
          .select(
            "id, title, next_action, next_action_at, organizations(trade_name), pipeline_stages(is_closed)",
          )
          .not("next_action_at", "is", null)
          .limit(300)
      : Promise.resolve({ data: [] }),
    acesso.pode("organizations.read")
      ? supabase.from("organizations").select("id, trade_name").order("trade_name")
      : Promise.resolve({ data: [] }),
  ]);

  const itens: ItemAgenda[] = [
    ...(tarefasR.data ?? []).map<ItemAgenda>((t) => ({
      id: t.id,
      tipo: "tarefa",
      texto: t.summary,
      empresa: umDe(t.organizations)?.trade_name ?? "Sem empresa",
      dia: diaDe(t.due_at!),
      href: t.organization_id ? `/admin/empresas/${t.organization_id}/historico` : "/admin/agenda",
    })),
    ...(acoesR.data ?? [])
      .filter((o) => !umDe(o.pipeline_stages)?.is_closed)
      .map<ItemAgenda>((o) => ({
        id: o.id,
        tipo: "proxima_acao",
        texto: `${o.next_action ?? "Próxima ação"} (${o.title})`,
        empresa: umDe(o.organizations)?.trade_name ?? "Sem empresa",
        dia: diaDe(o.next_action_at!),
        href: "/admin/funil",
      })),
  ];
  const hoje = diaDe(new Date());
  const grupos = agruparAgenda(itens, hoje);
  const podeConcluir = acesso.pode("activities.update");

  return (
    <main className="mx-auto grid max-w-4xl gap-8 px-6 py-14">
      <header className="grid gap-2">
        <Chamada>
          <Link href="/admin" className="text-terra-texto underline">
            Ambiente administrativo
          </Link>
        </Chamada>
        <Titulo>Agenda</Titulo>
        <p className="text-mudo max-w-[62ch]">
          Tarefas em aberto e próximas ações do funil, das empresas que você acompanha.
        </p>
      </header>

      {acesso.pode("activities.create") && (empresasR.data ?? []).length ? (
        <Cartao className="grid gap-3">
          <h2 className="font-display text-xl">Nova tarefa</h2>
          <NovaTarefa empresas={empresasR.data ?? []} hoje={hoje} />
        </Cartao>
      ) : null}

      {itens.length === 0 ? (
        <p className="text-mudo">Nada pendente.</p>
      ) : (
        GRUPOS_AGENDA.map((g) =>
          grupos[g].length ? (
            <section key={g} aria-labelledby={`grupo-${g}`} className="grid gap-2">
              <h2
                id={`grupo-${g}`}
                className={`font-display text-xl ${g === "atrasadas" ? "text-critico" : ""}`}
              >
                {ROTULO_GRUPO[g]} ({grupos[g].length})
              </h2>
              <ul
                className="border-linho m-0 grid list-none border-t p-0"
                data-testid={`agenda-${g}`}
              >
                {grupos[g].map((item) => (
                  <li
                    key={`${item.tipo}-${item.id}`}
                    className="border-linho flex flex-wrap items-center justify-between gap-3 border-b py-3"
                  >
                    <span className="grid">
                      <span>{item.texto}</span>
                      <span className="text-mudo text-[13px]">
                        {dataCurta(item.dia)} ·{" "}
                        <Link href={item.href} className="text-terra-texto underline">
                          {item.empresa}
                        </Link>
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <Selo tom={item.tipo === "tarefa" ? "neutro" : "marca"}>
                        {item.tipo === "tarefa" ? "Tarefa" : "Funil"}
                      </Selo>
                      {item.tipo === "tarefa" && podeConcluir ? (
                        <ConcluirTarefa id={item.id} texto={item.texto} />
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null,
        )
      )}
    </main>
  );
}
