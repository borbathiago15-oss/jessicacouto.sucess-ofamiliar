import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { nomeParaDownload } from "@/modules/cofre/tipos";

/**
 * Download de documento compartilhado com o cliente. O banco confere vínculo,
 * MFA e compartilhamento, registra a abertura e só então libera o arquivo.
 */
export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ org: string; doc: string }> },
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
    .rpc("portal_request_download", { p_doc: doc })
    .single<{ storage_path: string; file_name: string; mime_type: string }>();
  if (error || !data) return negado;

  const arquivo = await supabase.storage.from("vault").download(data.storage_path);
  if (arquivo.error || !arquivo.data) return negado;

  return new NextResponse(arquivo.data, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": nomeParaDownload(data.file_name),
      "Content-Length": String(arquivo.data.size),
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
