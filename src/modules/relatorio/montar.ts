import { brl, type Resultado } from "@/modules/raiox/calculo";
import { lerIndicadores, type LeituraIndicador } from "@/modules/raiox/leitura";
import type { resumoDaFamilia } from "@/modules/familia/schema";
import { ordenar, quadrante, ROTULO_FASE, type ItemPrioridade } from "@/modules/prioridades/schema";

/**
 * Montagem do Relatório Executivo: transforma os dados das ferramentas em
 * conclusões (com números), cenário de caixa e plano. Funções puras e testadas.
 * Tudo aqui é sugestão; a consultora revisa e edita as mensagens antes de enviar.
 */

const n1 = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const reais = (v: number) => brl(Math.round(v));

/** Plural simples: plural(2, "ação", "ações") → "2 ações". */
export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export type Achado = {
  /** Frase de conclusão, já com o número que a sustenta. */
  mensagem: string;
  gravidade: 3 | 2 | 1;
  origem: "financeiro" | "familia" | "plano";
};

// ---------------------------------------------------------------------------
// Cenário de caixa (projeção simples e explícita)
// ---------------------------------------------------------------------------
export type Cenario = {
  /** Caixa no início da projeção. */
  caixaInicial: number;
  /** Variação mensal de caixa hoje (lucro + depreciação − retiradas além do pró-labore). */
  fluxoMensalAtual: number;
  /** Quanto por mês volta ao caixa se as retiradas caírem ao teto escolhido. */
  liberacaoMensal: number;
  tetoRetiradas: number;
  /** Meses até o caixa zerar no ritmo atual (null se não zera em 36 meses). */
  mesesAteZerarAtual: number | null;
  mesesAteZerarComAjuste: number | null;
  serieAtual: number[];
  serieComAjuste: number[];
  horizonte: number;
};

function mesesAteZerar(serie: number[]): number | null {
  const i = serie.findIndex((v) => v < 0);
  return i <= 0 ? (i === 0 ? 0 : null) : i;
}

/**
 * Projeção linear do caixa por `horizonte` meses, em dois cenários: manter o ritmo
 * atual, ou trazer as retiradas da família para até `teto` da geração de caixa.
 * Premissas: receita, custos e dívida constantes; sem novos empréstimos.
 */
export function projetarCaixa(r: Resultado, teto = 0.7, horizonte = 24): Cenario {
  const meses = Math.max(1, r.meses);
  const fluxoMensalAtual = r.caixaAposFamilia / meses;
  const excesso = Math.max(0, r.retiradasFamilia - teto * Math.max(0, r.ebitdaAntesFamilia));
  const liberacaoMensal = excesso / meses;
  const caixaInicial = r.v.caixa;
  const serie = (fluxo: number) =>
    Array.from({ length: horizonte + 1 }, (_, m) => caixaInicial + fluxo * m);
  const serieAtual = serie(fluxoMensalAtual);
  const serieComAjuste = serie(fluxoMensalAtual + liberacaoMensal);
  return {
    caixaInicial,
    fluxoMensalAtual,
    liberacaoMensal,
    tetoRetiradas: teto,
    mesesAteZerarAtual: mesesAteZerar(serieAtual),
    mesesAteZerarComAjuste: mesesAteZerar(serieComAjuste),
    serieAtual,
    serieComAjuste,
    horizonte,
  };
}

