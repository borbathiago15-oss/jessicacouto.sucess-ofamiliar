import type { Metadata } from "next";
import type { ReactNode } from "react";
import { meuAcesso, type Acesso } from "@/lib/auth/access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ShellAdmin, type GrupoMenu } from "./_components/shell";

export const metadata: Metadata = {
  title: "Administração",
  robots: { index: false, follow: false },
};

// Nunca pré-renderizar páginas do administrativo: tudo depende da sessão.
export const dynamic = "force-dynamic";

const PAPEIS: Record<string, string> = {
  admin: "Administradora",
  relationship: "Equipe de relacionamento",
  methodology_analyst: "Analista metodológico",
  executive_viewer: "Leitura executiva",
};

/** Menu por área, só com o que o papel da pessoa permite abrir. */
function menu(a: Acesso, alertas: number): GrupoMenu[] {
  const grupos: GrupoMenu[] = [
    {
      titulo: "Visão geral",
      itens: [{ href: "/admin", rotulo: "Painel", icone: "painel" }],
    },
    {
      titulo: "Relacionamento",
      itens: [
        a.pode("opportunities.read") && {
          href: "/admin/funil",
          rotulo: "Funil comercial",
          icone: "funil" as const,
        },
        a.pode("activities.read") && {
          href: "/admin/agenda",
          rotulo: "Agenda",
          icone: "agenda" as const,
        },
        (a.pode("diagnostics.read_answers") || a.pode("questionnaires.read")) && {
          href: "/admin/diagnostico",
          rotulo: "Diagnóstico de Sucessão",
          icone: "diagnostico" as const,
        },
        a.pode("proposals.read") && {
          href: "/admin/propostas",
          rotulo: "Propostas comerciais",
          icone: "propostas" as const,
        },
      ].filter(Boolean) as GrupoMenu["itens"],
    },
    {
      titulo: "Clientes",
      itens: [
        a.pode("organizations.read") && {
          href: "/admin/empresas",
          rotulo: "Empresas",
          icone: "empresas" as const,
        },
        a.pode("questionnaires.read") && {
          href: "/admin/questionarios",
          rotulo: "Questionários",
          icone: "questionarios" as const,
        },
        a.pode("portal.manage") && {
          href: "/admin/portal",
          rotulo: "Portal do cliente",
          icone: "portal" as const,
        },
        a.pode("reports.manage") && {
          href: "/admin/relatorios/configuracao",
          rotulo: "Configuração dos relatórios",
          icone: "relatorios" as const,
        },
      ].filter(Boolean) as GrupoMenu["itens"],
    },
    {
      titulo: "Site",
      itens: [
        a.pode("cms.read") && {
          href: "/admin/conteudo",
          rotulo: "Conteúdo do site",
          icone: "conteudo" as const,
        },
        a.pode("cms.read") && {
          href: "/admin/materiais",
          rotulo: "Guias e materiais",
          icone: "materiais" as const,
        },
      ].filter(Boolean) as GrupoMenu["itens"],
    },
    {
      titulo: "Administração",
      itens: [
        a.pode("users.read") && {
          href: "/admin/equipe",
          rotulo: "Equipe",
          icone: "equipe" as const,
        },
      ].filter(Boolean) as GrupoMenu["itens"],
    },
    {
      titulo: "Segurança",
      itens: [
        a.pode("vault.read") && {
          href: "/admin/seguranca",
          rotulo: "Segurança do cofre",
          icone: "seguranca" as const,
          aviso: alertas || undefined,
        },
      ].filter(Boolean) as GrupoMenu["itens"],
    },
  ];
  return grupos.filter((g) => g.itens.length > 0);
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const acesso = await meuAcesso();
  // Login, verificação em duas etapas e quem não tem papel na equipe: sem o menu.
  if (!acesso?.session_valid || !acesso.aal2 || !acesso.is_active || acesso.roles.length === 0)
    return children;

  const supabase = (await createSupabaseServerClient())!;
  const [perfil, usuario, alertas] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", acesso.user_id).maybeSingle(),
    supabase.auth.getUser(),
    acesso.pode("vault.read")
      ? supabase
          .from("security_alerts")
          .select("id", { count: "exact", head: true })
          .is("seen_at", null)
      : Promise.resolve({ count: 0 }),
  ]);
  const nome =
    perfil.data?.display_name?.trim() || usuario.data.user?.email?.split("@")[0] || "Equipe JC";
  const papel = acesso.roles.map((r) => PAPEIS[r] ?? r).join(", ");

  return (
    <ShellAdmin grupos={menu(acesso, alertas.count ?? 0)} nome={nome} papel={papel}>
      {children}
    </ShellAdmin>
  );
}
