import Link from "next/link";
import { redirect } from "next/navigation";
import { Cartao, Chamada, Selo, Titulo } from "@/components/ui";
import { meuAcesso } from "@/lib/auth/access";
import { enforceAdminRoute } from "@/lib/auth/guard";
import { umDe } from "@/lib/supabase/relacao";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  configSchema,
  ROTULO_NIVEL,
  TOM_NIVEL,
  type ConfigDiagnostico,
  type Nivel,
} from "@/modules/diagnostico/schema";
import { EditorConteudo, PublicarVersao } from "./editor";

export const metadata = { title: "Diagnóstico de Sucessão" };

const fuso = "America/Sao_Paulo";
const quando = (v: string) =>
  new Date(v).toLocaleString("pt-BR", { timeZone: fuso, dateStyle: "short", timeStyle: "short" });

/** Rótulos legíveis das respostas, a partir da versão respondida. */
function legivel(config: ConfigDiagnostico | null, respostas: Record<string, string[]>) {
  if (!config) return [];
  return config.perguntas
    .filter((p) => p.tipo !== "aberta")
    .map((p) => ({
      pergunta: p.texto,
      resposta: (respostas[p.chave] ?? [])
        .map((v) => p.opcoes?.find((o) => o.valor === v)?.rotulo ?? v)
        .join("; "),
    }));
}

const STATUS: Record<string, { rotulo: string; tom: "ok" | "neutro" | "atencao" }> = {
  published: { rotulo: "Publicada", tom: "ok" },
  draft: { rotulo: "Rascunho", tom: "atencao" },
  archived: { rotulo: "Arquivada", tom: "neutro" },
};

