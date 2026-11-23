import type { ReactNode } from "react";
import { FioContinuidade, Monograma } from "@/components/ui";
import {
  resumoDaFamilia,
  ROTULO_PAPEL,
  ROTULO_SUCESSAO,
  type Papel,
  type SituacaoSucessao,
} from "@/modules/familia/schema";
import type { ItemPrioridade } from "@/modules/prioridades/schema";
import { brl, calcular, type Valores } from "@/modules/raiox/calculo";
import { INDICADORES } from "@/modules/raiox/leitura";
import {
  FamiliaECaixa,
  GraficoHistorico,
  IndicadoresExplicados,
  Kpis,
  TabelaIndicadores,
} from "@/modules/raiox/visao";
import { GraficoCenario } from "./grafico-cenario";
import {
  achadosDaFamilia,
  achadosDoPlano,
  achadosFinanceiros,
  mensagensSugeridas,
  montarPlano,
  placarFinanceiro,
  projetarCaixa,
  tituloCenario,
  tituloFamilia,
  tituloFinanceiro,
  tituloPlacar,
  plural,
  type AcaoPlano,
} from "./montar";

/**
 * Relatório Executivo JC: corpo do documento/apresentação, montado a partir dos
 * dados das ferramentas. Usado pela tela da empresa e pelo exemplo fictício.
 */

export type MembroRelatorio = {
  nome: string;
  papel: Papel;
  cargo: string | null;
  is_family: boolean;
  generation: number | null;
  ownership_pct: number | null;
  works_in_company: boolean;
  successor_status: SituacaoSucessao;
};

export type ConfiguracaoRelatorio = {
  consultant_name: string;
  consultant_title: string;
  credentials: string;
  methodology: string;
  limitations: string;
} | null;

export type EntradaRelatorio = {
  empresaNome: string;
  periodos: { rotulo: string; meses: number; valores: Valores }[];
  membros: MembroRelatorio[];
  itens: ItemPrioridade[];
  mensagensSalvas: string[];
  decisoes: string[];
  config: ConfiguracaoRelatorio;
  /** Dia de hoje (AAAA-MM-DD) e data de emissão. */
  hoje: string;
  emissao: Date;
};

export function prepararRelatorio(e: EntradaRelatorio) {
  const periodos = e.periodos.map((p) => ({ rotulo: p.rotulo, r: calcular(p.valores, p.meses) }));
  const ultimo = periodos.at(-1) ?? null;
  const r = ultimo?.r ?? null;
  const cenario = r && r.v.receitaBruta > 0 ? projetarCaixa(r) : null;
  const familia = resumoDaFamilia(e.membros);
  const plano = montarPlano(e.itens, e.hoje);
  const achados = [
    ...(r && cenario ? achadosFinanceiros(r, cenario) : []),
    ...achadosDaFamilia(familia),
    ...achadosDoPlano(e.itens, e.hoje),
  ];
  const sugestoes = mensagensSugeridas(achados);
  const mensagens = e.mensagensSalvas.length ? e.mensagensSalvas : sugestoes;
  const pendencias = [
    !r && "Raio-X Financeiro sem períodos",
    familia.vazio && "família não mapeada",
    !e.itens.length && "Matriz de Prioridades vazia",
    !e.config?.consultant_name && "assinatura da consultora (configuração dos relatórios)",
    !e.config?.methodology && "texto de metodologia (configuração dos relatórios)",
  ].filter(Boolean) as string[];
  return {
    ...e,
    periodos,
    ultimo,
    r,
    cenario,
    familia,
    plano,
    achados,
    sugestoes,
    mensagens,
    placar: r ? placarFinanceiro(r) : null,
    tituloFin: tituloFinanceiro(r, achados),
    pendencias,
  };
}
export type DadosRelatorio = ReturnType<typeof prepararRelatorio>;

const fuso = "America/Sao_Paulo";
const dataLonga = (v: Date) =>
  v.toLocaleDateString("pt-BR", { timeZone: fuso, day: "numeric", month: "long", year: "numeric" });
const dataCurta = (dia: string) => dia.split("-").reverse().join("/");

export function Pagina({
  apresentacao,
  rotulo,
  titulo,
  children,
}: {
  apresentacao: boolean;
  rotulo: string;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section
      className={
        apresentacao
          ? "bg-papel border-linho relative grid aspect-[16/9] content-start gap-5 overflow-hidden rounded-2xl border p-10 shadow-sm print:break-before-page print:rounded-none print:border-0 print:shadow-none"
          : "grid content-start gap-5 print:break-before-page"
      }
      aria-label={rotulo}
    >
      <header className="grid gap-1.5">
        <span className="text-terra-texto text-[12.5px] font-semibold">{rotulo}</span>
        <h2
          className={`font-display leading-tight font-semibold ${apresentacao ? "text-3xl" : "text-[1.7rem]"}`}
        >
          {titulo}
        </h2>
        <FioContinuidade className="max-w-[10rem]" />
      </header>
      {children}
    </section>
  );
}

