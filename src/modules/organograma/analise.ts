import { montarArvore, normalizar, profundidade, type Cargo } from "./schema";

/**
 * Leitura do organograma: pontos de atenção de estrutura, com regras gerais e
 * explícitas (sem metodologia proprietária). A leitura final é da consultora.
 */

export type NivelAchado = "critico" | "atencao";
export type AchadoOrganograma = {
  /** Chave estável (evita duplicar o mesmo achado na Matriz de Prioridades). */
  chave: string;
  nivel: NivelAchado;
  titulo: string;
  texto: string;
};

/** Limites usados na leitura (públicos, para a tela explicar o critério). */
export const LIMITES = {
  amplitudeAtencao: 8,
  amplitudeCritica: 12,
  niveisAtencao: 6,
  cargosPorPessoaCritico: 3,
  subordinadosDoSocio: 7,
} as const;

const lista = (nomes: string[], max = 4) => {
  const unicos = [...new Set(nomes)];
  const mostrados = unicos.slice(0, max);
  const resto = unicos.length - mostrados.length;
  const base =
    mostrados.length <= 1
      ? (mostrados[0] ?? "")
      : `${mostrados.slice(0, -1).join(", ")} e ${mostrados.at(-1)}`;
  return resto > 0 ? `${mostrados.join(", ")} e mais ${resto}` : base;
};

