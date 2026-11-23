import { z } from "zod";

/**
 * Raio-X Financeiro: cálculo puro (mesmo da ferramenta offline).
 * Os nomes dos campos são os mesmos do arquivo .json exportado por ela e da
 * validação no banco (private.financial_values_valid).
 */

export type Campo = { k: CampoFinanceiro; rotulo: string; ajuda?: string; inteiro?: boolean };

export const GRUPOS_CAMPOS: readonly { titulo: string; campos: readonly Campo[] }[] = [
  {
    titulo: "Resultado do período (DRE)",
    campos: [
      { k: "receitaBruta", rotulo: "Receita bruta de vendas" },
      {
        k: "deducoes",
        rotulo: "Deduções da receita",
        ajuda: "Impostos sobre vendas, devoluções e descontos",
      },
      { k: "cmv", rotulo: "Custo das vendas (CMV/CPV/CSP)" },
      {
        k: "despesasOperacionais",
        rotulo: "Despesas operacionais",
        ajuda: "Administrativas, comerciais e folha (sem sócios e familiares)",
      },
      { k: "depreciacao", rotulo: "Depreciação e amortização" },
      { k: "despesasFinanceiras", rotulo: "Despesas financeiras (juros)" },
      { k: "receitasFinanceiras", rotulo: "Receitas financeiras" },
      { k: "impostosLucro", rotulo: "IR e CSLL" },
    ],
  },
  {
    titulo: "Família e sócios",
    campos: [
      { k: "proLabore", rotulo: "Pró-labore dos sócios" },
      { k: "salariosFamiliares", rotulo: "Salários de familiares na folha" },
      {
        k: "despesasPessoais",
        rotulo: "Despesas pessoais pagas pela empresa",
        ajuda: "Carro, escola, cartão, contas da casa…",
      },
      {
        k: "distribuicoes",
        rotulo: "Retiradas e distribuição de lucros",
        ajuda: "Tudo o que saiu para os sócios além do pró-labore",
      },
      {
        k: "familiaresNaEmpresa",
        rotulo: "Familiares trabalhando na empresa",
        ajuda: "Quantidade de pessoas",
        inteiro: true,
      },
    ],
  },
  {
    titulo: "Balanço (no fim do período)",
    campos: [
      { k: "caixa", rotulo: "Caixa, bancos e aplicações" },
      { k: "receber", rotulo: "Contas a receber de clientes" },
      { k: "estoques", rotulo: "Estoques" },
      { k: "outrosAC", rotulo: "Outros ativos de curto prazo" },
      { k: "imobilizado", rotulo: "Imobilizado e outros ativos de longo prazo" },
      { k: "fornecedores", rotulo: "Fornecedores a pagar" },
      { k: "emprestimosCP", rotulo: "Empréstimos e financiamentos (até 12 meses)" },
      {
        k: "outrosPC",
        rotulo: "Outras obrigações de curto prazo",
        ajuda: "Salários, impostos e encargos a pagar…",
      },
      { k: "emprestimosLP", rotulo: "Empréstimos e financiamentos (após 12 meses)" },
      { k: "patrimonioLiquido", rotulo: "Patrimônio líquido" },
    ],
  },
];

export const CAMPOS = [
  "receitaBruta",
  "deducoes",
  "cmv",
  "despesasOperacionais",
  "depreciacao",
  "despesasFinanceiras",
  "receitasFinanceiras",
  "impostosLucro",
  "proLabore",
  "salariosFamiliares",
  "despesasPessoais",
  "distribuicoes",
  "familiaresNaEmpresa",
  "caixa",
  "receber",
  "estoques",
  "outrosAC",
  "imobilizado",
  "fornecedores",
  "emprestimosCP",
  "outrosPC",
  "emprestimosLP",
  "patrimonioLiquido",
] as const;
export type CampoFinanceiro = (typeof CAMPOS)[number];
export type Valores = Partial<Record<CampoFinanceiro, number>>;

const valor = z.number().finite().gt(-1e13).lt(1e13);
export const valoresSchema = z
  .record(z.string(), valor)
  .refine((v) => Object.keys(v).every((k) => (CAMPOS as readonly string[]).includes(k)), {
    message: "Campo financeiro desconhecido.",
  })
  .transform((v) => v as Valores);

export const periodoSchema = z.object({
  label: z.string().trim().min(1, "Informe o nome do período.").max(40),
  months: z.number().int().min(1).max(24),
  values: valoresSchema,
  notes: z
    .string()
    .max(5000)
    .nullish()
    .transform((v) => (v?.trim() ? v : null)),
});
export type Periodo = z.infer<typeof periodoSchema>;

