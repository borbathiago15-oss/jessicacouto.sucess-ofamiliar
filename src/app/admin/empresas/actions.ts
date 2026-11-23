"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { arquivoOfflineSchema, periodoSchema, periodosDoArquivo } from "@/modules/raiox/calculo";
import { CATEGORIAS_COFRE, LIMITE_COFRE, TIPOS_COFRE } from "@/modules/cofre/tipos";

export type Aviso = { ok: boolean; mensagem: string } | null;

const uuid = z.uuid();

async function cliente() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
}

function mensagemDoBanco(error: { code?: string; message?: string }, padrao: string): string {
  if (error.code === "42501") return "Sem permissão para esta ação.";
  if (error.code === "23505") return "Já existe um registro com esse nome.";
  if ((error.code === "22023" || error.code === "55000") && error.message) return error.message;
  return padrao;
}

// ---------------------------------------------------------------------------
// Empresas
// ---------------------------------------------------------------------------
const empresaSchema = z.object({
  trade_name: z.string().trim().min(1, "Informe o nome da empresa.").max(200),
  segment: z
    .string()
    .trim()
    .max(120)
    .transform((v) => v || null),
});

export async function criarEmpresa(_: Aviso, form: FormData): Promise<Aviso> {
  const dados = empresaSchema.safeParse({
    trade_name: form.get("trade_name"),
    segment: form.get("segment") ?? "",
  });
  if (!dados.success) return { ok: false, mensagem: dados.error.issues[0]!.message };
  const supabase = await cliente();
  const { data: usuario } = await supabase.auth.getUser();
  // Id gerado aqui: pedir a linha de volta no mesmo INSERT esbarra na política de
  // leitura, que ainda não enxerga a empresa recém-criada.
  const id = randomUUID();
  const { error } = await supabase
    .from("organizations")
    .insert({ id, ...dados.data, owner_id: usuario.user?.id });
  if (error)
    return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível criar a empresa.") };
  redirect(`/admin/empresas/${id}`);
}

// ---------------------------------------------------------------------------
// Raio-X Financeiro
// ---------------------------------------------------------------------------
export async function salvarPeriodo(
  empresaId: string,
  periodoId: string | null,
  json: string,
): Promise<Aviso & { id?: string }> {
  if (!uuid.safeParse(empresaId).success) return { ok: false, mensagem: "Empresa inválida." };
  let bruto: unknown;
  try {
    bruto = JSON.parse(json);
  } catch {
    return { ok: false, mensagem: "Dados inválidos." };
  }
  const p = periodoSchema.safeParse(bruto);
  if (!p.success) return { ok: false, mensagem: p.error.issues[0]!.message };
  const supabase = await cliente();

  if (periodoId) {
    if (!uuid.safeParse(periodoId).success) return { ok: false, mensagem: "Período inválido." };
    const { data, error } = await supabase
      .from("financial_periods")
      .update(p.data)
      .eq("id", periodoId)
      .eq("organization_id", empresaId)
      .select("id");
    if (error) return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível salvar.") };
    if (!data?.length) return { ok: false, mensagem: "Sem permissão para editar este período." };
    return { ok: true, mensagem: "Período salvo.", id: periodoId };
  }

  const { count } = await supabase
    .from("financial_periods")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", empresaId);
  const { data, error } = await supabase
    .from("financial_periods")
    .insert({ ...p.data, organization_id: empresaId, position: count ?? 0 })
    .select("id")
    .single();
  if (error || !data)
    return {
      ok: false,
      mensagem: mensagemDoBanco(error ?? {}, "Não foi possível criar o período."),
    };
  revalidatePath(`/admin/empresas/${empresaId}`, "layout");
  return { ok: true, mensagem: "Período criado.", id: data.id };
}

export async function excluirPeriodo(empresaId: string, periodoId: string): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success || !uuid.safeParse(periodoId).success)
    return { ok: false, mensagem: "Inválido." };
  const supabase = await cliente();
  const { data, error } = await supabase
    .from("financial_periods")
    .delete()
    .eq("id", periodoId)
    .eq("organization_id", empresaId)
    .select("id");
  if (error || !data?.length)
    return { ok: false, mensagem: mensagemDoBanco(error ?? {}, "Sem permissão para remover.") };
  revalidatePath(`/admin/empresas/${empresaId}`, "layout");
  return { ok: true, mensagem: "Período removido." };
}

