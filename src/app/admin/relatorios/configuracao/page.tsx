import Link from "next/link";
import { redirect } from "next/navigation";
import { Cartao, Chamada, Titulo } from "@/components/ui";
import { meuAcesso } from "@/lib/auth/access";
import { enforceAdminRoute } from "@/lib/auth/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FormularioConfiguracao } from "./formulario";

export const metadata = { title: "Configuração dos relatórios" };

export default async function ConfiguracaoRelatoriosPage() {
  await enforceAdminRoute("/admin/relatorios/configuracao");
  const acesso = await meuAcesso();
  if (!acesso?.session_valid) redirect("/admin/sair?motivo=sessao");
  if (!acesso.pode("reports.manage")) redirect("/admin");

  const supabase = (await createSupabaseServerClient())!;
  const { data } = await supabase
    .from("report_settings")
    .select("consultant_name, consultant_title, credentials, methodology, limitations")
    .maybeSingle();

  return (
    <main className="mx-auto grid max-w-3xl gap-8 px-6 py-14">
      <header className="grid gap-2">
        <Chamada>
          <Link href="/admin" className="text-terra-texto underline">
            Ambiente administrativo
          </Link>
        </Chamada>
        <Titulo>Configuração dos relatórios</Titulo>
        <p className="text-mudo max-w-[62ch]">
          Assinatura, credenciais e metodologia que aparecem em todos os Relatórios Executivos. É o
          que mostra ao cliente quem fez o trabalho e como.
        </p>
      </header>
      <Cartao>
        <FormularioConfiguracao
          inicial={{
            consultant_name: data?.consultant_name ?? "",
            consultant_title: data?.consultant_title ?? "",
            credentials: data?.credentials ?? "",
            methodology: data?.methodology ?? "",
            limitations: data?.limitations ?? "",
          }}
        />
      </Cartao>
    </main>
  );
}
