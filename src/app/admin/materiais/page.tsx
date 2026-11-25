import Link from "next/link";
import { redirect } from "next/navigation";
import { Cartao, Chamada, Selo, Titulo } from "@/components/ui";
import { meuAcesso } from "@/lib/auth/access";
import { enforceAdminRoute } from "@/lib/auth/guard";
import { umDe } from "@/lib/supabase/relacao";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NoSite, NovoMaterial, TrocarArquivo } from "./formularios";

export const metadata = { title: "Guias e materiais" };

const fuso = "America/Sao_Paulo";
const quando = (v: string) =>
  new Date(v).toLocaleString("pt-BR", { timeZone: fuso, dateStyle: "short", timeStyle: "short" });

export default async function MateriaisPage() {
  await enforceAdminRoute("/admin/materiais");
  const acesso = await meuAcesso();
  if (!acesso?.session_valid) redirect("/admin/sair?motivo=sessao");
  if (!acesso.pode("cms.read"))
    return (
      <main className="mx-auto grid max-w-3xl gap-4 px-6 py-16">
        <Titulo>Guias e materiais</Titulo>
        <p>Você não tem acesso aos materiais. Peça a uma administradora.</p>
      </main>
    );

  const supabase = (await createSupabaseServerClient())!;
  const [materiaisR, pedidosR] = await Promise.all([
    supabase
      .from("materials")
      .select("id, slug, title, description, file_name, is_active, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("material_downloads")
      .select("id, created_at, uses, materials(title), participants(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  const materiais = materiaisR.data ?? [];
  const pedidos = pedidosR.data ?? [];
  const podeEditar = acesso.pode("cms.update");
  const podeCriar = acesso.pode("cms.create");
  const podePublicar = acesso.pode("cms.publish");

  return (
    <main className="mx-auto grid max-w-5xl gap-10 px-6 py-14">
      <header className="grid gap-2">
        <Chamada>
          <Link href="/admin" className="text-terra-texto underline">
            Início
          </Link>
        </Chamada>
        <Titulo>Guias e materiais</Titulo>
        <p className="text-mudo max-w-[68ch]">
          Materiais gratuitos que o site entrega depois de um cadastro simples. Cada pedido entra no
          CRM com a pessoa, os consentimentos e uma atividade.{" "}
          <Link href="/guias" className="text-terra-texto underline">
            Ver a página Guias
          </Link>
        </p>
      </header>

      <section aria-labelledby="lista" className="grid gap-4">
        <h2 id="lista" className="font-display m-0 text-xl">
          Materiais
        </h2>
        {materiais.length === 0 ? (
          <p className="text-mudo m-0">Nenhum material ainda. Envie o primeiro PDF abaixo.</p>
        ) : (
          <ul className="m-0 grid list-none gap-4 p-0" data-testid="materiais-lista">
            {materiais.map((m) => (
              <li key={m.id as string}>
                <Cartao className="grid gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="grid gap-1">
                      <b className="font-display text-lg">{m.title as string}</b>
                      <span className="text-mudo text-[13px]">
                        {(m.file_name as string) ?? "sem arquivo"} · criado em{" "}
                        {quando(m.created_at as string)}
                      </span>
                    </div>
                    <Selo tom={m.is_active ? "ok" : "neutro"}>
                      {m.is_active ? "No site" : "Fora do site"}
                    </Selo>
                  </div>
                  {m.description ? (
                    <p className="m-0 text-[14px]">{m.description as string}</p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    {podePublicar ? <NoSite id={m.id as string} ativo={!!m.is_active} /> : null}
                    {podeEditar ? (
                      <TrocarArquivo id={m.id as string} titulo={m.title as string} />
                    ) : null}
                  </div>
                </Cartao>
              </li>
            ))}
          </ul>
        )}
      </section>

      {podeCriar && podeEditar ? (
        <section aria-labelledby="novo" className="grid gap-4">
          <h2 id="novo" className="font-display m-0 text-xl">
            Novo material
          </h2>
          <Cartao>
            <NovoMaterial />
          </Cartao>
        </section>
      ) : null}

      <section aria-labelledby="pedidos" className="grid gap-4">
        <h2 id="pedidos" className="font-display m-0 text-xl">
          Pedidos recentes
        </h2>
        {pedidos.length === 0 ? (
          <p className="text-mudo m-0">Nenhum pedido ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]" data-testid="materiais-pedidos">
              <thead>
                <tr className="border-linho text-mudo border-b text-left text-[13px]">
                  <th className="py-2 pr-4 font-semibold">Pessoa</th>
                  <th className="py-2 pr-4 font-semibold">Material</th>
                  <th className="py-2 pr-4 font-semibold">Quando</th>
                  <th className="py-2 font-semibold">Downloads</th>
                </tr>
              </thead>
              <tbody>
                {pedidos.map((p) => {
                  const pessoa = umDe(p.participants);
                  const material = umDe(p.materials);
                  return (
                    <tr key={p.id as string} className="border-linho border-b">
                      <td className="py-2 pr-4">
                        <b>{(pessoa?.full_name as string) ?? "Pessoa removida"}</b>
                        <br />
                        <span className="text-mudo text-[13px]">{pessoa?.email as string}</span>
                      </td>
                      <td className="py-2 pr-4">{(material?.title as string) ?? "—"}</td>
                      <td className="py-2 pr-4">{quando(p.created_at as string)}</td>
                      <td className="py-2">{p.uses as number}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
