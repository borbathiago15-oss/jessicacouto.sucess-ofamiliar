import type { Resultado } from "./calculo";

/**
 * Leitura dos indicadores para quem não é da área financeira: o que cada um mede,
 * uma frase em reais e a faixa (saudável / atenção / crítico).
 * As faixas são referências gerais de mercado, iguais às dos pontos de atenção;
 * a leitura final é sempre da consultora, conforme o setor e a história da família.
 */

export type Situacao = "ok" | "atencao" | "critico" | "sem_dado";
export const ROTULO_SITUACAO: Record<Situacao, string> = {
  ok: "Saudável",
  atencao: "Pede atenção",
  critico: "Crítico",
  sem_dado: "Sem dado",
};

/** Régua: limites entre as faixas, na ordem em que aparecem da esquerda para a direita. */
export type Regua = {
  min: number;
  max: number;
  /** Faixas em sequência; cada uma vai até `ate` (a última até `max`). */
  faixas: { ate: number; situacao: Exclude<Situacao, "sem_dado">; rotulo: string }[];
  formato: (v: number) => string;
};

export type Indicador = {
  chave: string;
  nome: string;
  /** O que o indicador mede, em uma frase sem jargão. */
  oQueMede: string;
  valor: (r: Resultado) => number | null;
  formato: (v: number) => string;
  /** A mesma informação em reais ou em dias, para qualquer pessoa entender. */
  frase: (v: number, r: Resultado) => string;
  regua?: Regua;
};

const n1 = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const n2 = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (v: number) => `${n1(v * 100)}%`;
const vezes = (v: number) => `${n1(v)}×`;
const dias = (v: number) => `${Math.round(v)} dias`;
const reais100 = (v: number) => `R$ ${n2(v * 100)}`;

export const INDICADORES: Indicador[] = [
  {
    chave: "margemEbitda",
    nome: "Margem de geração de caixa (EBITDA)",
    oQueMede:
      "Quanto da venda vira dinheiro gerado pela operação, antes de juros, impostos sobre o lucro e depreciação. Já desconta o que é pago à família no resultado.",
    valor: (r) => r.margemEbitda,
    formato: pct,
    frase: (v) => `De cada R$ 100 vendidos, a operação gera ${reais100(v)} de caixa.`,
    regua: {
      min: -0.1,
      max: 0.3,
      formato: pct,
      faixas: [
        { ate: 0.05, situacao: "critico", rotulo: "abaixo de 5%" },
        { ate: 0.1, situacao: "atencao", rotulo: "5% a 10%" },
        { ate: 0.3, situacao: "ok", rotulo: "acima de 10%" },
      ],
    },
  },
  {
    chave: "margemLiquida",
    nome: "Margem líquida (lucro)",
    oQueMede:
      "Quanto sobra de lucro de cada venda, depois de todos os custos, despesas, juros e impostos.",
    valor: (r) => r.margemLiquida,
    formato: pct,
    frase: (v) =>
      v < 0
        ? `De cada R$ 100 vendidos, a empresa perde ${reais100(-v)}.`
        : `De cada R$ 100 vendidos, sobram ${reais100(v)} de lucro.`,
    regua: {
      min: -0.1,
      max: 0.2,
      formato: pct,
      faixas: [
        { ate: 0, situacao: "critico", rotulo: "prejuízo" },
        { ate: 0.05, situacao: "atencao", rotulo: "0% a 5%" },
        { ate: 0.2, situacao: "ok", rotulo: "acima de 5%" },
      ],
    },
  },
  {
    chave: "pesoFamilia",
    nome: "Peso da família na geração de caixa",
    oQueMede:
      "Quanto do dinheiro gerado pela operação vai para a família: pró-labore, salários de familiares, despesas pessoais pagas pela empresa e retiradas.",
    valor: (r) => r.pesoFamilia,
    formato: pct,
    frase: (v) =>
      v > 1
        ? `Para cada R$ 100 que a operação gera, a família retira ${reais100(v)}: mais do que entra.`
        : `De cada R$ 100 que a operação gera, ${reais100(v)} vão para a família.`,
    regua: {
      min: 0,
      max: 1.5,
      formato: pct,
      faixas: [
        { ate: 0.7, situacao: "ok", rotulo: "até 70%" },
        { ate: 1, situacao: "atencao", rotulo: "70% a 100%" },
        { ate: 1.5, situacao: "critico", rotulo: "acima de 100%" },
      ],
    },
  },
  {
    chave: "liquidezCorrente",
    nome: "Liquidez corrente",
    oQueMede:
      "Se o que a empresa tem para receber e em caixa no curto prazo cobre o que ela tem para pagar no mesmo período (até 12 meses).",
    valor: (r) => r.liquidezCorrente,
    formato: vezes,
    frase: (v) =>
      `Para cada R$ 1,00 a pagar no curto prazo, a empresa tem R$ ${n2(v)} para cobrir.`,
    regua: {
      min: 0,
      max: 2.5,
      formato: vezes,
      faixas: [
        { ate: 1, situacao: "critico", rotulo: "abaixo de 1,0" },
        { ate: 1.2, situacao: "atencao", rotulo: "1,0 a 1,2" },
        { ate: 2.5, situacao: "ok", rotulo: "acima de 1,2" },
      ],
    },
  },
  {
    chave: "dlEbitda",
    nome: "Dívida líquida ÷ geração de caixa anual",
    oQueMede:
      "Quantos anos de geração de caixa seriam necessários para pagar a dívida (empréstimos menos o dinheiro em caixa).",
    valor: (r) => r.dlEbitda,
    formato: vezes,
    frase: (v) =>
      v <= 0
        ? "O caixa é maior que a dívida: a empresa não tem dívida líquida."
        : `Com a geração de caixa atual, a dívida levaria cerca de ${n1(v)} ano(s) para ser paga.`,
    regua: {
      min: 0,
      max: 5,
      formato: vezes,
      faixas: [
        { ate: 2, situacao: "ok", rotulo: "até 2 anos" },
        { ate: 3, situacao: "atencao", rotulo: "2 a 3 anos" },
        { ate: 5, situacao: "critico", rotulo: "acima de 3 anos" },
      ],
    },
  },
  {
    chave: "coberturaJuros",
    nome: "Cobertura de juros",
    oQueMede: "Quantas vezes a geração de caixa da operação paga os juros do período.",
    valor: (r) => r.coberturaJuros,
    formato: vezes,
    frase: (v) => `A geração de caixa paga os juros ${n1(v)} vez(es).`,
    regua: {
      min: 0,
      max: 6,
      formato: vezes,
      faixas: [
        { ate: 1.5, situacao: "critico", rotulo: "abaixo de 1,5" },
        { ate: 3, situacao: "atencao", rotulo: "1,5 a 3" },
        { ate: 6, situacao: "ok", rotulo: "acima de 3" },
      ],
    },
  },
  {
    chave: "cicloCaixa",
    nome: "Ciclo de caixa",
    oQueMede:
      "Quantos dias o dinheiro fica parado entre pagar fornecedores e receber dos clientes (estoque + prazo de recebimento − prazo de pagamento).",
    valor: (r) => r.cicloCaixa,
    formato: dias,
    frase: (v) =>
      v <= 0
        ? "A empresa recebe dos clientes antes de pagar os fornecedores."
        : `Entre pagar fornecedores e receber dos clientes, passam cerca de ${dias(v)}.`,
    regua: {
      min: 0,
      max: 180,
      formato: dias,
      faixas: [
        { ate: 90, situacao: "ok", rotulo: "até 90 dias" },
        { ate: 180, situacao: "atencao", rotulo: "acima de 90 dias" },
      ],
    },
  },
  {
    chave: "margemBruta",
    nome: "Margem bruta",
    oQueMede:
      "Quanto sobra da venda depois do custo direto do que foi vendido. Varia muito por setor, por isso não tem faixa geral.",
    valor: (r) => r.margemBruta,
    formato: pct,
    frase: (v) => `De cada R$ 100 vendidos, ${reais100(v)} sobram depois do custo direto.`,
  },
];