/** Arquivo .json exportado pela ferramenta offline (formato jc-raiox-1). */
export const arquivoOfflineSchema = z.object({
  formato: z.literal("jc-raiox-1"),
  empresa: z.object({
    nome: z.string().trim().min(1).max(200),
    segmento: z.string().max(120).nullish(),
    periodos: z
      .array(
        z.object({
          rotulo: z.string().trim().min(1).max(40),
          meses: z.number().int().min(1).max(24),
          valores: z.record(z.string(), z.unknown()),
          leitura: z.string().max(5000).nullish(),
        }),
      )
      .min(1)
      .max(40),
  }),
});

/** Converte o arquivo offline em períodos válidos (ignora campos desconhecidos). */
export function periodosDoArquivo(arquivo: z.infer<typeof arquivoOfflineSchema>): Periodo[] {
  return arquivo.empresa.periodos.map((p) => {
    const values: Valores = {};
    for (const k of CAMPOS) {
      const n = Number(p.valores[k]);
      if (Number.isFinite(n) && n !== 0 && Math.abs(n) < 1e13) values[k] = n;
    }
    return { label: p.rotulo, months: p.meses, values, notes: p.leitura?.trim() || null };
  });
}

/** Lê número digitado em formato brasileiro (1.234.567,89) ou simples (1234567). */
export function lerNumero(txt: string): number {
  let s = txt.trim().replace(/[R$\s]/g, "");
  if (!s) return 0;
  const negativo = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[()-]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? (negativo ? -n : n) : 0;
}

const div = (a: number, b: number) => (b ? a / b : null);

export function calcular(valores: Valores, mesesPeriodo: number) {
  const v = Object.fromEntries(CAMPOS.map((k) => [k, Number(valores[k]) || 0])) as Record<
    CampoFinanceiro,
    number
  >;
  const meses = Math.max(1, mesesPeriodo || 12);
  const anual = 12 / meses;
  const diasPeriodo = meses * 30;

  const receitaLiquida = v.receitaBruta - v.deducoes;
  const lucroBruto = receitaLiquida - v.cmv;
  const custoFamiliaNoResultado = v.proLabore + v.salariosFamiliares + v.despesasPessoais;
  const ebitdaAntesFamilia = lucroBruto - v.despesasOperacionais;
  const ebitda = ebitdaAntesFamilia - custoFamiliaNoResultado;
  const ebit = ebitda - v.depreciacao;
  const lair = ebit - v.despesasFinanceiras + v.receitasFinanceiras;
  const lucroLiquido = lair - v.impostosLucro;
  const caixaAposFamilia = lucroLiquido + v.depreciacao - v.distribuicoes;
  const retiradasFamilia = custoFamiliaNoResultado + v.distribuicoes;

  const ativoCirculante = v.caixa + v.receber + v.estoques + v.outrosAC;
  const passivoCirculante = v.fornecedores + v.emprestimosCP + v.outrosPC;
  const dividaBruta = v.emprestimosCP + v.emprestimosLP;
  const dividaLiquida = dividaBruta - v.caixa;
  const ativoTotal = ativoCirculante + v.imobilizado;
  const temBalanco = ativoTotal > 0 || passivoCirculante > 0 || dividaBruta > 0;

  const pmr = div(v.receber, v.receitaBruta);
  const pme = div(v.estoques, v.cmv);
  const pmp = div(v.fornecedores, v.cmv);

  return {
    v,
    meses,
    receitaLiquida,
    lucroBruto,
    ebitdaAntesFamilia,
    ebitda,
    ebit,
    lair,
    lucroLiquido,
    caixaAposFamilia,
    retiradasFamilia,
    custoFamiliaNoResultado,
    margemBruta: div(lucroBruto, receitaLiquida),
    margemEbitda: div(ebitda, receitaLiquida),
    margemLiquida: div(lucroLiquido, receitaLiquida),
    /** Quanto da geração de caixa da operação (antes de pagar a família) vai para a família. */
    pesoFamilia: ebitdaAntesFamilia > 0 ? retiradasFamilia / ebitdaAntesFamilia : null,
    retiradasSobreReceita: div(retiradasFamilia, receitaLiquida),
    temBalanco,
    ativoCirculante,
    passivoCirculante,
    dividaBruta,
    dividaLiquida,
    ativoTotal,
    liquidezCorrente: temBalanco ? div(ativoCirculante, passivoCirculante) : null,
    liquidezSeca: temBalanco ? div(ativoCirculante - v.estoques, passivoCirculante) : null,
    liquidezImediata: temBalanco ? div(v.caixa, passivoCirculante) : null,
    capitalGiro: temBalanco ? ativoCirculante - passivoCirculante : null,
    necessidadeGiro: temBalanco ? v.receber + v.estoques - v.fornecedores : null,
    endividamentoGeral: temBalanco ? div(passivoCirculante + v.emprestimosLP, ativoTotal) : null,
    dlEbitda: ebitda > 0 ? dividaLiquida / (ebitda * anual) : null,
    coberturaJuros: v.despesasFinanceiras > 0 ? ebitda / v.despesasFinanceiras : null,
    pmr: pmr === null ? null : pmr * diasPeriodo,
    pme: pme === null ? null : pme * diasPeriodo,
    pmp: pmp === null ? null : pmp * diasPeriodo,
    cicloCaixa:
      pmr === null || pme === null || pmp === null ? null : (pmr + pme - pmp) * diasPeriodo,
    roe: v.patrimonioLiquido > 0 ? (lucroLiquido * anual) / v.patrimonioLiquido : null,
  };
}
export type Resultado = ReturnType<typeof calcular>;

