import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Administração",
  robots: { index: false, follow: false },
};

/**
 * Placeholder do ambiente administrativo (/admin).
 * Autenticação, MFA e permissões serão implementadas no M1.
 */
export default function AdminPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-4 px-6 py-24">
      <h1 className="font-display text-burgundy text-3xl">Ambiente administrativo</h1>
      <p>Acesso restrito. Disponível após a implementação da autenticação.</p>
    </main>
  );
}
