import Link from "next/link";
import { Cartao, Chamada, Selo, Titulo } from "@/components/ui";
import { analisarOrganograma, LIMITES, resumoDoOrganograma } from "@/modules/organograma/analise";
import { ArvoreOrganograma } from "@/modules/organograma/arvore";
import { compararEstruturas } from "@/modules/organograma/comparar";
import {
  COLUNAS_CARGO,
  ROTULO_CENARIO,
  type Cargo,
  type Cenario,
} from "@/modules/organograma/schema";
import { carregarEmpresa } from "../carregar";
import {
  CompartilharProposta,
  CopiarAtual,
  EditarCargo,
  NovoCargo,
  PontosComMatriz,
  ResumoProposta,
} from "./formularios";

export const metadata = { title: "Organograma" };

const ABAS = [
  { ver: "atual", rotulo: "Estrutura atual" },
  { ver: "proposta", rotulo: "Proposta JC" },
  { ver: "comparar", rotulo: "Antes e depois" },
] as const;
type Aba = (typeof ABAS)[number]["ver"];

function Fato({ rotulo, valor }: { rotulo: string; valor: string | number }) {
  return (
    <div className="border-linho bg-porcelana rounded-xl border px-3 py-2.5">
      <span className="text-mudo block text-xs">{rotulo}</span>
      <b className="font-display text-[1.3rem]">{valor}</b>
    </div>
  );
}