// ---------------------------------------------------------------------------
// Formatação (pt-BR)
// ---------------------------------------------------------------------------
const fmtBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
export const fmtNum = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const fmt1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const ok = (v: number | null): v is number => v !== null && Number.isFinite(v);
export const brl = (v: number | null) => (ok(v) ? fmtBRL.format(v) : "—");
export const pct = (v: number | null) => (ok(v) ? `${fmt1.format(v * 100)}%` : "—");
export const vezes = (v: number | null) => (ok(v) ? `${fmt1.format(v)}×` : "—");
export const dias = (v: number | null) => (ok(v) ? `${Math.round(v)} dias` : "—");

/** Variação só entre valores positivos (de negativo para positivo engana). */
export function variacao(atual: number | null, anterior: number | null): number | null {
  if (!ok(atual) || !ok(anterior) || anterior <= 0 || atual < 0) return null;
  return (atual - anterior) / anterior;
}

// ---------------------------------------------------------------------------
// Pontos de atenção (referências gerais de mercado; a leitura final é da consultora)
// ---------------------------------------------------------------------------
export type Alerta = { nivel: "critico" | "atencao" | "ok"; titulo: string; texto: string };

export function alertas(r: Resultado): Alerta[] {
  const a: Alerta[] = [];
  const add = (nivel: Alerta["nivel"], titulo: string, texto: string) =>
    a.push({ nivel, titulo, texto });
  if (r.v.receitaBruta <= 0)
    return [
      {
        nivel: "atencao",
        titulo: "Faltam dados",
        texto: "Informe ao menos a receita bruta para começar a leitura.",
      },
    ];

  if (r.lucroLiquido < 0)
    add(
      "critico",
      "Prejuízo no período",
      `A empresa fechou com resultado de ${brl(r.lucroLiquido)}.`,
    );
  else if (ok(r.margemLiquida) && r.margemLiquida < 0.05)
    add(
      "atencao",
      "Margem líquida apertada",
      `Sobram ${pct(r.margemLiquida)} de cada real vendido.`,
    );

  if (ok(r.pesoFamilia)) {
    if (r.pesoFamilia > 1)
      add(
        "critico",
        "A família retira mais do que a empresa gera",
        `As retiradas somam ${pct(r.pesoFamilia)} da geração de caixa da operação.`,
      );
    else if (r.pesoFamilia > 0.7)
      add(
        "atencao",
        "Retiradas da família muito altas",
        `${pct(r.pesoFamilia)} da geração de caixa da operação vai para a família.`,
      );
    else if (r.retiradasFamilia > 0)
      add(
        "ok",
        "Retiradas compatíveis com a geração de caixa",
        `${pct(r.pesoFamilia)} da geração de caixa da operação vai para a família.`,
      );
  } else if (r.retiradasFamilia > 0) {
    add(
      "critico",
      "Retiradas sem geração de caixa",
      `A operação não gera caixa, mas a família retirou ${brl(r.retiradasFamilia)}.`,
    );
  }
  if (r.v.despesasPessoais > 0)
    add(
      "atencao",
      "Mistura entre pessoa física e empresa",
      `${brl(r.v.despesasPessoais)} de despesas pessoais pagas pela empresa.`,
    );
  if (r.caixaAposFamilia < 0)
    add(
      "critico",
      "Caixa diminui depois das retiradas",
      `Após lucros, depreciação e retiradas, o caixa varia em ${brl(r.caixaAposFamilia)}.`,
    );

  if (ok(r.liquidezCorrente)) {
    if (r.liquidezCorrente < 1)
      add(
        "critico",
        "Contas de curto prazo maiores que os recursos",
        `Liquidez corrente de ${vezes(r.liquidezCorrente)}.`,
      );
    else if (r.liquidezCorrente < 1.2)
      add(
        "atencao",
        "Folga de curto prazo pequena",
        `Liquidez corrente de ${vezes(r.liquidezCorrente)}.`,
      );
  }
  if (r.dividaLiquida > 0 && r.ebitda <= 0)
    add(
      "critico",
      "Dívida sem geração de caixa para pagá-la",
      `Dívida líquida de ${brl(r.dividaLiquida)}.`,
    );
  else if (ok(r.dlEbitda)) {
    if (r.dlEbitda > 3)
      add(
        "critico",
        "Endividamento alto",
        `A dívida líquida equivale a ${vezes(r.dlEbitda)} a geração de caixa anual.`,
      );
    else if (r.dlEbitda > 2)
      add(
        "atencao",
        "Endividamento pede atenção",
        `A dívida líquida equivale a ${vezes(r.dlEbitda)} a geração de caixa anual.`,
      );
  }
  if (ok(r.coberturaJuros)) {
    if (r.coberturaJuros < 1.5)
      add(
        "critico",
        "Juros pesam demais",
        `A geração de caixa cobre os juros só ${vezes(r.coberturaJuros)}.`,
      );
    else if (r.coberturaJuros < 3)
      add(
        "atencao",
        "Juros relevantes",
        `A geração de caixa cobre os juros ${vezes(r.coberturaJuros)}.`,
      );
  }
  if (ok(r.cicloCaixa) && r.cicloCaixa > 90)
    add(
      "atencao",
      "Ciclo de caixa longo",
      `O dinheiro leva cerca de ${dias(r.cicloCaixa)} para voltar ao caixa.`,
    );
  if (!r.temBalanco)
    add("atencao", "Sem balanço", "Preencha o balanço para ver liquidez, dívida e ciclo de caixa.");
  return a;
}