export function analisarOrganograma(cargos: Cargo[]): AchadoOrganograma[] {
  if (!cargos.length) return [];
  const achados: AchadoOrganograma[] = [];
  const porId = new Map(cargos.map((c) => [c.id, c]));
  const diretos = new Map<string, Cargo[]>();
  for (const c of cargos)
    if (c.reports_to && porId.has(c.reports_to))
      diretos.set(c.reports_to, [...(diretos.get(c.reports_to) ?? []), c]);
  const nDiretos = (c: Cargo) => diretos.get(c.id)?.length ?? 0;
  const topos = cargos.filter((c) => !c.reports_to || !porId.has(c.reports_to));

  // 1. Topo da estrutura.
  if (topos.length > 1)
    achados.push({
      chave: "organograma-mais-de-um-topo",
      nivel: "atencao",
      titulo: "Mais de um topo na estrutura",
      texto: `${topos.length} cargos não respondem a ninguém (${lista(topos.map((c) => c.title))}). Sem um topo claro, decisões que envolvem mais de uma frente ficam sem dono final.`,
    });

  // 2. Dupla subordinação.
  const duplos = cargos.filter((c) => c.also_reports_to && porId.has(c.also_reports_to));
  if (duplos.length)
    achados.push({
      chave: "organograma-dupla-subordinacao",
      nivel: "atencao",
      titulo: "Dupla subordinação",
      texto: `${lista(duplos.map((c) => c.title))} ${duplos.length === 1 ? "responde" : "respondem"} a dois superiores. Ordens podem se contradizer e a cobrança perde clareza.`,
    });

  // 3. Amplitude de controle.
  for (const c of cargos) {
    const n = nDiretos(c);
    if (n > LIMITES.amplitudeAtencao)
      achados.push({
        chave: `organograma-amplitude-${normalizar(c.title).replace(/[^a-z0-9]+/g, "-")}`,
        nivel: n > LIMITES.amplitudeCritica ? "critico" : "atencao",
        titulo: `Muitas pessoas respondendo a ${c.title}`,
        texto: `${n} cargos respondem diretamente a ${c.title}. Acima de ${LIMITES.amplitudeAtencao} subordinados diretos, o acompanhamento costuma ficar superficial.`,
      });
  }

  // 4. Concentração em uma pessoa (acúmulo de cargos e gargalo no sócio/fundador).
  const porPessoa = new Map<string, Cargo[]>();
  for (const c of cargos)
    if (c.holder_name) {
      const k = normalizar(c.holder_name);
      porPessoa.set(k, [...(porPessoa.get(k) ?? []), c]);
    }
  for (const [k, seus] of porPessoa) {
    const nome = seus[0]!.holder_name!;
    const subordinados = seus.reduce((t, c) => t + nDiretos(c), 0);
    const socio = seus.some((c) => c.is_owner);
    const chave = `organograma-concentracao-${k.replace(/[^a-z0-9]+/g, "-")}`;
    if (socio && (seus.length >= 2 || subordinados >= LIMITES.subordinadosDoSocio))
      achados.push({
        chave,
        nivel: "critico",
        titulo: `Decisões concentradas em ${nome}`,
        texto: `${nome}, sócio(a), ocupa ${seus.length === 1 ? "1 cargo" : `${seus.length} cargos`} (${lista(seus.map((c) => c.title))}) com ${subordinados} subordinado(s) direto(s). A empresa depende dessa pessoa para quase tudo, o que trava o crescimento e a sucessão.`,
      });
    else if (seus.length >= 2)
      achados.push({
        chave,
        nivel: seus.length >= LIMITES.cargosPorPessoaCritico ? "critico" : "atencao",
        titulo: `Acúmulo de cargos: ${nome}`,
        texto: `${nome} ocupa ${seus.length} cargos (${lista(seus.map((c) => c.title))}). Funções acumuladas costumam ficar sem dedicação e sem cobrança clara.`,
      });
  }

  // 5. Liderança sem substituto preparado (ponto único de falha).
  const semSubstituto = cargos.filter((c) => c.holder_name && nDiretos(c) > 0 && !c.has_backup);
  if (semSubstituto.length)
    achados.push({
      chave: "organograma-lideranca-sem-substituto",
      nivel: semSubstituto.some((c) => topos.includes(c)) ? "critico" : "atencao",
      titulo: "Liderança sem substituto preparado",
      texto: `${lista(semSubstituto.map((c) => c.title))} ${semSubstituto.length === 1 ? "não tem" : "não têm"} substituto preparado. Uma ausência inesperada paralisa a área.`,
    });

  // 6. Familiares sem papel e critérios definidos.
  const familiares = cargos.filter((c) => c.is_family && c.holder_name && !c.defined_role);
  if (familiares.length)
    achados.push({
      chave: "organograma-familiares-sem-criterio",
      nivel: familiares.length >= 3 ? "critico" : "atencao",
      titulo: "Familiares sem papel e critérios definidos",
      texto: `${familiares.length === 1 ? "1 cargo ocupado" : `${familiares.length} cargos ocupados`} por familiares (${lista(familiares.map((c) => c.title))}) sem atribuições, critério de entrada e remuneração definidos. É uma das fontes mais comuns de conflito entre família e empresa.`,
    });

  // 7. Cargos vagos (liderança vaga é crítica).
  const vagos = cargos.filter((c) => !c.holder_name);
  const liderancaVaga = vagos.filter((c) => nDiretos(c) > 0);
  if (liderancaVaga.length)
    achados.push({
      chave: "organograma-lideranca-vaga",
      nivel: "critico",
      titulo: "Cargo de liderança vago",
      texto: `${lista(liderancaVaga.map((c) => c.title))} ${liderancaVaga.length === 1 ? "está vago e tem" : "estão vagos e têm"} pessoas subordinadas. Na prática, alguém decide sem ter o papel.`,
    });
  const outrosVagos = vagos.filter((c) => nDiretos(c) === 0);
  if (outrosVagos.length)
    achados.push({
      chave: "organograma-cargos-vagos",
      nivel: "atencao",
      titulo: "Cargos vagos",
      texto: `${lista(outrosVagos.map((c) => c.title))} ${outrosVagos.length === 1 ? "está vago" : "estão vagos"}.`,
    });

  // 8. Áreas: sem responsável ou com mais de um chefe.
  const areas = new Map<string, Cargo[]>();
  for (const c of cargos)
    if (c.area) {
      const k = normalizar(c.area);
      areas.set(k, [...(areas.get(k) ?? []), c]);
    }
  for (const [k, daArea] of areas) {
    const nome = daArea[0]!.area!;
    const chefes = daArea.filter((c) => {
      const pai = c.reports_to ? porId.get(c.reports_to) : undefined;
      return !pai || !pai.area || normalizar(pai.area) !== k;
    });
    const slug = k.replace(/[^a-z0-9]+/g, "-");
    if (chefes.length > 1)
      achados.push({
        chave: `organograma-area-varios-chefes-${slug}`,
        nivel: "atencao",
        titulo: `${nome}: mais de um responsável`,
        texto: `A área ${nome} tem ${chefes.length} cargos sem chefe dentro da própria área (${lista(chefes.map((c) => c.title))}). Não fica claro quem responde pelos resultados da área.`,
      });
    else if (chefes.length === 1 && !chefes[0]!.holder_name && daArea.length > 1)
      achados.push({
        chave: `organograma-area-sem-responsavel-${slug}`,
        nivel: "critico",
        titulo: `${nome}: área sem responsável`,
        texto: `O cargo que responde pela área ${nome} (${chefes[0]!.title}) está vago.`,
      });
  }

  // 9. Níveis demais.
  const niveis = profundidade(montarArvore(cargos));
  if (niveis >= LIMITES.niveisAtencao)
    achados.push({
      chave: "organograma-niveis",
      nivel: "atencao",
      titulo: "Muitos níveis hierárquicos",
      texto: `A estrutura tem ${niveis} níveis. Cada nível a mais deixa a informação e a decisão mais lentas.`,
    });

  const peso = { critico: 0, atencao: 1 } as const;
  return achados
    .map((a, i) => ({ a, i }))
    .sort((x, y) => peso[x.a.nivel] - peso[y.a.nivel] || x.i - y.i)
    .map((x) => x.a);
}

/** Números para a leitura rápida. */
export function resumoDoOrganograma(cargos: Cargo[]) {
  const arvore = montarArvore(cargos);
  const pessoas = new Set(
    cargos.filter((c) => c.holder_name).map((c) => normalizar(c.holder_name!)),
  );
  return {
    cargos: cargos.length,
    pessoas: pessoas.size,
    niveis: profundidade(arvore),
    familiares: cargos.filter((c) => c.is_family && c.holder_name).length,
    vagos: cargos.filter((c) => !c.holder_name).length,
  };
}

/** Contagem por nível de gravidade. */
export function placar(achados: AchadoOrganograma[]) {
  return {
    critico: achados.filter((a) => a.nivel === "critico").length,
    atencao: achados.filter((a) => a.nivel === "atencao").length,
  };
}