export default async function OrganogramaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ver?: string }>;
}) {
  const { id } = await params;
  const { ver } = await searchParams;
  const aba: Aba = ABAS.some((a) => a.ver === ver) ? (ver as Aba) : "atual";
  const { acesso, supabase, empresa } = await carregarEmpresa(
    id,
    `/admin/empresas/${id}/organograma`,
    "analyses.read",
  );
  const [{ data: linhas }, { data: carta }] = await Promise.all([
    supabase
      .from("org_positions")
      .select(`${COLUNAS_CARGO}, scenario`)
      .eq("organization_id", id)
      .order("title"),
    supabase
      .from("org_charts")
      .select("proposal_summary, shared_with_client, shared_at")
      .eq("organization_id", id)
      .maybeSingle(),
  ]);
  const todos = (linhas ?? []) as (Cargo & { scenario: Cenario })[];
  const atual = todos.filter((c) => c.scenario === "current");
  const proposta = todos.filter((c) => c.scenario === "proposed");
  const podeEditar = acesso.pode("analyses.manage");
  const podePortal = acesso.pode("portal.manage");

  const base = `/admin/empresas/${id}/organograma`;
  const cenario: Cenario = aba === "proposta" ? "proposed" : "current";
  const cargos = cenario === "proposed" ? proposta : atual;
  const achados = analisarOrganograma(cargos);
  const resumo = resumoDoOrganograma(cargos);
  const opcoes = cargos.map((c) => ({ id: c.id, title: c.title, holder_name: c.holder_name }));

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-6 py-14">
      <header className="grid gap-2">
        <Chamada>
          <Link href={`/admin/empresas/${id}`} className="text-terra-texto underline">
            {empresa.trade_name}
          </Link>
        </Chamada>
        <Titulo>Organograma</Titulo>
        <p className="text-mudo max-w-[68ch]">
          Como a empresa está organizada hoje, onde a estrutura trava e como a JC propõe
          reorganizá-la, com o porquê de cada mudança.
        </p>
      </header>

      <nav aria-label="Visões do organograma" className="border-linho flex gap-1 border-b">
        {ABAS.map((a) => (
          <Link
            key={a.ver}
            href={`${base}?ver=${a.ver}`}
            aria-current={a.ver === aba ? "page" : undefined}
            className={
              a.ver === aba
                ? "border-terra -mb-px border-b-2 px-3.5 py-2 text-[15px] font-semibold"
                : "text-mudo hover:text-terra-texto px-3.5 py-2 text-[15px]"
            }
          >
            {a.rotulo}
            {a.ver === "proposta" && carta?.shared_with_client ? (
              <span className="text-ok ml-1.5 text-xs font-normal">no portal</span>
            ) : null}
          </Link>
        ))}
      </nav>

      {aba === "comparar" ? (
        <Comparacao
          atual={atual}
          proposta={proposta}
          resumo={carta?.proposal_summary ?? null}
          base={base}
        />
      ) : (
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
          <section aria-labelledby="estrutura" className="grid gap-4">
            <h2 id="estrutura" className="font-display text-xl">
              {ROTULO_CENARIO[cenario]}
            </h2>
            {cenario === "proposed" && podeEditar ? (
              <Cartao className="grid gap-3" superficie="borda">
                {proposta.length ? (
                  <p className="text-mudo m-0 text-sm">
                    Edite cada cargo e registre o porquê da mudança. A comparação com a estrutura
                    atual fica em “Antes e depois”.
                  </p>
                ) : (
                  <p className="m-0 text-[15px]">
                    A proposta ainda não começou. O caminho mais rápido é partir da estrutura atual
                    e ajustar o que muda; também dá para montar do zero abaixo.
                  </p>
                )}
                <CopiarAtual empresaId={id} substitui={proposta.length > 0} />
              </Cartao>
            ) : null}
            {cargos.length ? (
              <ArvoreOrganograma
                cargos={cargos}
                rotulo={ROTULO_CENARIO[cenario]}
                testid={`organograma-${cenario}`}
                acao={
                  podeEditar
                    ? (c) => (
                        <EditarCargo empresaId={id} cargo={c} cenario={cenario} opcoes={opcoes} />
                      )
                    : undefined
                }
              />
            ) : (
              <p className="text-mudo">
                {cenario === "current"
                  ? "Nenhum cargo registrado. Comece pelo topo (quem decide por último) e desça."
                  : "Nenhum cargo na proposta."}
              </p>
            )}
            {podeEditar ? (
              <Cartao className="grid gap-4">
                <h3 className="font-display text-lg">Incluir cargo</h3>
                <NovoCargo empresaId={id} cenario={cenario} opcoes={opcoes} />
              </Cartao>
            ) : null}
          </section>

          <aside className="grid gap-5 lg:sticky lg:top-6">
            {cargos.length ? (
              <section aria-labelledby="leitura" className="grid gap-3">
                <h2 id="leitura" className="font-display text-xl">
                  Leitura rápida
                </h2>
                <div className="grid grid-cols-2 gap-2.5" data-testid="organograma-resumo">
                  <Fato rotulo="Cargos" valor={resumo.cargos} />
                  <Fato rotulo="Pessoas" valor={resumo.pessoas} />
                  <Fato rotulo="Níveis" valor={resumo.niveis} />
                  <Fato rotulo="Vagos" valor={resumo.vagos} />
                </div>
              </section>
            ) : null}
            <section aria-labelledby="pontos" className="grid gap-3">
              <h2 id="pontos" className="font-display text-xl">
                Pontos de atenção
              </h2>
              {!cargos.length ? (
                <p className="text-mudo m-0 text-sm">Aparecem aqui quando houver cargos.</p>
              ) : achados.length ? (
                <PontosComMatriz
                  empresaId={id}
                  achados={achados}
                  podeLevar={podeEditar && cenario === "current"}
                />
              ) : (
                <p className="text-ok m-0 text-sm" data-testid="organograma-pontos-vazio">
                  Nenhum ponto de atenção pelas regras gerais de estrutura.
                </p>
              )}
              <details className="text-mudo text-[13px]">
                <summary className="cursor-pointer">Como os pontos são identificados</summary>
                <ul className="mt-2 grid gap-1 pl-4">
                  <li>Mais de um cargo sem superior; dupla subordinação.</li>
                  <li>
                    Mais de {LIMITES.amplitudeAtencao} subordinados diretos (crítico acima de{" "}
                    {LIMITES.amplitudeCritica}).
                  </li>
                  <li>
                    Sócio(a) com mais de um cargo ou {LIMITES.subordinadosDoSocio}+ subordinados;
                    pessoa com vários cargos.
                  </li>
                  <li>Liderança sem substituto; liderança vaga; cargos vagos.</li>
                  <li>Familiares sem papel, critério de entrada e remuneração definidos.</li>
                  <li>Área sem responsável ou com mais de um; {LIMITES.niveisAtencao}+ níveis.</li>
                </ul>
                <p className="mt-2">São sinais gerais de estrutura. A leitura final é sua.</p>
              </details>
            </section>

            {cenario === "proposed" ? (
              <section aria-labelledby="racional" className="grid gap-3">
                <h2 id="racional" className="font-display text-xl">
                  Racional e portal
                </h2>
                {podeEditar ? (
                  <ResumoProposta empresaId={id} valor={carta?.proposal_summary ?? null} />
                ) : carta?.proposal_summary ? (
                  <p className="m-0 whitespace-pre-line">{carta.proposal_summary}</p>
                ) : null}
                {podePortal && proposta.length ? (
                  <div className="grid gap-2">
                    <p className="m-0 text-sm">
                      {carta?.shared_with_client ? (
                        <Selo tom="ok">Publicada no portal</Selo>
                      ) : (
                        "O cliente vê cargos, ocupantes e justificativas; não vê os pontos de atenção nem as marcações internas."
                      )}
                    </p>
                    <CompartilharProposta
                      empresaId={id}
                      compartilhada={!!carta?.shared_with_client}
                    />
                  </div>
                ) : null}
              </section>
            ) : null}
          </aside>
        </div>
      )}
    </main>
  );
}

