import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { entregarArquivo } from "@/lib/cofre/arquivo";

/**
 * Download de documento do cofre. O banco confere sessão, MFA, permissão e acesso
 * à empresa, registra a abertura e só então libera a leitura do arquivo.
 */
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string; doc: string }> },
) {
  const { doc } = await params;
  const negado = new NextResponse("Documento indisponível.", {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
  if (!z.uuid().safeParse(doc).success) return negado;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return negado;

  const { data, error } = await supabase
    .rpc("vault_request_download", { p_id: doc })
    .single<{ storage_path: string; file_name: string; mime_type: string }>();
  if (error || !data) return negado;

  return entregarArquivo(supabase, doc, data, negado);
}
