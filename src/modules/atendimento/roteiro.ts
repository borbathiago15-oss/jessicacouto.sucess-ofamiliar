/**
 * Roteiro do atendimento: as etapas do trabalho com um cliente, com a situação
 * de cada uma calculada do que já existe no sistema. Regra pura, sem banco.
 * A ordem é a do trabalho: fechar, conhecer, analisar, planejar, entregar.
 */

export type SituacaoEtapa = "feito" | "andamento" | "pendente";

export type Etapa = {
  chave: string;
  titulo: string;
  /** O que a etapa entrega, em uma frase. */
  paraQue: string;
  situacao: SituacaoEtapa;
  /** Resumo do que já existe (ex.: "3 de 5 responderam"). */
  resumo: string;
  href: string;
  /** Texto do link (as telas e os testes usam estes nomes). */
  acao: string;
};

export type DadosDoAtendimento = {
  /** undefined = a pessoa não tem acesso àquela parte; a etapa não aparece. */
  contratos?: { ativos: number; total: number };
  pessoas?: number;
  questionarios?: { enviados: number; respondidos: number };
  periodos?: number;
  cargos?: number;
  acoes?: { total: number; concluidas: number };
  relatorio?: { publicados: number };
  portal?: { membros: number; publicados: number };
};

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function montarRoteiro(base: string, d: DadosDoAtendimento): Etapa[] {
  const etapas: Etapa[] = [];
  const temAnalise = (d.periodos ?? 0) > 0 || (d.cargos ?? 0) > 0 || (d.pessoas ?? 0) > 0;

  if (d.contratos)
    etapas.push({
      chave: "contrato",
      titulo: "Contrato",
      paraQue: "O que foi fechado: serviço, valor e datas.",
      situacao: d.contratos.total ? "feito" : "pendente",
      resumo: d.contratos.total
        ? d.contratos.ativos
          ? `${plural(d.contratos.ativos, "contrato", "contratos")} em andamento`
          : "Sem contrato em andamento"
        : "Nenhum contrato registrado",
      href: `${base}/contratos`,
      acao: "Abrir contratos e propostas",
    });
  if (d.pessoas !== undefined)
    etapas.push({
      chave: "familia",
      titulo: "Família e pessoas",
      paraQue: "Quem é quem: gerações, participação e sucessão.",
      situacao: d.pessoas ? "feito" : "pendente",
      resumo: d.pessoas
        ? plural(d.pessoas, "pessoa mapeada", "pessoas mapeadas")
        : "Ninguém mapeado",
      href: `${base}/familia`,
      acao: "Abrir a família",
    });
  if (d.questionarios)
    etapas.push({
      chave: "questionarios",
      titulo: "Questionários",
      paraQue: "A visão de cada pessoa, por dimensão.",
      situacao: !d.questionarios.enviados
        ? "pendente"
        : d.questionarios.respondidos >= d.questionarios.enviados
          ? "feito"
          : "andamento",
      resumo: d.questionarios.enviados
        ? `${d.questionarios.respondidos} de ${d.questionarios.enviados} responderam`
        : "Nenhum link enviado",
      href: `${base}/questionarios`,
      acao: "Abrir os questionários",
    });
  if (d.periodos !== undefined)
    etapas.push({
      chave: "raiox",
      titulo: "Raio-X Financeiro",
      paraQue: "Os números da empresa e o peso da família no caixa.",
      situacao: d.periodos ? "feito" : "pendente",
      resumo: d.periodos
        ? plural(d.periodos, "período lançado", "períodos lançados")
        : "Nenhum período lançado",
      href: `${base}/raio-x`,
      acao: "Abrir o Raio-X",
    });
  if (d.cargos !== undefined)
    etapas.push({
      chave: "organograma",
      titulo: "Organograma",
      paraQue: "A estrutura de hoje, o que trava e a proposta da JC.",
      situacao: d.cargos ? "feito" : "pendente",
      resumo: d.cargos ? plural(d.cargos, "cargo desenhado", "cargos desenhados") : "Não desenhado",
      href: `${base}/organograma`,
      acao: "Abrir o organograma",
    });
  if (d.acoes)
    etapas.push({
      chave: "pdca",
      titulo: "Plano de ação (PDCA)",
      paraQue: "O que atacar primeiro, com responsável, prazo e acompanhamento.",
      situacao: !d.acoes.total
        ? "pendente"
        : d.acoes.concluidas >= d.acoes.total
          ? "feito"
          : "andamento",
      resumo: d.acoes.total
        ? `${d.acoes.concluidas} de ${plural(d.acoes.total, "ação concluída", "ações concluídas")}`
        : "Nenhuma ação aberta",
      href: `${base}/prioridades`,
      acao: "Abrir o PDCA",
    });
  if (d.relatorio)
    etapas.push({
      chave: "relatorio",
      titulo: "Relatório Executivo",
      paraQue: "As conclusões em um documento, também como apresentação.",
      situacao: d.relatorio.publicados ? "feito" : temAnalise ? "andamento" : "pendente",
      resumo: d.relatorio.publicados
        ? plural(
            d.relatorio.publicados,
            "versão entregue ao cliente",
            "versões entregues ao cliente",
          )
        : temAnalise
          ? "Pronto para gerar e revisar"
          : "Depende das análises",
      href: `${base}/relatorio`,
      acao: "Abrir o relatório",
    });
  if (d.portal)
    etapas.push({
      chave: "portal",
      titulo: "Entrega no portal do cliente",
      paraQue: "O cliente acessa o relatório, o plano e os documentos.",
      situacao:
        d.portal.membros && d.portal.publicados
          ? "feito"
          : d.portal.membros || d.portal.publicados
            ? "andamento"
            : "pendente",
      resumo: d.portal.membros
        ? `${plural(d.portal.membros, "pessoa com acesso", "pessoas com acesso")}${d.portal.publicados ? "" : ", nada publicado"}`
        : "Ninguém do cliente com acesso",
      href: `${base}/portal`,
      acao: "Abrir o portal",
    });
  return etapas;
}

/** A próxima etapa a fazer: a primeira que ainda não está feita. */
export function proximaEtapa(etapas: Etapa[]): Etapa | null {
  return etapas.find((e) => e.situacao !== "feito") ?? null;
}

export function progresso(etapas: Etapa[]) {
  const feitas = etapas.filter((e) => e.situacao === "feito").length;
  return { feitas, total: etapas.length, fracao: etapas.length ? feitas / etapas.length : 0 };
}