function Placar({ rot, p }: { rot: string; p: { critico: number; atencao: number } }) {
  return (
    <div className="border-linho bg-porcelana grid gap-1 rounded-xl border px-4 py-3">
      <span className="text-mudo text-xs">{rot}</span>
      <span className="flex flex-wrap gap-1.5">
        <Selo tom={p.critico ? "critico" : "ok"}>{p.critico} crítico(s)</Selo>
        <Selo tom={p.atencao ? "atencao" : "ok"}>{p.atencao} de atenção</Selo>
      </span>
    </div>
  );
}

function Comparacao({
  atual,
  proposta,
  resumo,
  base,
}: {
  atual: Cargo[];
  proposta: Cargo[];
  resumo: string | null;
  base: string;
}) {
  if (!atual.length || !proposta.length)
    return (
      <p className="text-mudo">
        A comparação aparece quando houver{" "}
        {!atual.length ? (
          <Link href={`${base}?ver=atual`} className="text-terra-texto underline">
            estrutura atual
          </Link>
        ) : (
          <Link href={`${base}?ver=proposta`} className="text-terra-texto underline">
            proposta
          </Link>
        )}{" "}
        registrada.
      </p>
    );
  const c = compararEstruturas(atual, proposta);
  return (
    <div className="grid gap-8" data-testid="organograma-comparacao">
      {resumo ? (
        <Cartao superficie="borda" className="grid gap-2">
          <h2 className="font-display text-xl">O racional da proposta</h2>
          <p className="m-0 max-w-[72ch] whitespace-pre-line">{resumo}</p>
        </Cartao>
      ) : null}
      <section aria-labelledby="placar" className="grid gap-3">
        <h2 id="placar" className="font-display text-xl">
          Pontos de atenção, antes e depois
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Placar rot="Estrutura atual" p={c.antes} />
          <Placar rot="Proposta JC" p={c.depois} />
        </div>
        {c.resolvidos.length ? (
          <p className="m-0 text-[15px]">
            <b className="text-ok">Resolvidos pela proposta:</b> {c.resolvidos.join("; ")}.
          </p>
        ) : null}
        {c.novosPontos.length ? (
          <p className="m-0 text-[15px]">
            <b className="text-atencao">Ainda pedem atenção na proposta:</b>{" "}
            {c.novosPontos.join("; ")}.
          </p>
        ) : null}
      </section>
      <section aria-labelledby="mudancas" className="grid gap-3">
        <h2 id="mudancas" className="font-display text-xl">
          O que muda
        </h2>
        <ul
          className="border-linho m-0 grid list-none border-t p-0"
          data-testid="organograma-mudancas"
        >
          {c.novos.map((n) => (
            <li key={`n-${n.cargo}`} className="border-linho grid gap-1 border-b py-3">
              <span>
                <Selo tom="ok">Novo</Selo> <b>{n.cargo}</b>
              </span>
              {n.justificativa ? (
                <span className="text-mudo text-sm">{n.justificativa}</span>
              ) : null}
            </li>
          ))}
          {c.alterados.map((m) => (
            <li key={`a-${m.cargo}`} className="border-linho grid gap-1 border-b py-3">
              <span>
                <Selo tom="marca">Muda</Selo> <b>{m.cargo}</b>
              </span>
              {m.itens.length ? <span className="text-[14px]">{m.itens.join(" · ")}</span> : null}
              {m.justificativa ? (
                <span className="text-mudo text-sm">{m.justificativa}</span>
              ) : null}
            </li>
          ))}
          {c.extintos.map((e) => (
            <li key={`e-${e}`} className="border-linho border-b py-3">
              <Selo tom="neutro">Deixa de existir</Selo> <b>{e}</b>
            </li>
          ))}
        </ul>
        <p className="text-mudo m-0 text-sm">
          {c.mantidos} cargo(s) sem mudança. Os cargos são comparados pelo nome.
        </p>
      </section>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section aria-labelledby="lado-atual" className="grid gap-3">
          <h2 id="lado-atual" className="font-display text-lg">
            Estrutura atual
          </h2>
          <ArvoreOrganograma cargos={atual} rotulo="Estrutura atual (comparação)" />
        </section>
        <section aria-labelledby="lado-proposta" className="grid gap-3">
          <h2 id="lado-proposta" className="font-display text-lg">
            Proposta JC
          </h2>
          <ArvoreOrganograma cargos={proposta} rotulo="Proposta JC (comparação)" />
        </section>
      </div>
    </div>
  );
}
