import Link from "next/link";
import { Cartao, Chamada, Selo, Titulo } from "@/components/ui";
import { diaDe } from "@/modules/funil/schema";
import {
  atrasados,
  FASES,
  montarMatriz,
  ordenar,
  QUADRANTES,
  ROTULO_FASE,
  ROTULO_ORIGEM,
  ROTULO_QUADRANTE,
  type ItemPrioridade,
} from "@/modules/prioridades/schema";
import { carregarEmpresa } from "../carregar";
import { EditarItem, NovoItem } from "./formularios";
import { Compartilhar } from "../portal/controles";

export const metadata = { title: "Matriz de Prioridades" };

const dataCurta = (dia: string) => dia.split("-").reverse().join("/");

export default async function PrioridadesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { acesso, supabase, empresa } = await carregarEmpresa(
    id,
    `/admin/empresas/${id}/prioridades`,
    "analyses.read",
  );
  const { data } = await supabase
    .from("priority_items")
    .select(
      "id, title, description, origin, impact, urgency, effort, phase, why, responsible, due_on, indicator, target, result, learning, shared_with_client",
    )
    .eq("organization_id", id);

  const itens = (data ?? []) as (ItemPrioridade & { shared_with_client: boolean })[];
  const matriz = montarMatriz(itens);
  const hoje = diaDe(new Date());
  const vencidos = new Set(atrasados(itens, hoje).map((i) => i.id));
  const podeEditar = acesso.pode("analyses.manage");

  return (
    <main className="mx-auto grid max-w-[1320px] gap-8 px-6 py-12">
      <header className="grid gap-2">
        <Chamada>
          <Link href={`/admin/empresas/${id}`} className="text-terra-texto underline">
            {empresa.trade_name}
          </Link>
        </Chamada>
        <Titulo>Matriz de Prioridades</Titulo>
        <p className="text-mudo max-w-[70ch]">
          Os achados das ferramentas e das conversas, priorizados por impacto e urgência. Cada
          prioridade segue o ciclo PDCA: planejar, executar, verificar e agir.
        </p>
      </header>

      <section aria-labelledby="matriz" className="grid gap-3">
        <h2 id="matriz" className="font-display text-xl">
          Matriz
        </h2>
        {itens.length === 0 ? (
          <p className="text-mudo">
            Nenhuma prioridade ainda. Inclua abaixo ou leve um ponto de atenção do{" "}
            <Link href={`/admin/empresas/${id}/raio-x`} className="text-terra-texto underline">
              Raio-X Financeiro
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2" data-testid="matriz">
            {QUADRANTES.map((q) => (
              <section
                key={q}
                aria-labelledby={`q-${q}`}
                className={`grid content-start gap-2 rounded-2xl border p-4 ${
                  q === "agora" ? "border-terra bg-blush/40" : "border-linho bg-papel"
                }`}
              >
                <header>
                  <h3 id={`q-${q}`} className="font-display text-lg font-semibold">
                    {ROTULO_QUADRANTE[q].titulo}
                  </h3>
                  <span className="text-mudo text-xs">{ROTULO_QUADRANTE[q].ajuda}</span>
                </header>
                {matriz[q].length === 0 ? (
                  <p className="text-mudo m-0 text-[13px]">Nada aqui.</p>
                ) : (
                  <ol className="m-0 grid gap-1.5 pl-5 text-[15px]">
                    {matriz[q].map((i) => (
                      <li key={i.id}>
                        {i.title}{" "}
                        <span className="text-mudo text-xs">
                          · {ROTULO_FASE[i.phase]} · esforço {i.effort}
                          {vencidos.has(i.id) ? " · prazo vencido" : ""}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            ))}
          </div>
        )}
      </section>

      {itens.length > 0 ? (
        <section aria-labelledby="pdca" className="grid gap-3">
          <h2 id="pdca" className="font-display text-xl">
            Ciclo PDCA
          </h2>
          <div className="overflow-x-auto pb-2">
            <div className="grid min-w-[60rem] grid-cols-6 gap-3">
              {FASES.map((f) => {
                const lista = ordenar(itens.filter((i) => i.phase === f));
                return (
                  <section
                    key={f}
                    aria-labelledby={`fase-${f}`}
                    className="bg-papel border-linho grid content-start gap-2 rounded-2xl border p-3"
                  >
                    <h3 id={`fase-${f}`} className="font-display font-semibold">
                      {ROTULO_FASE[f]} ({lista.length})
                    </h3>
                    <ul className="m-0 grid list-none gap-2 p-0">
                      {lista.map((i) => (
                        <li
                          key={i.id}
                          className="border-linho bg-porcelana grid gap-1.5 rounded-xl border p-2.5"
                        >
                          <span className="font-semibold">{i.title}</span>
                          <span className="text-mudo text-xs">
                            Impacto {i.impact} · urgência {i.urgency} · esforço {i.effort}
                          </span>
                          {i.responsible || i.due_on ? (
                            <span
                              className={`text-[13px] ${vencidos.has(i.id) ? "text-critico" : ""}`}
                            >
                              {i.responsible ?? "Sem responsável"}
                              {i.due_on ? ` · até ${dataCurta(i.due_on)}` : ""}
                              {vencidos.has(i.id) ? " (vencido)" : ""}
                            </span>
                          ) : null}
                          {i.origin !== "manual" ? (
                            <Selo tom="marca">{ROTULO_ORIGEM[i.origin]}</Selo>
                          ) : null}
                          {acesso.pode("portal.manage") ? (
                            <Compartilhar
                              empresaId={id}
                              tipo="plano"
                              id={i.id}
                              inicial={i.shared_with_client}
                              rotulo={i.title}
                            />
                          ) : null}
                          {podeEditar ? <EditarItem empresaId={id} item={i} /> : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {podeEditar ? (
        <Cartao className="grid gap-4">
          <h2 className="font-display text-xl">Nova prioridade</h2>
          <NovoItem empresaId={id} />
        </Cartao>
      ) : null}
    </main>
  );
}