export default async function DiagnosticoAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  await enforceAdminRoute("/admin/diagnostico");
  const acesso = await meuAcesso();
  if (!acesso?.session_valid) redirect("/admin/sair?motivo=sessao");
  const { ver } = await searchParams;
  const aba = ver === "conteudo" ? "conteudo" : "respostas";
  const podeRespostas = acesso.pode("diagnostics.read_answers");
  const podeConteudo = acesso.pode("questionnaires.read");
  if (!podeRespostas && !podeConteudo)
    return (
      <main className="mx-auto grid max-w-3xl gap-4 px-6 py-16">
        <Titulo>Diagnóstico de Sucessão</Titulo>
        <p>Você não tem acesso ao diagnóstico. Peça a uma administradora.</p>
      </main>
    );

  const supabase = (await createSupabaseServerClient())!;
  const [versoesR, respostasR] = await Promise.all([
    podeConteudo
      ? supabase
          .from("triage_versions")
          .select("id, version_number, status, config, notes, created_at, published_at")
          .order("version_number", { ascending: false })
      : Promise.resolve({ data: [] }),
    podeRespostas && aba === "respostas"
      ? supabase
          .from("triage_submissions")
          .select(
            "id, version_id, answers, open_answer, level, reasons, probable_pain, created_at, opportunity_id, participants(full_name, email, phone)",
          )
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
  ]);
  const versoes = versoesR.data ?? [];
  const configDe = new Map(
    versoes.map((v) => [v.id as string, configSchema.safeParse(v.config).data ?? null]),
  );
  const publicada = versoes.find((v) => v.status === "published");
  const base = "/admin/diagnostico";

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-6 py-14">
      <header className="grid gap-2">
        <Chamada>
          <Link href="/admin" className="text-terra-texto underline">
            Início
          </Link>
        </Chamada>
        <Titulo>Diagnóstico de Sucessão</Titulo>
        <p className="text-mudo max-w-[68ch]">
          A porta de entrada do site. Cada resposta entra no CRM com a classificação e os motivos; a
          pessoa vê só a leitura dela, nunca a classificação.{" "}
          <Link href="/diagnostico" className="text-terra-texto underline">
            Ver o diagnóstico no site
          </Link>
        </p>
      </header>

      <nav aria-label="Visões do diagnóstico" className="border-linho flex gap-1 border-b">
        {[
          { v: "respostas", r: "Respostas" },
          { v: "conteudo", r: "Conteúdo e versões" },
        ].map((a) => (
          <Link
            key={a.v}
            href={`${base}?ver=${a.v}`}
            aria-current={a.v === aba ? "page" : undefined}
            className={
              a.v === aba
                ? "border-terra -mb-px border-b-2 px-3.5 py-2 text-[15px] font-semibold"
                : "text-mudo hover:text-terra-texto px-3.5 py-2 text-[15px]"
            }
          >
            {a.r}
          </Link>
        ))}
      </nav>

      {aba === "respostas" ? (
        !podeRespostas ? (
          <p className="text-mudo">Você não tem acesso às respostas individuais.</p>
        ) : (respostasR.data ?? []).length === 0 ? (
          <p className="text-mudo">Nenhuma resposta ainda.</p>
        ) : (
          <ul className="m-0 grid list-none gap-4 p-0" data-testid="diag-respostas">
            {(respostasR.data ?? []).map((s) => {
              const pessoa = umDe(s.participants);
              const nivel = s.level as Nivel;
              const respostas = (s.answers ?? {}) as Record<string, string[]>;
              return (
                <li key={s.id as string}>
                  <Cartao className="grid gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="grid">
                        <b className="font-display text-lg">
                          {(pessoa?.full_name as string) ?? "Pessoa removida"}
                        </b>
                        <span className="text-mudo text-[13px]">
                          {[pessoa?.email, pessoa?.phone, quando(s.created_at as string)]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </div>
                      <Selo tom={TOM_NIVEL[nivel]}>{ROTULO_NIVEL[nivel]}</Selo>
                    </div>
                    {(s.reasons as string[]).length ? (
                      <ul className="m-0 grid gap-1 pl-5 text-[14px]">
                        {(s.reasons as string[]).map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    ) : null}
                    {s.probable_pain ? (
                      <p className="m-0 text-[14px]">
                        <b>Provável dor:</b> {s.probable_pain as string}
                      </p>
                    ) : null}
                    {s.open_answer ? (
                      <blockquote className="border-terra m-0 border-l-4 pl-3 italic">
                        “{s.open_answer as string}”
                      </blockquote>
                    ) : null}
                    <details>
                      <summary className="text-terra-texto cursor-pointer text-[13px] font-semibold">
                        Ver as respostas
                      </summary>
                      <dl className="mt-2 grid gap-1 text-[13.5px]">
                        {legivel(configDe.get(s.version_id as string) ?? null, respostas).map(
                          (r) => (
                            <div key={r.pergunta} className="grid gap-0.5 sm:grid-cols-2 sm:gap-4">
                              <dt className="text-mudo">{r.pergunta}</dt>
                              <dd className="m-0">{r.resposta}</dd>
                            </div>
                          ),
                        )}
                      </dl>
                    </details>
                    {s.opportunity_id ? (
                      <Link href="/admin/funil" className="text-terra-texto text-[13px] underline">
                        Ver no funil comercial
                      </Link>
                    ) : null}
                  </Cartao>
                </li>
              );
            })}
          </ul>
        )
      ) : !podeConteudo ? (
        <p className="text-mudo">Você não tem acesso ao conteúdo do diagnóstico.</p>
      ) : (
        <div className="grid gap-8">
          <section aria-labelledby="versoes" className="grid gap-3">
            <h2 id="versoes" className="font-display text-xl">
              Versões
            </h2>
            {versoes.length ? (
              <ul
                className="border-linho m-0 grid list-none border-t p-0"
                data-testid="diag-versoes"
              >
                {versoes.map((v) => {
                  const c = configDe.get(v.id as string);
                  const st = STATUS[v.status as string]!;
                  return (
                    <li
                      key={v.id as string}
                      className="border-linho flex flex-wrap items-center justify-between gap-3 border-b py-3"
                    >
                      <span className="grid">
                        <b>Versão {v.version_number as number}</b>
                        <span className="text-mudo text-[13px]">
                          {c
                            ? `${c.perguntas.length} perguntas · ${c.regras.length} regras`
                            : "conteúdo inválido"}
                          {v.notes ? ` · ${v.notes as string}` : ""}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Selo tom={st.tom}>{st.rotulo}</Selo>
                        {v.status === "draft" && acesso.pode("questionnaires.publish") ? (
                          <PublicarVersao id={v.id as string} numero={v.version_number as number} />
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-mudo">
                Nenhuma versão ainda. Sem versão publicada, o site mostra “em preparação”.
              </p>
            )}
          </section>
          {acesso.pode("questionnaires.create") ? (
            <section aria-labelledby="nova" className="grid gap-3">
              <h2 id="nova" className="font-display text-xl">
                Nova versão
              </h2>
              <p className="text-mudo m-0 text-sm">
                Parte do conteúdo publicado. Publicada não muda: cada ajuste vira uma nova versão, e
                as respostas antigas continuam ligadas à versão que a pessoa respondeu.
              </p>
              <EditorConteudo
                inicial={JSON.stringify(
                  (publicada && configDe.get(publicada.id as string)) ?? versoes[0]?.config ?? {},
                  null,
                  2,
                )}
              />
            </section>
          ) : null}
        </div>
      )}
    </main>
  );
}
