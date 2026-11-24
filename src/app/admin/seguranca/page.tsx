import Link from "next/link";
import { redirect } from "next/navigation";
import { Cartao, Chamada, Selo, Titulo } from "@/components/ui";
import { meuAcesso } from "@/lib/auth/access";
import { enforceAdminRoute } from "@/lib/auth/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AlertasAbertos, PrazoDeGuarda } from "./controles";

export const metadata = { title: "Segurança do cofre" };

const dataHora = (v: string) =>
  new Date(v).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });

type Acesso = {
  at: string;
  email: string;
  file_name: string;
  empresa: string;
  pelo_portal: boolean;
};

export default async function SegurancaPage() {
  await enforceAdminRoute("/admin/seguranca");
  const acesso = await meuAcesso();
  if (!acesso?.session_valid) redirect("/admin/sair?motivo=sessao");
  if (!acesso.pode("vault.read")) redirect("/admin");

  const supabase = (await createSupabaseServerClient())!;
  const [{ data: alertas }, { data: relatorio }, { data: ajustes }] = await Promise.all([
    supabase
      .from("security_alerts")
      .select("id, detail, created_at")
      .is("seen_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.rpc("security_access_report", { p_days: 7 }),
    supabase.from("vault_settings").select("retention_days").maybeSingle(),
  ]);
  const acessos = (relatorio ?? []) as Acesso[];

  return (
    <main className="mx-auto grid max-w-4xl gap-8 px-6 py-14">
      <header className="grid gap-2">
        <Chamada>
          <Link href="/admin" className="text-terra-texto underline">
            Ambiente administrativo
          </Link>
        </Chamada>
        <Titulo>Segurança do cofre</Titulo>
        <p className="text-mudo max-w-[64ch]">
          Os arquivos do cofre ficam criptografados com uma chave guardada fora do banco. Aqui
          aparecem os sinais de alerta, quem abriu o quê e o prazo de guarda dos documentos enviados
          pelos clientes.
        </p>
      </header>

      <section aria-labelledby="alertas" className="grid gap-3">
        <h2 id="alertas" className="font-display text-xl">
          Alertas em aberto
        </h2>
        <AlertasAbertos
          alertas={(alertas ?? []).map((a) => ({
            id: a.id,
            detail: a.detail,
            quando: dataHora(a.created_at),
          }))}
        />
      </section>

      <section aria-labelledby="acessos" className="grid gap-3">
        <h2 id="acessos" className="font-display text-xl">
          Quem abriu o quê nos últimos 7 dias
        </h2>
        {acessos.length === 0 ? (
          <p className="text-mudo m-0">Nenhum documento aberto nos últimos 7 dias.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]" data-testid="acessos">
              <thead className="text-mudo text-[12.5px]">
                <tr className="border-linho border-b">
                  {["Quando", "Quem", "Documento", "Empresa"].map((c) => (
                    <th key={c} scope="col" className="py-1.5 pr-3 text-left font-semibold">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {acessos.map((a, i) => (
                  <tr key={i} className="border-linho border-b align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{dataHora(a.at)}</td>
                    <td className="py-2 pr-3">
                      {a.email} {a.pelo_portal ? <Selo tom="marca">cliente</Selo> : null}
                    </td>
                    <td className="py-2 pr-3">{a.file_name}</td>
                    <td className="py-2 pr-3">{a.empresa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Cartao className="grid gap-3">
        <h2 className="font-display text-xl">Prazo de guarda</h2>
        <p className="text-mudo m-0 text-sm">
          Documentos enviados pelos clientes vencem este número de dias depois que o pedido é
          marcado como recebido. Os vencidos aparecem no cofre de cada empresa para exclusão
          definitiva. Documento que não existe mais não vaza.
        </p>
        <PrazoDeGuarda
          dias={ajustes?.retention_days ?? 90}
          podeMudar={acesso.pode("vault.delete")}
        />
      </Cartao>
    </main>
  );
}