// ---------------------------------------------------------------------------
// Achados (mensagens-chave sugeridas)
// ---------------------------------------------------------------------------
export function achadosFinanceiros(r: Resultado, c: Cenario): Achado[] {
  const a: Achado[] = [];
  if (r.v.receitaBruta <= 0) return a;
  const anual = 12 / Math.max(1, r.meses);

  if (r.pesoFamilia !== null && r.pesoFamilia > 1)
    a.push({
      gravidade: 3,
      origem: "financeiro",
      mensagem: `A família retira mais do que a empresa gera: ${reais(r.retiradasFamilia)} saíram para a família, contra ${reais(r.ebitdaAntesFamilia)} gerados pela operação no período.`,
    });
  else if (r.pesoFamilia !== null && r.pesoFamilia > 0.7)
    a.push({
      gravidade: 2,
      origem: "financeiro",
      mensagem: `De cada R$ 100 que a operação gera, R$ ${n1(r.pesoFamilia * 100)} vão para a família, o que deixa pouca folga para investir e atravessar a sucessão.`,
    });
  else if (r.retiradasFamilia > 0 && r.ebitdaAntesFamilia <= 0)
    a.push({
      gravidade: 3,
      origem: "financeiro",
      mensagem: `A operação não gera caixa, mas a família retirou ${reais(r.retiradasFamilia)} no período.`,
    });

  if (c.mesesAteZerarAtual !== null && c.caixaInicial > 0)
    a.push({
      gravidade: c.mesesAteZerarAtual <= 12 ? 3 : 2,
      origem: "financeiro",
      mensagem: `No ritmo atual, o caixa de ${reais(c.caixaInicial)} se esgota em cerca de ${c.mesesAteZerarAtual} meses.`,
    });
  else if (r.caixaAposFamilia < 0)
    a.push({
      gravidade: 2,
      origem: "financeiro",
      mensagem: `Depois das retiradas, o caixa encolhe ${reais(-r.caixaAposFamilia * anual)} por ano.`,
    });

  if (c.liberacaoMensal > 0)
    a.push({
      gravidade: 2,
      origem: "financeiro",
      mensagem: `Trazer as retiradas para até ${Math.round(c.tetoRetiradas * 100)}% da geração de caixa devolveria cerca de ${reais(c.liberacaoMensal * 12)} por ano à empresa.`,
    });

  if (r.v.despesasPessoais > 0)
    a.push({
      gravidade: 2,
      origem: "financeiro",
      mensagem: `A empresa paga ${reais(r.v.despesasPessoais * anual)} por ano em despesas pessoais da família, o que mistura patrimônio e esconde o resultado real.`,
    });
  if (r.dividaLiquida > 0 && r.ebitda <= 0)
    a.push({
      gravidade: 3,
      origem: "financeiro",
      mensagem: `Há ${reais(r.dividaLiquida)} de dívida líquida e a operação não gera caixa para pagá-la.`,
    });
  else if (r.dlEbitda !== null && r.dlEbitda > 3)
    a.push({
      gravidade: 3,
      origem: "financeiro",
      mensagem: `A dívida equivale a ${n1(r.dlEbitda)} anos de geração de caixa, acima do patamar considerado seguro.`,
    });
  if (r.liquidezCorrente !== null && r.liquidezCorrente < 1)
    a.push({
      gravidade: 3,
      origem: "financeiro",
      mensagem: `Para cada R$ 1,00 a pagar no curto prazo, a empresa tem só R$ ${r.liquidezCorrente.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} para cobrir.`,
    });
  if (r.lucroLiquido < 0)
    a.push({
      gravidade: 3,
      origem: "financeiro",
      mensagem: `O período fechou com prejuízo de ${reais(-r.lucroLiquido)}.`,
    });
  return a;
}

type ResumoFamilia = ReturnType<typeof resumoDaFamilia>;

export function achadosDaFamilia(f: ResumoFamilia): Achado[] {
  if (f.vazio) return [];
  const a: Achado[] = [];
  if (f.sucessoresDefinidos === 0)
    a.push({
      gravidade: f.sucessoresEmPreparacao + f.sucessoresPotenciais > 0 ? 2 : 3,
      origem: "familia",
      mensagem:
        f.sucessoresEmPreparacao + f.sucessoresPotenciais > 0
          ? `Há ${plural(f.sucessoresEmPreparacao + f.sucessoresPotenciais, "pessoa", "pessoas")} em vista para a sucessão, mas ninguém definido.`
          : "A sucessão ainda não tem nenhum nome mapeado.",
    });
  if (f.sucessoresDefinidos > 1)
    a.push({
      gravidade: 2,
      origem: "familia",
      mensagem: `${f.sucessoresDefinidos} pessoas constam como sucessoras definidas: o papel de cada uma precisa ficar claro.`,
    });
  if (f.geracoes.length >= 2 && f.familiaresNaEmpresa > 0)
    a.push({
      gravidade: 1,
      origem: "familia",
      mensagem: `${f.geracoes.length} gerações convivem na família empresária, com ${plural(f.familiaresNaEmpresa, "familiar trabalhando", "familiares trabalhando")} na empresa.`,
    });
  return a;
}

export function achadosDoPlano(itens: ItemPrioridade[], hoje: string): Achado[] {
  const ativos = itens.filter((i) => i.phase !== "done" && i.phase !== "discarded");
  const agora = ativos.filter((i) => quadrante(i.impact, i.urgency) === "agora");
  const vencidos = ativos.filter((i) => i.due_on && i.due_on < hoje);
  const a: Achado[] = [];
  if (agora.length)
    a.push({
      gravidade: 2,
      origem: "plano",
      mensagem: `${plural(agora.length, "prioridade de alto impacto e alta urgência pede", "prioridades de alto impacto e alta urgência pedem")} decisão imediata.`,
    });
  if (vencidos.length)
    a.push({
      gravidade: 2,
      origem: "plano",
      mensagem: `${plural(vencidos.length, "ação do plano está", "ações do plano estão")} com o prazo vencido.`,
    });
  return a;
}