/** Linhas da tabela completa de indicadores. */
export const LINHAS_INDICADORES: [
  string,
  (r: Resultado) => number | null,
  (v: number | null) => string,
  boolean?,
][] = [
  ["Receita líquida", (r) => r.receitaLiquida, brl, true],
  ["Lucro bruto", (r) => r.lucroBruto, brl],
  ["Margem bruta", (r) => r.margemBruta, pct],
  ["Geração de caixa antes da família", (r) => r.ebitdaAntesFamilia, brl],
  ["Pró-labore, salários e despesas da família", (r) => r.custoFamiliaNoResultado, brl],
  ["EBITDA", (r) => r.ebitda, brl, true],
  ["Margem EBITDA", (r) => r.margemEbitda, pct],
  ["Lucro líquido", (r) => r.lucroLiquido, brl, true],
  ["Margem líquida", (r) => r.margemLiquida, pct],
  ["Retiradas totais da família", (r) => r.retiradasFamilia, brl, true],
  ["Peso da família na geração de caixa", (r) => r.pesoFamilia, pct],
  ["Retiradas ÷ receita", (r) => r.retiradasSobreReceita, pct],
  ["Variação de caixa após retiradas", (r) => r.caixaAposFamilia, brl],
  ["Liquidez corrente", (r) => r.liquidezCorrente, vezes],
  ["Liquidez seca", (r) => r.liquidezSeca, vezes],
  ["Liquidez imediata", (r) => r.liquidezImediata, vezes],
  ["Capital de giro", (r) => r.capitalGiro, brl],
  ["Necessidade de capital de giro", (r) => r.necessidadeGiro, brl],
  ["Dívida bruta", (r) => r.dividaBruta, brl],
  ["Dívida líquida", (r) => r.dividaLiquida, brl],
  ["Dívida líquida ÷ EBITDA anual", (r) => r.dlEbitda, vezes],
  ["Cobertura de juros (EBITDA ÷ juros)", (r) => r.coberturaJuros, vezes],
  ["Endividamento geral", (r) => r.endividamentoGeral, pct],
  ["Prazo médio de recebimento", (r) => r.pmr, dias],
  ["Prazo médio de estoque", (r) => r.pme, dias],
  ["Prazo médio de pagamento", (r) => r.pmp, dias],
  ["Ciclo de caixa", (r) => r.cicloCaixa, dias, true],
  ["Retorno sobre o patrimônio (anual)", (r) => r.roe, pct],
];
