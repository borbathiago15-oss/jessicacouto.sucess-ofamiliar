import Link from "next/link";
import { redirect } from "next/navigation";
import { Titulo } from "@/components/ui";
import { acessoPortal } from "./acesso";

export default async function PortalInicio() {
  const { empresas } = await acessoPortal();
  if (empresas.length === 1) redirect(`/portal/${empresas[0]!.id}`);

  return (
    <div className="grid gap-4">
      <Titulo>Suas empresas</Titulo>
      {empresas.length === 0 ? (
        <p className="text-mudo" data-testid="portal-sem-acesso">
          Sua conta ainda não tem acesso a nenhuma empresa. Fale com a Jéssica.
        </p>
      ) : (
        <ul className="border-linho m-0 grid list-none border-t p-0">
          {empresas.map((e) => (
            <li key={e.id} className="border-linho border-b py-4">
              <Link
                href={`/portal/${e.id}`}
                className="font-display text-cacau text-xl font-semibold no-underline hover:underline"
              >
                {e.trade_name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
