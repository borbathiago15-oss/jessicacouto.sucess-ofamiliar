import type { Metadata } from "next";
import { z } from "zod";
import { Chamada, Monograma, Titulo } from "@/components/ui";
import { createSupabaseAnonClient } from "@/lib/supabase/anon";
import type { Respostas } from "@/modules/questionnaires/engine";
import { definicaoSchema } from "@/modules/questionnaires/schema";
import { FormularioResposta } from "./formulario";

export const metadata: Metadata = {
  title: "Questionário",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

const abertoSchema = z.object({
  status: z.string(),
  titulo: z.string().nullish(),
  descricao: z.string().nullish(),
  empresa: z.string().nullish(),
  anonimo: z.boolean().nullish(),
  definicao: z.unknown().optional(),
  respostas: z.record(z.string(), z.union([z.string(), z.array(z.string())])).nullish(),
});

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="grid gap-3" data-testid="resposta-indisponivel">
      <Titulo>{titulo}</Titulo>
      <p className="m-0">{texto}</p>
    </div>
  );
}

/** Página do link de questionário: sem conta, só com o código do link. */
export default async function ResponderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createSupabaseAnonClient();
  const valido = /^[0-9a-f]{64}$/.test(token);
  const { data } =
    supabase && valido ? await supabase.rpc("survey_open", { p_token: token }) : { data: null };
  const aberto = abertoSchema.safeParse(data);
  const def = aberto.success ? definicaoSchema.safeParse(aberto.data.definicao) : null;

  return (
    <main className="mx-auto grid max-w-[760px] gap-8 px-5 py-10">
      <div className="flex items-center gap-3">
        <Monograma />
        <span className="text-mudo text-sm">Jéssica Couto · Sucessão de Sucesso</span>
      </div>
      {!aberto.success ? (
        <Aviso
          titulo="Link não encontrado"
          texto="Confira se o endereço está completo ou peça um novo link a quem enviou."
        />
      ) : aberto.data.status === "completed" ? (
        <Aviso
          titulo="Este questionário já foi respondido"
          texto="As respostas foram registradas e não podem ser alteradas."
        />
      ) : aberto.data.status !== "started" || !def?.success ? (
        <Aviso
          titulo="Este link não está mais disponível"
          texto="O prazo terminou. Peça um novo link a quem enviou."
        />
      ) : (
        <>
          <header className="grid gap-3">
            {aberto.data.empresa ? <Chamada>{aberto.data.empresa}</Chamada> : null}
            <Titulo>{aberto.data.titulo ?? "Questionário"}</Titulo>
            {aberto.data.descricao ? <p className="m-0 text-lg">{aberto.data.descricao}</p> : null}
            <p className="text-mudo m-0 text-[15px]">
              {aberto.data.anonimo
                ? "Este questionário é anônimo: as respostas não são ligadas ao seu nome."
                : "Suas respostas são vistas apenas pela equipe da JC."}{" "}
              Você pode salvar e continuar depois pelo mesmo link.
            </p>
          </header>
          <FormularioResposta
            token={token}
            def={def.data}
            iniciais={(aberto.data.respostas ?? {}) as Respostas}
          />
        </>
      )}
    </main>
  );
}
