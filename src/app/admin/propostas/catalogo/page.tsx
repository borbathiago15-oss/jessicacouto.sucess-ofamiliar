import Link from "next/link";
import { redirect } from "next/navigation";
import { Cartao, Chamada, Titulo } from "@/components/ui";
import { meuAcesso } from "@/lib/auth/access";
import { enforceAdminRoute } from "@/lib/auth/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Configuracao, Etapa } from "./formularios";

export const metadata = { title: "Catálogo de propostas" };

export default async function CatalogoPage() {
  await enforceAdminRoute("/admin/propostas/catalogo");
  const acesso = await meuAcesso();
  if (!acesso?.session_valid) redirect("/admin/sair?motivo=sessao");
  if (!acesso.pode("proposals.catalog")) redirect("/admin/propostas");

  const supabase = (await createSupabaseServerClient())!;
  const [configR, etapasR] = await Promise.all([
    supabase
      .from("proposal_settings")
      .select("hourly_rate, validity_days, payment_terms, closing_notes")
      .maybeSingle(),
    supabase
      .from("proposal_services")
      .select("id, name, description, default_hours, is_active")
      .order("position"),
  ]);
  const c = configR.data;

  return (
    <main className="mx-auto grid max-w-4xl gap-8 px-6 py-14">
      <header className="grid gap-2">
        <Chamada>
          <Link href="/admin/propostas" className="text-terra-texto underline">
            Propostas comerciais
          </Link>
        </Chamada>
        <Titulo>Catálogo e condições padrão</Titulo>
        <p className="text-mudo max-w-[64ch]">
          Valores e etapas ficam só no banco de dados do sistema. Propostas em rascunho usam o
          valor-hora vigente; ao serem enviadas, os valores ficam congelados.
        </p>
      </header>

      <Cartao className="grid gap-4">
        <h2 className="font-display text-xl">Condições padrão</h2>
        <Configuracao
          inicial={{
            hourly_rate: Number(c?.hourly_rate ?? 0),
            validity_days: c?.validity_days ?? 15,
            payment_terms: c?.payment_terms ?? "",
            closing_notes: c?.closing_notes ?? "",
          }}
        />
      </Cartao>

      <section aria-labelledby="etapas" className="grid gap-4">
        <h2 id="etapas" className="font-display text-xl">
          Etapas do catálogo
        </h2>
        {(etapasR.data ?? []).length === 0 ? (
          <p className="text-mudo">Nenhuma etapa cadastrada.</p>
        ) : null}
        {(etapasR.data ?? []).map((e) => (
          <Cartao key={e.id}>
            <Etapa etapa={{ ...e, default_hours: Number(e.default_hours) }} />
          </Cartao>
        ))}
        <Cartao className="grid gap-3">
          <h3 className="font-display text-lg">Nova etapa</h3>
          <Etapa />
        </Cartao>
      </section>
    </main>
  );
}