/** Importa o arquivo .json da ferramenta offline para a empresa. */
export async function importarArquivoOffline(empresaId: string, form: FormData): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success) return { ok: false, mensagem: "Empresa inválida." };
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0)
    return { ok: false, mensagem: "Escolha o arquivo salvo pelo Raio-X offline." };
  if (arquivo.size > 2 * 1024 * 1024) return { ok: false, mensagem: "Arquivo grande demais." };
  let bruto: unknown;
  try {
    bruto = JSON.parse(await arquivo.text());
  } catch {
    return { ok: false, mensagem: "Arquivo inválido." };
  }
  const lido = arquivoOfflineSchema.safeParse(bruto);
  if (!lido.success) return { ok: false, mensagem: "Este arquivo não é um Raio-X Financeiro." };

  const supabase = await cliente();
  const { data: existentes, error: erroLeitura } = await supabase
    .from("financial_periods")
    .select("id, label")
    .eq("organization_id", empresaId);
  if (erroLeitura) return { ok: false, mensagem: "Sem permissão para ver as análises." };
  const porRotulo = new Map((existentes ?? []).map((e) => [e.label, e.id]));

  let posicao = existentes?.length ?? 0;
  let criados = 0;
  let atualizados = 0;
  for (const p of periodosDoArquivo(lido.data)) {
    const id = porRotulo.get(p.label);
    const { error } = id
      ? await supabase.from("financial_periods").update(p).eq("id", id)
      : await supabase
          .from("financial_periods")
          .insert({ ...p, organization_id: empresaId, position: posicao++ });
    if (error) return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível importar.") };
    if (id) atualizados++;
    else criados++;
  }
  revalidatePath(`/admin/empresas/${empresaId}`, "layout");
  return {
    ok: true,
    mensagem: `Importação concluída: ${criados} período(s) novo(s), ${atualizados} atualizado(s).`,
  };
}

// ---------------------------------------------------------------------------
// Cofre de documentos
// ---------------------------------------------------------------------------
export async function enviarDocumento(empresaId: string, form: FormData): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success) return { ok: false, mensagem: "Empresa inválida." };
  const arquivo = form.get("arquivo");
  const categoria = z.enum(CATEGORIAS_COFRE).safeParse(form.get("categoria"));
  const descricao = String(form.get("descricao") ?? "").slice(0, 500);
  if (!(arquivo instanceof File) || arquivo.size === 0)
    return { ok: false, mensagem: "Escolha um arquivo." };
  if (!categoria.success) return { ok: false, mensagem: "Escolha a categoria." };
  if (!TIPOS_COFRE.includes(arquivo.type))
    return { ok: false, mensagem: "Tipo de arquivo não aceito (use PDF, imagem, Word ou Excel)." };
  if (arquivo.size > LIMITE_COFRE) return { ok: false, mensagem: "O arquivo deve ter até 25 MB." };

  const bytes = Buffer.from(await arquivo.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const supabase = await cliente();

  const { data: registro, error } = await supabase
    .rpc("vault_register_upload", {
      p_org: empresaId,
      p_file_name: arquivo.name.slice(0, 255),
      p_mime: arquivo.type,
      p_size: arquivo.size,
      p_sha256: sha256,
      p_category: categoria.data,
      p_description: descricao,
    })
    .single<{ id: string; storage_path: string }>();
  if (error || !registro)
    return {
      ok: false,
      mensagem: mensagemDoBanco(error ?? {}, "Não foi possível registrar o envio."),
    };

  const envio = await supabase.storage
    .from("vault")
    .upload(registro.storage_path, bytes, { contentType: arquivo.type, upsert: false });
  if (envio.error) {
    // Desfaz o registro pendente para não deixar documento "fantasma".
    await supabase.rpc("vault_start_delete", { p_id: registro.id, p_reason: "Falha no envio" });
    await supabase.rpc("vault_finish_delete", { p_id: registro.id });
    return { ok: false, mensagem: "O envio falhou. Tente de novo." };
  }
  const confirmacao = await supabase.rpc("vault_confirm_upload", { p_id: registro.id });
  if (confirmacao.error) return { ok: false, mensagem: "O envio não pôde ser confirmado." };

  revalidatePath(`/admin/empresas/${empresaId}/cofre`);
  return { ok: true, mensagem: "Documento guardado no cofre." };
}

export async function excluirDocumento(
  empresaId: string,
  documentoId: string,
  motivo: string,
  confirmacao: string,
): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success || !uuid.safeParse(documentoId).success)
    return { ok: false, mensagem: "Inválido." };
  if (confirmacao.trim().toUpperCase() !== "EXCLUIR")
    return { ok: false, mensagem: "Digite EXCLUIR para confirmar." };
  const supabase = await cliente();

  const { data: caminho, error } = await supabase.rpc("vault_start_delete", {
    p_id: documentoId,
    p_reason: motivo,
  });
  if (error || typeof caminho !== "string")
    return { ok: false, mensagem: mensagemDoBanco(error ?? {}, "Não foi possível excluir.") };

  const remocao = await supabase.storage.from("vault").remove([caminho]);
  if (remocao.error)
    return { ok: false, mensagem: "O arquivo não pôde ser removido. Tente de novo." };

  const fim = await supabase.rpc("vault_finish_delete", { p_id: documentoId });
  if (fim.error)
    return {
      ok: false,
      mensagem: "A exclusão ficou pendente: o arquivo ainda consta no cofre. Tente de novo.",
    };

  revalidatePath(`/admin/empresas/${empresaId}/cofre`);
  return { ok: true, mensagem: "Documento excluído definitivamente. O comprovante está na lista." };
}
