/** Relação "muitos-para-um" do PostgREST: sem tipos gerados, vem tipada como lista. */
export function umDe<T>(relacao: T | T[] | null | undefined): T | undefined {
  return Array.isArray(relacao) ? relacao[0] : (relacao ?? undefined);
}
