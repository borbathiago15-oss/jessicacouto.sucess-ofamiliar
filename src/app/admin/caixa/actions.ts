"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { gerarParcelas, parcelaSchema, planoSchema } from "@/modules/caixa/schema";
import { lerDecimal } from "@/modules/propostas/calculo";

export type Aviso = { ok: boolean; mensagem: string } | null;
const uuid = z.uuid();
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function erro(e: { code?: string; message?: string }, padrao: string): Aviso {
  if (e.code === "42501") return { ok: false, mensagem: "Sem permissão para esta ação." };
  if (e.code === "55000" && e.message) return { ok: false, mensagem: e.message };
  return { ok: false, mensagem: padrao };
}

async function cliente() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
}

function revalidar(empresaId?: string) {
  revalidatePath("/admin/caixa");
  if (empresaId) revalidatePath(`/admin/empresas/${empresaId}`, "layout");
}

/** Gera as parcelas mensais de um contrato e guarda a forma de pagamento nele. */
export async function gerarPlano(
  empresaId: string,
  contratoId: string,
  _: Aviso,
  form: FormData,
): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success || !uuid.safeParse(contratoId).success)
    return { ok: false, mensagem: "Inválido." };
  const dados = planoSchema.safeParse({
    total: lerDecimal(String(form.get("total") ?? "")) ?? 0,
    parcelas: Number(form.get("parcelas")),
    primeiro: String(form.get("primeiro") ?? ""),
    forma: form.get("forma"),
  });
  if (!dados.success) return { ok: false, mensagem: dados.error.issues[0]!.message };
  const supabase = await cliente();
  const { error } = await supabase.from("contract_payments").insert(
    gerarParcelas(dados.data).map((p) => ({
      ...p,
      contract_id: contratoId,
      organization_id: empresaId,
    })),
  );
  if (error) return erro(error, "Não foi possível gerar as parcelas.");
  await supabase
    .from("contracts")
    .update({ payment_method: dados.data.forma })
    .eq("id", contratoId)
    .eq("organization_id", empresaId);
  revalidar(empresaId);
  return {
    ok: true,
    mensagem:
      dados.data.parcelas === 1
        ? "Pagamento registrado no caixa."
        : `${dados.data.parcelas} parcelas registradas no caixa.`,
  };
}

/** Parcela avulsa (entrada, ajuste, valor fora do plano). */
export async function adicionarParcela(
  empresaId: string,
  contratoId: string,
  _: Aviso,
  form: FormData,
): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success || !uuid.safeParse(contratoId).success)
    return { ok: false, mensagem: "Inválido." };
  const dados = parcelaSchema.safeParse({
    label: form.get("label"),
    due_on: String(form.get("due_on") ?? ""),
    amount: lerDecimal(String(form.get("amount") ?? "")) ?? 0,
    method: form.get("method"),
  });
  if (!dados.success) return { ok: false, mensagem: dados.error.issues[0]!.message };
  const supabase = await cliente();
  const { error } = await supabase
    .from("contract_payments")
    .insert({ ...dados.data, contract_id: contratoId, organization_id: empresaId });
  if (error) return erro(error, "Não foi possível registrar a parcela.");
  revalidar(empresaId);
  return { ok: true, mensagem: "Parcela registrada." };
}

/** Marca como recebida (data e valor). Sem valor informado, vale o da parcela. */
export async function receber(
  id: string,
  data: string,
  valorTexto: string,
  empresaId?: string,
): Promise<Aviso> {
  if (!uuid.safeParse(id).success || !dia.safeParse(data).success)
    return { ok: false, mensagem: "Informe a data do recebimento." };
  const supabase = await cliente();
  let valor = valorTexto.trim() ? lerDecimal(valorTexto) : null;
  if (valorTexto.trim() && (valor === null || valor <= 0))
    return { ok: false, mensagem: "Valor recebido inválido." };
  if (valor === null) {
    const { data: p } = await supabase
      .from("contract_payments")
      .select("amount")
      .eq("id", id)
      .maybeSingle();
    if (!p) return { ok: false, mensagem: "Parcela não encontrada." };
    valor = Number(p.amount);
  }
  const { data: feito, error } = await supabase
    .from("contract_payments")
    .update({ paid_on: data, paid_amount: valor })
    .eq("id", id)
    .is("paid_on", null)
    .select("id");
  if (error) return erro(error, "Não foi possível registrar o recebimento.");
  if (!feito?.length)
    return { ok: false, mensagem: "Esta parcela já foi recebida ou você não tem permissão." };
  revalidar(empresaId);
  return { ok: true, mensagem: "Recebimento registrado." };
}

export async function desfazerRecebimento(id: string, empresaId?: string): Promise<Aviso> {
  if (!uuid.safeParse(id).success) return { ok: false, mensagem: "Inválido." };
  const supabase = await cliente();
  const { data, error } = await supabase
    .from("contract_payments")
    .update({ paid_on: null, paid_amount: null })
    .eq("id", id)
    .select("id");
  if (error) return erro(error, "Não foi possível desfazer.");
  if (!data?.length) return { ok: false, mensagem: "Sem permissão para esta ação." };
  revalidar(empresaId);
  return { ok: true, mensagem: "Recebimento desfeito." };
}

/** Exclui parcela em aberto (o banco recusa excluir o que já foi recebido). */
export async function excluirParcela(id: string, empresaId?: string): Promise<Aviso> {
  if (!uuid.safeParse(id).success) return { ok: false, mensagem: "Inválido." };
  const supabase = await cliente();
  const { data, error } = await supabase
    .from("contract_payments")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) return erro(error, "Não foi possível excluir.");
  if (!data?.length)
    return { ok: false, mensagem: "Parcela recebida não é excluída: desfaça o recebimento antes." };
  revalidar(empresaId);
  return { ok: true, mensagem: "Parcela excluída." };
}
