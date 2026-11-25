import { analisarOrganograma, placar } from "./analise";
import { normalizar, type Cargo } from "./schema";

/**
 * Comparação entre a estrutura atual e a proposta JC. Os cargos são pareados pelo
 * nome (sem acento e sem caixa); nomes repetidos são pareados na ordem.
 */

export type Mudanca = {
  cargo: string;
  /** Frases curtas do que muda ("Ocupante: Ana → Bruno"). */
  itens: string[];
  justificativa: string | null;
};

export type Comparacao = {
  novos: { cargo: string; justificativa: string | null }[];
  extintos: string[];
  alterados: Mudanca[];
  mantidos: number;
  antes: { critico: number; atencao: number };
  depois: { critico: number; atencao: number };
  /** Achados da estrutura atual que não aparecem mais na proposta. */
  resolvidos: string[];
  /** Achados que só aparecem na proposta. */
  novosPontos: string[];
};

const vago = (v: string | null) => v ?? "vago";

export function compararEstruturas(atual: Cargo[], proposta: Cargo[]): Comparacao {
  const tituloAtual = new Map(atual.map((c) => [c.id, c.title]));
  const tituloProposta = new Map(proposta.map((c) => [c.id, c.title]));
  const superior = (c: Cargo, mapa: Map<string, string>) =>
    c.reports_to ? (mapa.get(c.reports_to) ?? null) : null;

  const livres = new Map<string, Cargo[]>();
  for (const c of atual) {
    const k = normalizar(c.title);
    livres.set(k, [...(livres.get(k) ?? []), c]);
  }

  const novos: Comparacao["novos"] = [];
  const alterados: Mudanca[] = [];
  let mantidos = 0;
  for (const p of proposta) {
    const fila = livres.get(normalizar(p.title));
    const a = fila?.shift();
    if (!a) {
      novos.push({ cargo: p.title, justificativa: p.change_note });
      continue;
    }
    const itens: string[] = [];
    if (normalizar(a.holder_name ?? "") !== normalizar(p.holder_name ?? ""))
      itens.push(`Ocupante: ${vago(a.holder_name)} → ${vago(p.holder_name)}`);
    const supA = superior(a, tituloAtual);
    const supP = superior(p, tituloProposta);
    if (normalizar(supA ?? "") !== normalizar(supP ?? ""))
      itens.push(
        supP
          ? `Passa a responder a ${supP}${supA ? ` (antes, ${supA})` : ""}`
          : `Passa a ser topo da estrutura${supA ? ` (antes respondia a ${supA})` : ""}`,
      );
    const duploA = a.also_reports_to ? tituloAtual.get(a.also_reports_to) : undefined;
    const duploP = p.also_reports_to ? tituloProposta.get(p.also_reports_to) : undefined;
    if (duploA && !duploP) itens.push(`Deixa de responder também a ${duploA}`);
    if (duploP && normalizar(duploP) !== normalizar(duploA ?? ""))
      itens.push(`Responde também a ${duploP}`);
    if (normalizar(a.area ?? "") !== normalizar(p.area ?? ""))
      itens.push(`Área: ${a.area ?? "sem área"} → ${p.area ?? "sem área"}`);
    if (!a.defined_role && p.defined_role) itens.push("Papel e critérios passam a ser definidos");
    if (!a.has_backup && p.has_backup) itens.push("Passa a ter substituto preparado");
    if (itens.length || p.change_note)
      alterados.push({ cargo: p.title, itens, justificativa: p.change_note });
    else mantidos++;
  }
  const extintos = [...livres.values()].flat().map((c) => c.title);

  const achadosA = analisarOrganograma(atual);
  const achadosP = analisarOrganograma(proposta);
  const titulosP = new Set(achadosP.map((a) => a.titulo));
  const titulosA = new Set(achadosA.map((a) => a.titulo));
  return {
    novos,
    extintos,
    alterados,
    mantidos,
    antes: placar(achadosA),
    depois: placar(achadosP),
    resolvidos: achadosA.filter((a) => !titulosP.has(a.titulo)).map((a) => a.titulo),
    novosPontos: achadosP.filter((a) => !titulosA.has(a.titulo)).map((a) => a.titulo),
  };
}
