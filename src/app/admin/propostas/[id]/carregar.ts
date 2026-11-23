import "server-only";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { meuAcesso } from "@/lib/auth/access";
import { enforceAdminRoute } from "@/lib/auth/guard";
import { umDe } from "@/lib/supabase/relacao";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StatusProposta } from "@/modules/propostas/calculo";

/** Guarda comum das telas de proposta: sessão, MFA, permissão e acesso à empresa. */
export async function carregarProposta(id: string, caminho: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  await enforceAdminRoute(caminho);
  const acesso = await meuAcesso();
  if (!acesso?.session_valid) redirect("/admin/sair?motivo=sessao");
  if (!acesso.pode("proposals.read")) redirect("/admin/propostas");

  const supabase = (await createSupabaseServerClient())!;
  const { data: p } = await supabase
    .from("proposals")
    .select(
      "id, number, title, status, organization_id, opportunity_id, hourly_rate, complexity_factor, discount_pct, installments, validity_days, intro, payment_terms, closing_notes, show_hours, client_logo_path, total_hours, total_value, sent_at, valid_until, decided_at, decision_reason, updated_at, created_at, organizations(trade_name, legal_name), proposal_items(service_id, name, description, hours, position)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();

  const itens = [...(p.proposal_items ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((i) => ({
      service_id: i.service_id as string | null,
      name: i.name as string,
      description: i.description as string | null,
      hours: Number(i.hours),
    }));
  const empresa = umDe(p.organizations);
  return {
    acesso,
    supabase,
    proposta: {
      ...p,
      status: p.status as StatusProposta,
      hourly_rate: Number(p.hourly_rate),
      complexity_factor: Number(p.complexity_factor),
      discount_pct: Number(p.discount_pct),
      total_hours: p.total_hours === null ? null : Number(p.total_hours),
      total_value: p.total_value === null ? null : Number(p.total_value),
      empresa: (empresa?.legal_name as string | null) || (empresa?.trade_name as string) || "",
      nomeFantasia: (empresa?.trade_name as string) ?? "",
      itens,
    },
  };
}
