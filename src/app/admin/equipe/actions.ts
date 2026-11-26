"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { meuAcesso } from "@/lib/auth/access";
import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Aviso = { ok: boolean; mensagem: string; link?: string } | null;
const uuid = z.uuid();
const PAPEIS = ["admin", "relationship", "methodology_analyst", "executive_viewer"] as const;

async function cliente() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
}

function erro(e: { code?: string; message?: string }, padrao: string): Aviso {
  if (e.code === "42501")
    return { ok: false, mensagem: e.message || "Sem permissão para esta ação." };
  if ((e.code === "22023" || e.code === "P0002") && e.message)
    return { ok: false, mensagem: e.message };
  return { ok: false, mensagem: padrao };
}

/**
 * Convida alguém para a equipe: cria a conta pelo convite do Supabase (se ainda não
 * existe), define o nome e atribui o papel. A chave de serviço só convida, acha a
 * conta pelo e-mail e grava o nome; o papel é gravado com a sessão de quem convida,
 * então o banco confere users.manage.
 */
export async function convidarPessoa(_: Aviso, form: FormData): Promise<Aviso> {
  const dados = z
    .object({
      nome: z.string().trim().min(2, "Informe o nome.").max(120),
      email: z.email("Informe um e-mail válido.").max(254),
      papel: z.enum(PAPEIS, "Escolha o papel."),
    })
    .safeParse({
      nome: form.get("nome"),
      email: String(form.get("email") ?? "")
        .trim()
        .toLowerCase(),
      papel: form.get("papel"),
    });
  if (!dados.success) return { ok: false, mensagem: dados.error.issues[0]!.message };

  const acesso = await meuAcesso();
  if (!acesso?.pode("users.manage"))
    return { ok: false, mensagem: "Sem permissão para esta ação." };
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const chave = serverEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave)
    return { ok: false, mensagem: "Convites indisponíveis neste ambiente (use o site principal)." };
  const servico = createClient(url, chave, { auth: { persistSession: false } });

  const porLink = form.get("modo") === "link";
  let { data: userId } = await servico.rpc("auth_user_id_by_email", { p_email: dados.data.email });
  let convidado = false;
  let link: string | undefined;
  if (porLink) {
    // Link para você enviar (WhatsApp, e-mail próprio): nenhum e-mail sai do Supabase.
    // Só conta nova recebe link. Para conta que já existe, nunca devolvemos um link de
    // senha: quem convida poderia usá-lo para entrar no lugar da outra pessoa.
    if (!userId) {
      const gerado = await servico.auth.admin.generateLink({
        type: "invite",
        email: dados.data.email,
      });
      const hash = gerado.data?.properties?.hashed_token;
      if (gerado.error || !hash || !gerado.data.user)
        return { ok: false, mensagem: "Não foi possível gerar o link de convite." };
      userId = gerado.data.user.id;
      convidado = true;
      const destino = new URL("/admin/convite", publicEnv.NEXT_PUBLIC_SITE_URL);
      destino.searchParams.set("t", hash);
      destino.searchParams.set("tipo", "invite");
      link = destino.toString();
    }
  } else if (!userId) {
    const retorno = new URL("/admin/auth/callback", publicEnv.NEXT_PUBLIC_SITE_URL);
    retorno.searchParams.set("next", "/admin/redefinir-senha");
    const convite = await servico.auth.admin.inviteUserByEmail(dados.data.email, {
      redirectTo: retorno.toString(),
    });
    if (convite.error || !convite.data.user)
      return {
        ok: false,
        mensagem:
          "Não foi possível enviar o convite por e-mail (o Supabase limita os envios por hora). Use “Gerar link de convite”.",
      };
    userId = convite.data.user.id;
    convidado = true;
  }

  const supabase = await cliente();
  const nome = await supabase.rpc("admin_set_display_name", {
    p_user_id: userId as string,
    p_name: dados.data.nome,
  });
  if (nome.error) return erro(nome.error, "Conta criada, mas o nome não foi salvo.");
  const papel = await supabase
    .from("user_roles")
    .upsert(
      { user_id: userId as string, role_key: dados.data.papel, granted_by: acesso.user_id },
      { onConflict: "user_id,role_key", ignoreDuplicates: true },
    );
  if (papel.error) return erro(papel.error, "Conta criada, mas o papel não foi atribuído.");
  revalidatePath("/admin/equipe");
  if (link)
    return {
      ok: true,
      link,
      mensagem:
        "Link de convite pronto. Copie e envie para a pessoa: ela cria a senha e a verificação em duas etapas.",
    };
  return {
    ok: true,
    mensagem: convidado
      ? "Convite enviado por e-mail. A pessoa define a senha e a verificação em duas etapas no primeiro acesso."
      : "Esta conta já existia: o papel foi atribuído. Se a pessoa precisar de nova senha, ela usa “Esqueci minha senha” na tela de entrada.",
  };
}

export async function alterarPapel(userId: string, papel: string, dar: boolean): Promise<Aviso> {
  if (!uuid.safeParse(userId).success || !(PAPEIS as readonly string[]).includes(papel))
    return { ok: false, mensagem: "Inválido." };
  const acesso = await meuAcesso();
  if (!acesso?.pode("users.manage"))
    return { ok: false, mensagem: "Sem permissão para esta ação." };
  if (!dar && papel === "admin" && userId === acesso.user_id)
    return { ok: false, mensagem: "Você não pode retirar o seu próprio papel de administradora." };
  const supabase = await cliente();
  const { error } = dar
    ? await supabase
        .from("user_roles")
        .upsert(
          { user_id: userId, role_key: papel, granted_by: acesso.user_id },
          { onConflict: "user_id,role_key", ignoreDuplicates: true },
        )
    : await supabase.from("user_roles").delete().eq("user_id", userId).eq("role_key", papel);
  if (error) return erro(error, "Não foi possível alterar o papel.");
  revalidatePath("/admin/equipe");
  return { ok: true, mensagem: dar ? "Papel atribuído." : "Papel retirado." };
}

export async function definirAtivo(userId: string, ativo: boolean): Promise<Aviso> {
  if (!uuid.safeParse(userId).success) return { ok: false, mensagem: "Inválido." };
  const supabase = await cliente();
  const { error } = await supabase.rpc("admin_set_user_active", {
    p_user_id: userId,
    p_active: ativo,
  });
  if (error) return erro(error, "Não foi possível alterar.");
  revalidatePath("/admin/equipe");
  return {
    ok: true,
    mensagem: ativo ? "Conta reativada." : "Conta desativada e sessões encerradas.",
  };
}

export async function redefinirMfa(userId: string): Promise<Aviso> {
  if (!uuid.safeParse(userId).success) return { ok: false, mensagem: "Inválido." };
  const supabase = await cliente();
  const { error } = await supabase.rpc("admin_reset_user_mfa", { p_user_id: userId });
  if (error) return erro(error, "Não foi possível redefinir.");
  revalidatePath("/admin/equipe");
  return {
    ok: true,
    mensagem: "Verificação em duas etapas redefinida. No próximo acesso a pessoa cadastra de novo.",
  };
}
