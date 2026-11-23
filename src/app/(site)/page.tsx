import { Chamada, FioContinuidade, Monograma } from "@/components/ui";

/**
 * Placeholder neutro. Os conteúdos institucionais definitivos serão
 * administrados pelo CMS no Supabase (decisão v0.5) e não ficam no repositório.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-6 px-6 py-24">
      <div className="flex items-center gap-3">
        <Monograma />
        <Chamada>JC | Sucessão de Sucesso</Chamada>
      </div>
      <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-none font-medium tracking-[-0.02em]">
        Site em construção
      </h1>
      <FioContinuidade />
    </main>
  );
}
