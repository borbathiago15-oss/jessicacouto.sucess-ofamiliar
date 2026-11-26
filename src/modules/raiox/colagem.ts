import { CAMPOS, GRUPOS_CAMPOS, lerNumero, type CampoFinanceiro, type Valores } from "./calculo";

/**
 * Preenchimento do Raio-X com a ajuda de uma IA de fora do sistema: a pessoa copia
 * as instruções, envia junto com o PDF (DRE, balanço) na IA que preferir e cola a
 * resposta de volta. Nenhum dado sai pelo sistema; nada é gravado sem conferência.
 */

const DICA: Partial<Record<CampoFinanceiro, string>> = {
  receitaBruta: "faturamento bruto, receita operacional bruta",
  deducoes: "impostos sobre vendas, devoluções, abatimentos (valor positivo)",
  cmv: "custo das mercadorias, dos produtos ou dos serviços vendidos (valor positivo)",
  despesasOperacionais:
    "administrativas, comerciais, gerais e folha; SEM depreciação, SEM juros e SEM o que for de sócios e familiares",
  depreciacao: "depreciação e amortização do período",
  despesasFinanceiras: "juros, encargos e tarifas de empréstimos (valor positivo)",
  receitasFinanceiras: "rendimentos de aplicações, juros recebidos",
  impostosLucro: "IRPJ e CSLL (ou o imposto do Simples sobre o lucro, se estiver separado)",
  proLabore: "pró-labore dos sócios",
  salariosFamiliares: "salários de familiares que estão na folha",
  despesasPessoais: "despesas pessoais dos sócios pagas pela empresa",
  distribuicoes: "lucros distribuídos e retiradas dos sócios",
  familiaresNaEmpresa: "quantidade de familiares que trabalham na empresa (número inteiro)",
  caixa: "caixa, bancos e aplicações financeiras de curto prazo",
  receber: "clientes, duplicatas a receber",
  estoques: "estoques",
  outrosAC: "demais itens do ativo circulante",
  imobilizado: "ativo não circulante (imobilizado, intangível, realizável a longo prazo)",
  fornecedores: "fornecedores a pagar",
  emprestimosCP: "empréstimos e financiamentos do passivo circulante",
  outrosPC: "demais itens do passivo circulante (salários, impostos e encargos a pagar)",
  emprestimosLP: "empréstimos e financiamentos do passivo não circulante",
  patrimonioLiquido: "patrimônio líquido total",
};

const ROTULO = new Map<CampoFinanceiro, string>(
  GRUPOS_CAMPOS.flatMap((g) => g.campos.map((c) => [c.k, c.rotulo] as const)),
);

/** Instruções prontas para copiar e enviar à IA junto com o documento. */
export function promptParaIA(): string {
  const linhas = GRUPOS_CAMPOS.flatMap((g) => [
    "",
    `# ${g.titulo}`,
    ...g.campos.map((c) => `${c.k}: ${c.rotulo}${DICA[c.k] ? ` (${DICA[c.k]})` : ""}`),
  ]);
  return [
    "Você vai extrair números de demonstrações financeiras (DRE, balanço patrimonial ou balancete) que estou enviando em anexo ou colando abaixo.",
    "",
    "Regras:",
    "1. Use somente o que está no documento. Não invente, não estime e não calcule valores que não aparecem.",
    "2. Valores em reais, sem R$, sem ponto de milhar, com vírgula para centavos (exemplo: 1234567,89). Se o documento estiver em milhares de reais, converta para reais.",
    "3. Informe custos, despesas e deduções como números positivos.",
    "4. Se um item não existir no documento, responda 0.",
    "5. Se o documento tiver mais de um período, use o mais recente e diga qual é.",
    "6. Quando o documento usar outro nome para a conta, some as contas que correspondem ao item. Cada valor do documento entra em um único item.",
    "7. Responda SOMENTE no formato abaixo, uma linha por item, sem tabela, sem negrito e sem comentários fora da linha de observações.",
    "",
    "Formato da resposta (mantenha os nomes antes dos dois-pontos exatamente como estão):",
    "",
    "periodo: (ano ou período do documento, exemplo: 2025)",
    "meses: (quantidade de meses do período, exemplo: 12)",
    ...linhas,
    "",
    "observacoes: (em uma linha: o que não foi encontrado, contas que você somou e qualquer dúvida de classificação)",
  ].join("\n");
}

