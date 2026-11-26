import Link from "next/link";
import { Monograma, Titulo } from "@/components/ui";

export const metadata = { title: "Página não encontrada" };

export default function NaoEncontrada() {
  return (
    <main className="mx-auto grid min-h-[70vh] max-w-xl content-center gap-5 px-6 py-16">
      <Monograma />
      <Titulo>Não encontramos esta página</Titulo>
      <p className="m-0">O endereço pode ter mudado, ou você não tem acesso a este conteúdo.</p>
      <p className="m-0">
        <Link href="/" className="text-terra-texto font-semibold underline">
          Voltar ao início
        </Link>
      </p>
    </main>
  );
}