/** Em que faixa da régua o valor cai. */
export function situacao(ind: Indicador, v: number | null): Situacao {
  if (v === null || !Number.isFinite(v) || !ind.regua) return "sem_dado";
  const faixas = ind.regua.faixas;
  // Mesmos limites dos pontos de atenção: quando o bom está à esquerda (menor é
  // melhor), o limite pertence à faixa da esquerda; quando está à direita, à da direita.
  const menorEhMelhor = faixas[0]!.situacao === "ok";
  for (const f of faixas) if (menorEhMelhor ? v <= f.ate : v < f.ate) return f.situacao;
  return faixas.at(-1)!.situacao;
}

/** Posição do valor na régua, de 0 a 1 (valores fora ficam presos nas pontas). */
export function posicaoNaRegua(r: Regua, v: number): number {
  return Math.min(1, Math.max(0, (v - r.min) / (r.max - r.min)));
}

export type LeituraIndicador = {
  ind: Indicador;
  valor: number | null;
  texto: string;
  frase: string | null;
  situacao: Situacao;
};

export function lerIndicadores(r: Resultado): LeituraIndicador[] {
  return INDICADORES.map((ind) => {
    const v = ind.valor(r);
    const temValor = v !== null && Number.isFinite(v);
    return {
      ind,
      valor: temValor ? v : null,
      texto: temValor ? ind.formato(v) : "—",
      frase: temValor ? ind.frase(v, r) : null,
      situacao: situacao(ind, temValor ? v : null),
    };
  });
}

/** Contagem por situação, para o resumo do relatório. */
export function placar(leituras: LeituraIndicador[]) {
  const c = { ok: 0, atencao: 0, critico: 0, sem_dado: 0 } as Record<Situacao, number>;
  for (const l of leituras) if (l.ind.regua) c[l.situacao]++;
  return c;
}