const semAcento = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// Aceita a chave (receitaBruta) ou o nome do campo como aparece na tela.
const POR_NOME = new Map<string, CampoFinanceiro>();
for (const k of CAMPOS) {
  POR_NOME.set(semAcento(k), k);
  const r = ROTULO.get(k);
  if (r) POR_NOME.set(semAcento(r), k);
}

export type Colagem = {
  valores: Valores;
  /** Campos que vieram na resposta (inclusive com zero). */
  lidos: CampoFinanceiro[];
  faltando: CampoFinanceiro[];
  periodo: string | null;
  meses: number | null;
  observacoes: string | null;
  /** Linhas com cara de "nome: valor" que o sistema não reconheceu. */
  ignoradas: string[];
};

/**
 * Lê a resposta colada. Tolera o que as IAs costumam acrescentar: marcadores,
 * negrito, crases, tabela com barras, "R$" e a resposta em JSON.
 */
export function lerColagem(texto: string): Colagem {
  const valores: Valores = {};
  const lidos = new Set<CampoFinanceiro>();
  const ignoradas: string[] = [];
  let periodo: string | null = null;
  let meses: number | null = null;
  let observacoes: string | null = null;

  const guardar = (nomeBruto: string, valorBruto: string) => {
    const nome = semAcento(nomeBruto);
    const valor = valorBruto.trim().replace(/^["'`]+|["'`,;]+$/g, "");
    if (!nome) return;
    if (nome === "periodo") {
      if (valor) periodo = valor.replace(/[()]/g, "").trim().slice(0, 40) || null;
      return;
    }
    if (nome === "meses") {
      const n = Math.round(lerNumero(valor));
      if (n >= 1 && n <= 24) meses = n;
      return;
    }
    if (nome === "observacoes" || nome === "observacao") {
      if (valor) observacoes = valor.slice(0, 1000);
      return;
    }
    const campo = POR_NOME.get(nome);
    if (!campo) {
      if (/\d/.test(valor)) ignoradas.push(`${nomeBruto.trim()}: ${valor}`.slice(0, 120));
      return;
    }
    // Só o primeiro número da linha (a IA às vezes acrescenta um comentário depois).
    const numero = /\(?-?\s*(?:R\$\s*)?[\d.]+(?:,\d+)?\)?/.exec(valor)?.[0] ?? "";
    const n = lerNumero(numero);
    lidos.add(campo);
    if (n && Math.abs(n) < 1e13)
      valores[campo] = campo === "familiaresNaEmpresa" ? Math.round(n) : n;
    else delete valores[campo];
  };

  for (const bruta of texto.split(/\r?\n/)) {
    // Tira marcadores, negrito, crases, aspas de JSON e barras de tabela.
    const linha = bruta
      .replace(/[*`_]/g, "")
      .replace(/^\s*(?:[-•>]+|\d+[.)])\s+/, "")
      .replace(/^\s*\|/, "")
      .replace(/\|\s*$/, "")
      .replace(/"/g, "")
      .trim();
    if (!linha || /^[#{}[\]]/.test(linha) || /^[-:| ]+$/.test(linha)) continue;
    const m = /^([^:=|]{2,80}?)\s*[:=|]\s*(.*)$/.exec(linha);
    if (m) guardar(m[1]!, m[2]!);
  }

  return {
    valores,
    lidos: CAMPOS.filter((k) => lidos.has(k)),
    faltando: CAMPOS.filter((k) => !lidos.has(k)),
    periodo,
    meses,
    observacoes,
    ignoradas: ignoradas.slice(0, 10),
  };
}

export const rotuloDoCampo = (k: CampoFinanceiro) => ROTULO.get(k) ?? k;
