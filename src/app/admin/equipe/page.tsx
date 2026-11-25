import { redirect } from "next/navigation";
import { Cartao, Selo, Titulo } from "@/components/ui";
import { meuAcesso } from "@/lib/auth/access";
import { enforceAdminRoute } from "@/lib/auth/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AcoesPessoa, ConvidarPessoa, ROTULO_PAPEL } from "./formularios";

export const metadata = { title: "Equipe" };

const quando = (v: string | null) =>
  v
    ? new Date(v).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Ainda não acessou";

type Pessoa = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  is_active: boolean;
  roles: string[];
  last_sign_in_at: string | null;
  has_mfa: boolean;
};

export default async function EquipePage() {
  await enforceAdminRoute("/admin/equipe");
  const acesso = await meuAcesso();
  if (!acesso?.session_valid) redirect("/admin/sair?motivo=sessao");
  if (!acesso.pode("users.read"))
    return (
      <main className="mx-auto grid max-w-3xl gap-4 px-6 py-16">
        <Titulo>Equipe</Titulo>
        <p>Você não tem acesso à equipe. Peça a uma administradora.</p>
      </main>
    );

  const supabase = (await createSupabaseServerClient())!;
  const { data } = await supabase.rpc("admin_list_team");
  const equipe = (data ?? []) as Pessoa[];
  const podeGerenciar = acesso.pode("users.manage");

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-5 py-8 sm:px-8 lg:py-10">
      <header className="grid gap-1">
        <p className="text-terra-texto m-0 text-[13.5px] font-semibold">Administração</p>
        <Titulo>Equipe</Titulo>
        <p className="text-mudo m-0 max-w-[68ch]">
          Quem acessa a área da JC e o que cada papel pode fazer. Todo acesso exige verificação em
          duas etapas. Clientes entram pelo portal e são liberados na página de cada empresa.
        </p>
      </header>

      {podeGerenciar ? (
        <Cartao className="grid gap-3">
          <h2 className="font-display m-0 text-xl">Convidar para a equipe</h2>
          <p className="text-mudo m-0 text-[14px]">
            A pessoa recebe um e-mail para criar a senha e, no primeiro acesso, cadastra a
            verificação em duas etapas.
          </p>
          <ConvidarPessoa />
        </Cartao>
      ) : null}

      <section aria-labelledby="pessoas" className="grid gap-3">
        <h2 id="pessoas" className="font-display m-0 text-xl">
          Pessoas ({equipe.length})
        </h2>
        <ul className="m-0 grid list-none gap-3 p-0" data-testid="equipe-lista">
          {equipe.map((p) => (
            <li key={p.user_id}>
              <Cartao className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
                <div className="grid gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="font-display text-lg">{p.display_name || p.email}</b>
                    {p.user_id === acesso.user_id ? <Selo tom="marca">Você</Selo> : null}
                    {!p.is_active ? <Selo tom="critico">Desativada</Selo> : null}
                  </div>
                  <span className="text-mudo text-[13.5px]">{p.email}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {p.roles.length ? (
                      p.roles.map((r) => (
                        <span
                          key={r}
                          className="bg-blush text-terra-texto rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold"
                        >
                          {ROTULO_PAPEL[r] ?? r}
                        </span>
                      ))
                    ) : (
                      <span className="text-atencao text-[13px]">Sem papel: não acessa a área</span>
                    )}
                  </div>
                  <span className="text-mudo text-[12.5px]">
                    Último acesso: {quando(p.last_sign_in_at)} ·{" "}
                    {p.has_mfa ? "duas etapas ativa" : "duas etapas pendente"}
                  </span>
                </div>
                {podeGerenciar ? (
                  <AcoesPessoa
                    userId={p.user_id}
                    papeis={p.roles}
                    ativo={p.is_active}
                    ehVoce={p.user_id === acesso.user_id}
                  />
                ) : null}
              </Cartao>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
