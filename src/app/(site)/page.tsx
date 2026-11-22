/**
 * Placeholder neutro. Os conteúdos institucionais definitivos serão
 * administrados pelo CMS no Supabase (decisão v0.5) e não ficam no repositório.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-6 px-6 py-24">
      <p className="text-sm tracking-[0.2em] text-burgundy uppercase">JC | Sucessão de Sucesso</p>
      <h1 className="font-display text-4xl leading-tight text-burgundy sm:text-5xl">
        Site em construção
      </h1>
      <svg
        aria-hidden="true"
        viewBox="0 0 600 40"
        className="h-10 w-full text-gold"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
      >
        <path d="M0 30 C 150 30, 150 10, 300 10 S 450 30, 600 10" />
      </svg>
    </main>
  );
}
