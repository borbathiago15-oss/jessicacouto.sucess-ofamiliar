/**
 * Diagnóstico de Sucessão FICTÍCIO, só para testes. Não é o conteúdo da Jéssica
 * (perguntas, regras e mensagens reais ficam somente no banco de cada ambiente).
 */
export const diagnosticoFicticio = {
  titulo: "Diagnóstico fictício",
  introducao: "Três perguntas de exemplo para testes.",
  perguntas: [
    {
      chave: "papel",
      texto: "Pergunta fictícia sobre o papel",
      tipo: "escolha",
      opcoes: [
        { valor: "a", rotulo: "Papel fictício A", papel_crm: "founder" },
        { valor: "b", rotulo: "Papel fictício B", papel_crm: "successor" },
      ],
    },
    {
      chave: "prazo",
      texto: "Pergunta fictícia sobre o prazo",
      tipo: "escolha",
      opcoes: [
        { valor: "curto", rotulo: "Prazo fictício curto" },
        { valor: "medio", rotulo: "Prazo fictício médio" },
        { valor: "longo", rotulo: "Prazo fictício longo" },
      ],
    },
    {
      chave: "riscos",
      texto: "Pergunta fictícia sobre riscos",
      ajuda: "Escolha até 2.",
      tipo: "multipla",
      max: 2,
      opcoes: [
        { valor: "r1", rotulo: "Risco fictício 1" },
        { valor: "r2", rotulo: "Risco fictício 2" },
        { valor: "r3", rotulo: "Risco fictício 3" },
      ],
    },
    { chave: "tema", texto: "Pergunta fictícia aberta", tipo: "aberta", opcional: true },
  ],
  regras: [
    {
      nivel: "imediata",
      motivo: "Motivo fictício: prazo curto.",
      quando: [{ pergunta: "prazo", valores: ["curto"] }],
    },
    { nivel: "trinta_dias", quando: [{ pergunta: "prazo", valores: ["medio"] }] },
    {
      motivo: "Motivo fictício: papel A com risco 1.",
      quando: [
        { pergunta: "papel", valores: ["a"] },
        { pergunta: "riscos", valores: ["r1"] },
      ],
    },
  ],
  mensagens: {
    abertura: {
      pergunta: "papel",
      textos: { a: "Abertura fictícia A.", b: "Abertura fictícia B." },
    },
    riscos: {
      pergunta: "riscos",
      textos: {
        r1: "Faria algo fictício sobre o risco 1.",
        r2: "Faria algo fictício sobre o risco 2.",
      },
    },
    dor: { pergunta: "papel", textos: { a: "Dor fictícia A." } },
    motivo_nutricao: "Motivo fictício de nutrição.",
    proximo_passo: {
      imediata: "Próximo passo fictício: conversa imediata.",
      trinta_dias: "Próximo passo fictício: conversa em 30 dias.",
      nutricao: "Próximo passo fictício: conteúdos.",
    },
  },
};
