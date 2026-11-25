import type { Metadata } from "next";
import { Chamada, Titulo } from "@/components/ui";
import { createSupabaseAnonClient } from "@/lib/supabase/anon";
import { formularioPublicoSchema } from "@/modules/diagnostico/schema";
import { FormularioDiagnostico } from "./formulario";

export const metadata: Metadata = { title: "Diagnóstico de Sucessão" };
// Sempre a versão publicada no momento: uma versão antiga em cache recusaria o envio.
export const dynamic = "force-dynamic";

export default async function DiagnosticoPage() {
  const supabase = createSupabaseAnonClient();
  const { data } = supabase ? await supabase.rpc("triage_public_form") : { data: null };
  const f = formularioPublicoSchema.safeParse(data);

  return (
    <div className="grid gap-8">
      <header className="grid max-w-[46rem] gap-3">
        <Chamada>Diagnóstico gratuito</Chamada>
        <Titulo>{f.success && f.data.titulo ? f.data.titulo : "Diagnóstico de Sucessão"}</Titulo>
        <p className="text-mudo m-0 text-lg">
          {f.success && f.data.introducao
            ? f.data.introducao
            : "Sete perguntas, cerca de três minutos. Nenhuma pergunta pede valor exato nem detalhes da sua família."}
        </p>
      </header>
      {f.success ? (
        <FormularioDiagnostico f={f.data} />
      ) : (
        <p className="text-mudo" data-testid="diagnostico-indisponivel">
          O diagnóstico está sendo preparado. Volte em breve.
        </p>
      )}
    </div>
  );
}
