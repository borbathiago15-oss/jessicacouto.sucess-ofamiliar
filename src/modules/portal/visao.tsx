import Link from "next/link";
import { Cartao, Selo } from "@/components/ui";
import { ROTULO_CATEGORIA, tamanhoLegivel } from "@/modules/cofre/tipos";
import { ROTULO_REGISTRO, type TipoRegistro } from "@/modules/familia/schema";
import { ArvoreOrganograma } from "@/modules/organograma/arvore";
import { ROTULO_FASE } from "@/modules/prioridades/schema";
import type { VisaoPortal } from "./schema";

const fuso = "America/Sao_Paulo";
const dia = (v: string) => new Date(v).toLocaleDateString("pt-BR", { timeZone: fuso });
const diaCurto = (d: string) => d.split("-").reverse().join("/");

/**
 * Tela do portal (o que o cliente vê). Usada pelo cliente e pela prévia da JC.
 * `base` monta os links (no portal: /portal/<empresa>; na prévia: null, sem links).
 */
export function VisaoDoCliente({ v, base }: { v: VisaoPortal; base: string | null }) {
  const proximas = v.plano.filter((p) => p.phase !== "done").slice(0, 3);
  return (
    <div className="grid gap-8" data-testid="portal-visao">
      <section aria-labelledby="inicio" className="grid gap-3">
        <h2 id="inicio" className="font-display text-2xl font-semibold">
          Em andamento
        </h2>
        {proximas.length ? (
          <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-3">
            {proximas.map((p, i) => (
              <li key={i} className="border-linho bg-papel grid gap-1 rounded-2xl border p-4">
                <span className="font-semibold">{p.title}</span>
                <span className="text-mudo text-[13px]">
                  {p.responsible ?? "Responsável a definir"}
                  {p.due_on ? ` · até ${diaCurto(p.due_on)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-mudo m-0">Nenhuma ação em andamento compartilhada ainda.</p>
        )}
      </section>

      <Cartao className="grid gap-3">
        <h2 className="font-display text-xl">Relatórios</h2>
        {v.publicacoes.length ? (
          <ul className="m-0 grid list-none gap-2 p-0" data-testid="portal-relatorios">
            {v.publicacoes.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                {base ? (
                  <Link
                    href={`${base}/relatorios/${p.id}`}
                    className="text-terra-texto font-semibold underline"
                  >
                    {p.title}
                  </Link>
                ) : (
                  <span className="font-semibold">{p.title}</span>
                )}
                <span className="text-mudo text-[13px]">publicado em {dia(p.published_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-mudo m-0 text-sm">Nenhum relatório publicado ainda.</p>
        )}
      </Cartao>

      <Cartao className="grid gap-3">
        <h2 className="font-display text-xl">Plano de ação</h2>
        {v.plano.length ? (
          <table className="w-full border-collapse text-[14px]" data-testid="portal-plano">
            <thead className="text-mudo text-[12.5px]">
              <tr className="border-linho border-b">
                <th scope="col" className="py-1.5 pr-2 text-left font-semibold">
                  Ação
                </th>
                <th scope="col" className="py-1.5 pr-2 text-left font-semibold">
                  Responsável
                </th>
                <th scope="col" className="py-1.5 pr-2 text-left font-semibold">
                  Prazo
                </th>
                <th scope="col" className="py-1.5 text-left font-semibold">
                  Etapa
                </th>
              </tr>
            </thead>
            <tbody>
              {v.plano.map((p, i) => (
                <tr key={i} className="border-linho border-b align-top">
                  <td className="py-2 pr-2">{p.title}</td>
                  <td className="py-2 pr-2">{p.responsible ?? "A definir"}</td>
                  <td className="py-2 pr-2">{p.due_on ? diaCurto(p.due_on) : "A definir"}</td>
                  <td className="py-2">
                    <Selo tom={p.phase === "done" ? "ok" : "neutro"}>{ROTULO_FASE[p.phase]}</Selo>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-mudo m-0 text-sm">O plano compartilhado aparecerá aqui.</p>
        )}
      </Cartao>

      <div className="grid gap-5 md:grid-cols-2">
        <Cartao className="grid content-start gap-3">
          <h2 className="font-display text-xl">Documentos</h2>
          {v.documentos.length ? (
            <ul className="m-0 grid list-none gap-2 p-0" data-testid="portal-documentos">
              {v.documentos.map((d) => (
                <li key={d.id} className="grid">
                  {base ? (
                    <a
                      href={`${base}/documentos/${d.id}`}
                      className="text-terra-texto font-semibold underline"
                    >
                      {d.file_name}
                    </a>
                  ) : (
                    <span className="font-semibold">{d.file_name}</span>
                  )}
                  <span className="text-mudo text-[13px]">
                    {ROTULO_CATEGORIA[d.category]} · {tamanhoLegivel(d.size_bytes)} ·{" "}
                    {dia(d.uploaded_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-mudo m-0 text-sm">Nenhum documento compartilhado.</p>
          )}
        </Cartao>

        <Cartao className="grid content-start gap-3">
          <h2 className="font-display text-xl">Encontros e decisões</h2>
          {v.encontros.length ? (
            <ol
              className="border-linho m-0 grid list-none gap-3 border-l-2 p-0 pl-4"
              data-testid="portal-encontros"
            >
              {v.encontros.map((e, i) => (
                <li key={i} className="grid gap-0.5">
                  <span className="text-mudo text-[13px]">
                    {e.occurred_at ? dia(e.occurred_at) : ""} ·{" "}
                    {ROTULO_REGISTRO[e.kind as TipoRegistro] ?? "Registro"}
                  </span>
                  <span className="whitespace-pre-wrap">{e.summary}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-mudo m-0 text-sm">Nenhum encontro registrado ainda.</p>
          )}
        </Cartao>
      </div>

      {v.organograma && v.organograma.cargos.length ? (
        <Cartao className="grid gap-4" data-testid="portal-organograma">
          <div className="grid gap-1">
            <h2 className="font-display text-xl">Estrutura proposta pela JC</h2>
            <p className="text-mudo m-0 text-sm">
              Como a Jéssica propõe organizar a empresa, com o porquê de cada mudança.
            </p>
          </div>
          {v.organograma.resumo ? (
            <p className="m-0 max-w-[72ch] whitespace-pre-line">{v.organograma.resumo}</p>
          ) : null}
          <ArvoreOrganograma
            detalhes={false}
            rotulo="Estrutura proposta"
            cargos={v.organograma.cargos.map((c) => ({
              ...c,
              is_family: false,
              is_owner: false,
              defined_role: false,
              has_backup: false,
              also_reports_to: null,
            }))}
          />
        </Cartao>
      ) : null}
    </div>
  );
}
