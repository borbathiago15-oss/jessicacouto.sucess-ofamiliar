import type { Metadata } from "next";
import { Blocos, ConteudoEmPreparacao } from "@/components/site/blocos";
import { Cartao } from "@/components/ui";
import { createSupabaseAnonClient } from "@/lib/supabase/anon";
import { buscarPaginaPublicada } from "@/modules/cms/queries";
import { listaPublicaSchema } from "@/modules/materiais/schema";
import { FormularioMaterial } from "./formulario";

export const metadata: Metadata = { title: "Guias" };
// O material disponível pode mudar a qualquer momento (ativado na área da JC).
export const dynamic = "force-dynamic";

export default async function GuiasPage({
  searchParams,
}: {
  searchParams: Promise<{ link?: string }>;
}) {
  const { link } = await searchParams;
  const supabase = createSupabaseAnonClient();
  const [pagina, lista] = await Promise.all([
    buscarPaginaPublicada("guias"),
    supabase ? supabase.rpc("material_public_list") : Promise.resolve({ data: [] }),
  ]);
  const materiais = listaPublicaSchema.safeParse(lista.data).data ?? [];

  return (
    <div className="grid gap-12">
      {pagina ? (
        <>
          {pagina.conteudo.blocos[0]?.tipo === "hero" ? null : (
            <h1 className="font-display text-[clamp(2rem,4.2vw,2.9rem)] leading-[1.08] font-semibold">
              {pagina.titulo}
            </h1>
          )}
          <Blocos blocos={pagina.conteudo.blocos} />
        </>
      ) : (
        <ConteudoEmPreparacao />
      )}

      <section id="receber" aria-labelledby="receber-titulo" className="scroll-mt-28">
        <Cartao className="grid gap-6 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:gap-10">
          <div className="grid content-start gap-3">
            <h2
              id="receber-titulo"
              className="font-display m-0 text-[clamp(1.8rem,3.6vw,2.6rem)] leading-tight font-medium"
            >
              Receba o guia
            </h2>
            {materiais.length === 1 && materiais[0]!.descricao ? (
              <p className="text-mudo m-0">{materiais[0]!.descricao}</p>
            ) : (
              <p className="text-mudo m-0">
                Um cadastro simples e o download sai na hora. Receber novidades é opcional.
              </p>
            )}
          </div>
          {materiais.length ? (
            <FormularioMaterial materiais={materiais} linkExpirado={link === "expirado"} />
          ) : (
            <p className="text-mudo m-0" data-testid="material-indisponivel">
              O guia está sendo finalizado. Volte em breve.
            </p>
          )}
        </Cartao>
      </section>
    </div>
  );
}