/** As até 5 conclusões mais graves, para o sumário executivo. */
export function mensagensSugeridas(achados: Achado[]): string[] {
  return [...achados]
    .map((a, i) => ({ a, i }))
    .sort((x, y) => y.a.gravidade - x.a.gravidade || x.i - y.i)
    .slice(0, 5)
    .map((x) => x.a.mensagem);
}

/** Título de seção que diz a conclusão (teste dos títulos). */
export function tituloFinanceiro(r: Resultado | null, achados: Achado[]): string {
  if (!r || r.v.receitaBruta <= 0) return "O diagnóstico financeiro depende dos dados do período";
  const fin = achados.filter((a) => a.origem === "financeiro");
  if (r.pesoFamilia !== null && r.pesoFamilia > 1)
    return "A família retira mais do que a empresa gera, e o caixa paga a diferença";
  if (fin.some((a) => a.gravidade === 3))
    return "As finanças têm pontos críticos que afetam a sucessão";
  if (fin.length) return "As finanças sustentam a operação, com pontos que pedem atenção";
  return "As finanças estão dentro das referências gerais";
}

export function tituloCenario(c: Cenario | null): string {
  if (!c) return "O cenário de caixa depende dos dados do período";
  if (c.mesesAteZerarAtual !== null && c.mesesAteZerarComAjuste === null)
    return `Ajustar as retiradas evita que o caixa se esgote em ${c.mesesAteZerarAtual} meses`;
  if (c.mesesAteZerarAtual !== null)
    return `Mesmo com ajuste, o caixa pede ação: hoje ele dura cerca de ${c.mesesAteZerarAtual} meses`;
  if (c.liberacaoMensal > 0)
    return `Ajustar as retiradas libera ${reais(c.liberacaoMensal * 12)} por ano para a empresa`;
  return "No ritmo atual, o caixa se mantém nos próximos 24 meses";
}

export function tituloFamilia(f: ResumoFamilia): string {
  if (f.vazio) return "A família empresária ainda não foi mapeada";
  if (f.sucessoresDefinidos === 1)
    return "A sucessão tem um nome definido; o desafio agora é a transição";
  if (f.sucessoresDefinidos > 1)
    return "Há mais de um sucessor definido e os papéis precisam ser acordados";
  if (f.sucessoresEmPreparacao + f.sucessoresPotenciais > 0)
    return "A família tem candidatos à sucessão, mas a escolha ainda não foi feita";
  return "A sucessão ainda não tem nomes em vista";
}

// ---------------------------------------------------------------------------
// Plano de ação a partir da Matriz de Prioridades
// ---------------------------------------------------------------------------
export type AcaoPlano = {
  titulo: string;
  responsavel: string | null;
  prazo: string | null;
  fase: string;
  urgente: boolean;
};

function somarDias(dia: string, n: number) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Próximos 90 dias: alto impacto e urgência, ou prazo até 90 dias. O resto ativo: até 12 meses. */
export function montarPlano(itens: ItemPrioridade[], hoje: string) {
  const limite = somarDias(hoje, 90);
  const ativos = ordenar(itens.filter((i) => i.phase !== "done" && i.phase !== "discarded"));
  const paraAcao = (i: ItemPrioridade): AcaoPlano => ({
    titulo: i.title,
    responsavel: i.responsible,
    prazo: i.due_on,
    fase: ROTULO_FASE[i.phase],
    urgente: quadrante(i.impact, i.urgency) === "agora",
  });
  const em90 = (i: ItemPrioridade) =>
    quadrante(i.impact, i.urgency) === "agora" || (i.due_on !== null && i.due_on <= limite);
  return {
    noventaDias: ativos.filter(em90).map(paraAcao),
    dozeMeses: ativos.filter((i) => !em90(i)).map(paraAcao),
    concluidas: itens.filter((i) => i.phase === "done").map(paraAcao),
  };
}

/** Placar dos indicadores com régua, para a capa do diagnóstico. */
export function placarFinanceiro(r: Resultado) {
  const l: LeituraIndicador[] = lerIndicadores(r).filter((x) => x.ind.regua);
  return {
    ok: l.filter((x) => x.situacao === "ok").length,
    atencao: l.filter((x) => x.situacao === "atencao").length,
    critico: l.filter((x) => x.situacao === "critico").length,
    total: l.length,
  };
}

/** Título da página de diagnóstico: quantos indicadores estão fora da faixa saudável. */
export function tituloPlacar(p: { ok: number; atencao: number; critico: number; total: number }) {
  const fora = p.atencao + p.critico;
  if (!fora) return `Os ${p.total} indicadores com referência estão na faixa saudável`;
  return `${fora} de ${p.total} indicadores estão fora da faixa saudável${p.critico ? `, ${plural(p.critico, "deles crítico", "deles críticos")}` : ""}`;
}
