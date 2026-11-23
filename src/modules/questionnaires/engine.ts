import { temAlternativas, type Definicao, type Pergunta } from "./schema";

/**
 * Motor de aplicação de questionários (puro, sem acesso a banco).
 * Resposta: rótulo da alternativa (escolha única/escala), lista de rótulos
 * (múltipla escolha) ou texto livre.
 */
export type Resposta = string | string[];
export type Respostas = Record<string, Resposta | undefined>;

function selecionadas(r: Resposta | undefined): string[] {
  if (r === undefined) return [];
  return Array.isArray(r) ? r : [r];
}

function respondida(r: Resposta | undefined): boolean {
  return Array.isArray(r) ? r.length > 0 : typeof r === "string" && r.trim().length > 0;
}

/**
 * Perguntas visíveis, na ordem. Uma pergunta condicionada só aparece se a
 * pergunta de que depende estiver visível e com uma das alternativas indicadas.
 */
export function perguntasVisiveis(def: Definicao, respostas: Respostas): Pergunta[] {
  const visiveis = new Set<string>();
  const resultado: Pergunta[] = [];
  for (const q of def.questions) {
    const c = q.condition;
    const aparece =
      !c ||
      (visiveis.has(c.question) &&
        selecionadas(respostas[c.question]).some((s) => c.any_of.includes(s)));
    if (aparece) {
      visiveis.add(q.key);
      resultado.push(q);
    }
  }
  return resultado;
}

/** Remove respostas de perguntas ocultas ou inexistentes (nunca são gravadas). */
export function limparRespostas(def: Definicao, respostas: Respostas): Respostas {
  const limpas: Respostas = {};
  for (const q of perguntasVisiveis(def, respostas)) {
    const r = respostas[q.key];
    if (respondida(r)) limpas[q.key] = r;
  }
  return limpas;
}

/** Erro de uma resposta isolada, ou null se estiver válida. */
export function erroDaResposta(q: Pergunta, r: Resposta | undefined): string | null {
  if (!respondida(r)) return q.is_required ? "Resposta obrigatória." : null;
  if (temAlternativas(q.kind)) {
    const validas = new Set(q.options.map((o) => o.label));
    const escolhidas = selecionadas(r);
    if (q.kind !== "multiple_choice" && (Array.isArray(r) || escolhidas.length !== 1))
      return "Escolha uma alternativa.";
    if (q.kind === "multiple_choice" && !Array.isArray(r)) return "Resposta inválida.";
    if (escolhidas.some((e) => !validas.has(e))) return "Alternativa inexistente.";
    if (new Set(escolhidas).size !== escolhidas.length) return "Alternativa repetida.";
    const naoSeAplica = q.options.filter((o) => o.is_not_applicable).map((o) => o.label);
    if (escolhidas.length > 1 && escolhidas.some((e) => naoSeAplica.includes(e)))
      return "“Não se aplica” não combina com outras alternativas.";
    return null;
  }
  if (Array.isArray(r)) return "Resposta inválida.";
  const limite = q.kind === "short_text" ? 300 : 5000;
  return r!.length > limite ? `Use até ${limite} caracteres.` : null;
}

/** Valida todas as perguntas visíveis. Retorna erros por chave de pergunta. */
export function validarRespostas(def: Definicao, respostas: Respostas): Record<string, string> {
  const erros: Record<string, string> = {};
  for (const q of perguntasVisiveis(def, respostas)) {
    const e = erroDaResposta(q, respostas[q.key]);
    if (e) erros[q.key] = e;
  }
  return erros;
}

/** Progresso sobre as perguntas visíveis (0–1). */
export function progresso(def: Definicao, respostas: Respostas) {
  const visiveis = perguntasVisiveis(def, respostas);
  const feitas = visiveis.filter((q) => respondida(respostas[q.key])).length;
  return {
    respondidas: feitas,
    total: visiveis.length,
    fracao: visiveis.length ? feitas / visiveis.length : 0,
  };
}
