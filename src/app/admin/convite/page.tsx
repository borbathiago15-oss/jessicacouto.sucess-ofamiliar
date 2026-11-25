import Link from "next/link";
import { botaoClasses, Monograma, Titulo } from "@/components/ui";
import { ADMIN_AUTH_CALLBACK, ADMIN_LOGIN, ADMIN_PASSWORD_RESET } from "@/lib/auth/admin-routes";

export const metadata = { title: "Convite", robots: { index: false, follow: false } };

const TIPOS = { invite: "invite", recovery: "recovery" } as const;

/**
 * Destino do link de convite gerado na Equipe. Abrir a página não usa o convite
 * (aplicativos de mensagem abrem links para montar a prévia); o convite só é
 * aceito no clique do botão, que segue para o retorno de autenticação.
 */
export default async function ConvitePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; tipo?: string }>;
}) {
  const { t, tipo } = await searchParams;
  const tipoValido = tipo && tipo in TIPOS ? TIPOS[tipo as keyof typeof TIPOS] : null;
  const valido = !!t && /^[A-Za-z0-9_-]{20,200}$/.test(t) && !!tipoValido;

  const destino = valido
    ? `${ADMIN_AUTH_CALLBACK}?${new URLSearchParams({
        token_hash: t!,
        type: tipoValido!,
        next: ADMIN_PASSWORD_RESET,
      }).toString()}`
    : null;

  return (
    <main className="bg-porcelana grid min-h-dvh place-items-center px-6 py-16">
      <div className="bg-papel border-linho grid w-full max-w-md gap-5 rounded-[28px] border p-8 text-center">
        <span className="mx-auto">
          <Monograma tamanho={52} />
        </span>
        {valido ? (
          <>
            <Titulo>Você recebeu um convite para a área da JC</Titulo>
            <p className="text-mudo m-0">
              Ao continuar, você cria a sua senha e, em seguida, cadastra a verificação em duas
              etapas no aplicativo autenticador do celular.
            </p>
            {/* Âncora comum (sem pré-carregamento): o convite só é usado no clique. */}
            <a href={destino!} className={botaoClasses()}>
              Aceitar convite e criar senha
            </a>
            <p className="text-mudo m-0 text-[13px]">
              O convite vale por tempo limitado e só pode ser usado uma vez.
            </p>
          </>
        ) : (
          <>
            <Titulo>Convite inválido</Titulo>
            <p className="text-mudo m-0">
              Este link está incompleto. Peça um novo convite a quem administra a equipe.
            </p>
          </>
        )}
        <Link href={ADMIN_LOGIN} className="text-terra-texto text-[14px] underline">
          Já tenho acesso: entrar
        </Link>
      </div>
    </main>
  );
}