function ListaPlano({ acoes, vazio }: { acoes: AcaoPlano[]; vazio: string }) {
  if (!acoes.length) return <p className="text-mudo m-0 text-sm">{vazio}</p>;
  return (
    <table className="w-full border-collapse text-[14px]">
      <thead className="text-mudo text-[12.5px]">
        <tr className="border-linho border-b">
          <th scope="col" className="py-1.5 pr-2 text-left font-semibold">
            Ação
          </th>
          <th scope="col" className="py-1.5 pr-2 text-left font-semibold">
            Responsável
          </th>
          <th scope="col" className="py-1.5 pr-2 text-left font-semibold">
            Prazo
          </th>
          <th scope="col" className="py-1.5 text-left font-semibold">
            Etapa
          </th>
        </tr>
      </thead>
      <tbody>
        {acoes.map((a, i) => (
          <tr key={i} className="border-linho border-b align-top">
            <td className="py-2 pr-2">
              {a.urgente ? <span className="text-critico font-semibold">Urgente · </span> : null}
              {a.titulo}
            </td>
            <td className="py-2 pr-2">
              {a.responsavel ?? <span className="text-atencao">A definir</span>}
            </td>
            <td className="py-2 pr-2">
              {a.prazo ? dataCurta(a.prazo) : <span className="text-atencao">A definir</span>}
            </td>
            <td className="py-2">{a.fase}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CorpoRelatorio({ d, apresentacao }: { d: DadosRelatorio; apresentacao: boolean }) {
  const {
    periodos,
    ultimo,
    r,
    cenario,
    familia,
    plano,
    mensagens,
    decisoes,
    config,
    placar,
    tituloFin,
    membros,
  } = d;
  const empresa = { trade_name: d.empresaNome };
  return (
    <>
      {/* Capa */}
      <section
        className={
          apresentacao
            ? "bg-papel border-linho grid aspect-[16/9] content-between rounded-2xl border p-12 shadow-sm print:rounded-none print:border-0 print:shadow-none"
            : "grid min-h-[80vh] content-between gap-10 print:min-h-[262mm]"
        }
        aria-label="Capa"
      >
        <div className="flex items-start justify-between gap-6">
          <div className="grid gap-1">
            <Monograma tamanho={56} />
            <span className="text-mudo text-sm">Jéssica Couto · Sucessão de Sucesso</span>
          </div>
          <span className="text-mudo text-sm">Confidencial</span>
        </div>
        <div className="grid gap-4">
          <p className="text-terra-texto m-0 text-sm font-semibold">
            Relatório Executivo de Sucessão
          </p>
          <h1
            className={`font-display leading-tight font-semibold ${apresentacao ? "text-5xl" : "text-[2.6rem]"}`}
          >
            {empresa.trade_name}
          </h1>
          <FioContinuidade className="max-w-xs" />
          {mensagens[0] ? <p className="m-0 max-w-[52ch] text-lg">{mensagens[0]}</p> : null}
        </div>
        <p className="text-mudo m-0 text-sm">
          {dataLonga(d.emissao)}
          {ultimo ? ` · Dados financeiros de ${ultimo.rotulo}` : ""}
          {config?.consultant_name ? ` · ${config.consultant_name}` : ""}
        </p>
      </section>

      {/* 1. Sumário executivo */}
      <Pagina apresentacao={apresentacao} rotulo="Sumário executivo" titulo={tituloFin}>
        {mensagens.length ? (
          <ol
            className={`border-terra m-0 grid border-l-2 pl-5 ${apresentacao ? "gap-1.5 text-[15px]" : "gap-3 text-[16px] leading-relaxed"}`}
            data-testid="mensagens-chave"
          >
            {mensagens.map((t, i) => (
              <li key={i} className={i === 0 ? "font-semibold" : undefined}>
                {t}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-mudo m-0">
            Ainda não há dados suficientes para conclusões. Preencha o Raio-X e a família.
          </p>
        )}
        {cenario && (cenario.liberacaoMensal > 0 || cenario.mesesAteZerarAtual !== null) ? (
          <div
            className="border-terra bg-blush/40 grid gap-1 rounded-2xl border p-4"
            data-testid="em-jogo"
          >
            <b className="font-display text-lg">O que está em jogo</b>
            {cenario.mesesAteZerarAtual !== null ? (
              <span>
                Sem mudanças, o caixa de {brl(Math.round(cenario.caixaInicial))} acaba em cerca de{" "}
                <b>{cenario.mesesAteZerarAtual} meses</b>.
              </span>
            ) : null}
            {cenario.liberacaoMensal > 0 ? (
              <span>
                Ajustar as retiradas da família devolve cerca de{" "}
                <b>{brl(Math.round(cenario.liberacaoMensal * 12))} por ano</b> à empresa.
              </span>
            ) : null}
          </div>
        ) : null}
        {decisoes.length ? (
          <div className="grid gap-2">
            <b className="font-display text-lg">Decisões para a família</b>
            <ul className="m-0 grid gap-1.5 pl-5">
              {decisoes.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Pagina>

      {/* 2. Diagnóstico financeiro */}
      {r && ultimo ? (
        <Pagina
          apresentacao={apresentacao}
          rotulo={`Diagnóstico financeiro · ${ultimo.rotulo}`}
          titulo={placar ? tituloPlacar(placar) : tituloFin}
        >
          {placar ? (
            <p className="m-0 text-[15px]">
              Dos {placar.total} indicadores com referência,{" "}
              <b className="text-ok">{placar.ok} estão saudáveis</b>,{" "}
              <b className="text-atencao">{placar.atencao} pedem atenção</b> e{" "}
              <b className="text-critico">{placar.critico} são críticos</b>.
            </p>
          ) : null}
          <Kpis r={r} />
          <FamiliaECaixa r={r} />
        </Pagina>
      ) : null}

      {r && ultimo && !apresentacao ? (
        <Pagina
          apresentacao={false}
          rotulo="Diagnóstico financeiro"
          titulo="Os indicadores, um a um, e o que cada um significa"
        >
          <IndicadoresExplicados r={r} />
        </Pagina>
      ) : null}

      {periodos.length > 1 ? (
        <Pagina
          apresentacao={apresentacao}
          rotulo="Evolução"
          titulo="Como a empresa chegou até aqui"
        >
          <GraficoHistorico periodos={periodos} />
        </Pagina>
      ) : null}

      {/* 3. Cenário */}
      {cenario ? (
        <Pagina
          apresentacao={apresentacao}
          rotulo="Cenário de caixa · próximos 24 meses"
          titulo={tituloCenario(cenario)}
        >
          <div className={apresentacao ? "max-w-[620px]" : undefined}>
            <GraficoCenario c={cenario} />
          </div>
          <div className={`text-mudo grid gap-1 ${apresentacao ? "text-[11.5px]" : "text-[13px]"}`}>
            <b className="text-cacau">Premissas desta projeção</b>
            <span>
              Parte do caixa de hoje ({brl(Math.round(cenario.caixaInicial))}) e repete, mês a mês,
              o resultado do último período após as retiradas (
              {brl(Math.round(cenario.fluxoMensalAtual))} por mês). Receita, custos e dívida
              constantes, sem novos empréstimos. É uma conta simples para mostrar a direção, não uma
              previsão.
            </span>
          </div>
        </Pagina>
      ) : null}

      {/* 4. Família e sucessão */}
      {!familia.vazio ? (
        <Pagina
          apresentacao={apresentacao}
          rotulo="Família e sucessão"
          titulo={tituloFamilia(familia)}
        >
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              [
                "Familiares",
                `${familia.familiares}`,
                `${familia.familiaresNaEmpresa} trabalham na empresa`,
              ],
              [
                "Gerações",
                familia.geracoes.map((g) => `${g}ª`).join(", ") || "—",
                "presentes na família",
              ],
              [
                "Participação da família",
                `${familia.participacaoFamilia.toLocaleString("pt-BR")}%`,
                "do capital informado",
              ],
              [
                "Sucessão",
                familia.sucessoresDefinidos
                  ? plural(familia.sucessoresDefinidos, "definido", "definidos")
                  : "Nenhum definido",
                `${familia.sucessoresEmPreparacao + familia.sucessoresPotenciais} em vista`,
              ],
            ].map(([rot, val, extra]) => (
              <div key={rot} className="border-linho bg-porcelana rounded-xl border px-3 py-2.5">
                <span className="text-mudo block text-xs">{rot}</span>
                <b className="font-display text-xl">{val}</b>
                <span className="text-mudo block text-xs">{extra}</span>
              </div>
            ))}
          </div>
          <table className="w-full border-collapse text-[14px]">
            <thead className="text-mudo text-[12.5px]">
              <tr className="border-linho border-b">
                <th scope="col" className="py-1.5 pr-2 text-left font-semibold">
                  Pessoa
                </th>
                <th scope="col" className="py-1.5 pr-2 text-left font-semibold">
                  Papel
                </th>
                <th scope="col" className="py-1.5 pr-2 text-left font-semibold">
                  Geração
                </th>
                <th scope="col" className="py-1.5 pr-2 text-right font-semibold">
                  Participação
                </th>
                <th scope="col" className="py-1.5 text-left font-semibold">
                  Sucessão
                </th>
              </tr>
            </thead>
            <tbody>
              {[...membros]
                .sort((a, b) => (a.generation ?? 9) - (b.generation ?? 9))
                .map((p, i) => (
                  <tr key={i} className="border-linho border-b">
                    <td className="py-1.5 pr-2">{p.nome}</td>
                    <td className="py-1.5 pr-2">{p.cargo ?? ROTULO_PAPEL[p.papel]}</td>
                    <td className="py-1.5 pr-2">{p.generation ? `${p.generation}ª` : "—"}</td>
                    <td className="py-1.5 pr-2 text-right">
                      {p.ownership_pct !== null
                        ? `${p.ownership_pct.toLocaleString("pt-BR")}%`
                        : "—"}
                    </td>
                    <td className="py-1.5">
                      {p.successor_status === "none" ? "—" : ROTULO_SUCESSAO[p.successor_status]}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {familia.pontos.length ? (
            <ul className="text-atencao bg-atencao-fundo m-0 grid gap-1 rounded-[10px] py-2 pr-3 pl-7 text-sm">
              {familia.pontos.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
        </Pagina>
      ) : null}

      {/* 5. Plano */}
      <Pagina
        apresentacao={apresentacao}

        rotulo="Plano de ação"
        titulo={
          plano.noventaDias.length
            ? `${plural(plano.noventaDias.length, "ação", "ações")} para os próximos 90 dias`
            : "O plano de ação ainda será definido com a família"
        }
      >
        <div className="grid gap-2">
          <b className="font-display text-lg">Próximos 90 dias</b>
          <ListaPlano
            acoes={plano.noventaDias}
            vazio="Nenhuma ação urgente registrada na Matriz de Prioridades."
          />
        </div>
        <div className="grid gap-2">
          <b className="font-display text-lg">Até 12 meses</b>
          <ListaPlano acoes={plano.dozeMeses} vazio="Nenhuma ação de médio prazo registrada." />
        </div>
        {plano.concluidas.length ? (
          <p className="text-ok m-0 text-sm">
            Já concluído: {plano.concluidas.map((a) => a.titulo).join("; ")}.
          </p>
        ) : null}
      </Pagina>

      {/* 6. Metodologia e assinatura */}
      {config?.methodology || config?.consultant_name ? (
        <Pagina
          apresentacao={apresentacao}
          rotulo="Metodologia"
          titulo="Como este diagnóstico foi feito"
        >
          {config.methodology ? (
            <p className="m-0 leading-relaxed whitespace-pre-wrap">{config.methodology}</p>
          ) : null}
          <div className="text-[14px]">
            <b>Fontes:</b> informações financeiras e familiares fornecidas pela empresa
            {ultimo ? ` (período ${ultimo.rotulo})` : ""}, entrevistas e registros do
            acompanhamento. Os números não foram auditados.
          </div>
          {config.limitations ? (
            <p className="text-mudo m-0 text-[13px] whitespace-pre-wrap">
              <b className="text-cacau">Limitações: </b>
              {config.limitations}
            </p>
          ) : null}
          {config.consultant_name ? (
            <div className="grid gap-0.5 pt-6">
              <span className="border-cacau w-64 border-t" aria-hidden="true" />
              <b>{config.consultant_name}</b>
              {config.consultant_title ? (
                <span className="text-mudo text-sm">{config.consultant_title}</span>
              ) : null}
              {config.credentials ? (
                <span className="text-mudo text-[13px] whitespace-pre-wrap">
                  {config.credentials}
                </span>
              ) : null}
            </div>
          ) : null}
        </Pagina>
      ) : null}

      {/* Anexo (só no documento) */}
      {!apresentacao && periodos.length ? (
        <Pagina apresentacao={false} rotulo="Anexo" titulo="Todos os números e o glossário">
          <TabelaIndicadores periodos={periodos} />
          <dl className="m-0 grid gap-2 text-[13px]">
            {INDICADORES.map((i) => (
              <div key={i.chave}>
                <dt className="font-semibold">{i.nome}</dt>
                <dd className="text-mudo m-0">{i.oQueMede}</dd>
              </div>
            ))}
          </dl>
        </Pagina>
      ) : null}
    </>
  );
}
