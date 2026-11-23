import Link from "next/link";
import { Cartao, Chamada, Selo, Titulo } from "@/components/ui";
import { umDe } from "@/lib/supabase/relacao";
import {
  resumoDaFamilia,
  ROTULO_PAPEL,
  ROTULO_SUCESSAO,
  type Papel,
  type SituacaoSucessao,
} from "@/modules/familia/schema";
import { carregarEmpresa } from "../carregar";
import { EditarPessoa, NovaPessoa, type PessoaTela } from "./formularios";

export const metadata = { title: "Família e pessoas" };

function Fato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="border-linho bg-porcelana rounded-xl border px-3 py-2.5">
      <span className="text-mudo block text-xs">{rotulo}</span>
      <b className="font-display text-[1.3rem]">{valor}</b>
    </div>
  );
}

export default async function FamiliaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { acesso, supabase, empresa } = await carregarEmpresa(
    id,
    `/admin/empresas/${id}/familia`,
    "participants.read",
  );
  const { data } = await supabase
    .from("organization_participants")
    .select(
      "role_in_org, is_family, kinship, generation, ownership_pct, works_in_company, area, successor_status, participants(id, full_name, email, phone, declared_role)",
    )
    .eq("organization_id", id);

  const pessoas: PessoaTela[] = (data ?? [])
    .flatMap((v) => {
      const p = umDe(v.participants);
      return p
        ? [
            {
              id: p.id as string,
              full_name: p.full_name as string,
              email: p.email as string | null,
              phone: p.phone as string | null,
              declared_role: p.declared_role as string,
              role_in_org: v.role_in_org as string | null,
              is_family: v.is_family as boolean,
              kinship: v.kinship as string | null,
              generation: v.generation as number | null,
              ownership_pct: v.ownership_pct === null ? null : Number(v.ownership_pct),
              works_in_company: v.works_in_company as boolean,
              area: v.area as string | null,
              successor_status: v.successor_status as string,
            },
          ]
        : [];
    })
    .sort(
      (a, b) =>
        (a.generation ?? 99) - (b.generation ?? 99) ||
        a.full_name.localeCompare(b.full_name, "pt-BR"),
    );

  const resumo = resumoDaFamilia(
    pessoas.map((p) => ({
      nome: p.full_name,
      is_family: p.is_family,
      generation: p.generation,
      ownership_pct: p.ownership_pct,
      works_in_company: p.works_in_company,
      successor_status: p.successor_status as SituacaoSucessao,
    })),
  );
  const podeEditar = acesso.pode("participants.update");
  const grupos = [
    ["Família", pessoas.filter((p) => p.is_family)],
    ["Outras pessoas-chave", pessoas.filter((p) => !p.is_family)],
  ] as const;
  const perc = (v: number) => `${v.toLocaleString("pt-BR")}%`;

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-6 py-14">
      <header className="grid gap-2">
        <Chamada>
          <Link href={`/admin/empresas/${id}`} className="text-terra-texto underline">
            {empresa.trade_name}
          </Link>
        </Chamada>
        <Titulo>Família e pessoas</Titulo>
        <p className="text-mudo max-w-[64ch]">
          Quem é quem na família e na empresa: geração, participação, atuação e situação na
          sucessão.
        </p>
      </header>

      {!resumo.vazio ? (
        <section aria-labelledby="resumo" className="grid gap-3">
          <h2 id="resumo" className="font-display text-xl">
            Leitura rápida
          </h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" data-testid="familia-resumo">
            <Fato
              rotulo="Familiares"
              valor={`${resumo.familiares} (${resumo.familiaresNaEmpresa} na empresa)`}
            />
            <Fato
              rotulo="Gerações"
              valor={resumo.geracoes.length ? resumo.geracoes.map((g) => `${g}ª`).join(", ") : "—"}
            />
            <Fato rotulo="Participação da família" valor={perc(resumo.participacaoFamilia)} />
            <Fato
              rotulo="Sucessão"
              valor={
                resumo.sucessoresDefinidos
                  ? `${resumo.sucessoresDefinidos} definido(s)`
                  : `${resumo.sucessoresEmPreparacao + resumo.sucessoresPotenciais} em vista`
              }
            />
          </div>
          {resumo.pontos.length ? (
            <ul className="text-atencao bg-atencao-fundo m-0 grid list-none gap-1 rounded-[10px] px-3 py-2 text-sm">
              {resumo.pontos.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {pessoas.length === 0 ? (
        <p className="text-mudo">Nenhuma pessoa cadastrada nesta empresa.</p>
      ) : (
        grupos.map(([titulo, lista]) =>
          lista.length ? (
            <section key={titulo} className="grid gap-3">
              <h2 className="font-display text-xl">{titulo}</h2>
              <ul
                className="border-linho m-0 grid list-none border-t p-0"
                data-testid="familia-lista"
              >
                {lista.map((p) => (
                  <li key={p.id} className="border-linho grid gap-2 border-b py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="grid">
                        <span className="font-semibold">{p.full_name}</span>
                        <span className="text-mudo text-[13px]">
                          {[
                            ROTULO_PAPEL[p.declared_role as Papel],
                            p.kinship,
                            p.generation ? `${p.generation}ª geração` : null,
                            p.role_in_org,
                            p.area,
                            p.works_in_company ? "trabalha na empresa" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {p.ownership_pct !== null ? (
                          <Selo tom="marca">{perc(p.ownership_pct)}</Selo>
                        ) : null}
                        {p.successor_status !== "none" ? (
                          <Selo tom={p.successor_status === "designated" ? "ok" : "atencao"}>
                            {ROTULO_SUCESSAO[p.successor_status as SituacaoSucessao]}
                          </Selo>
                        ) : null}
                      </div>
                    </div>
                    {podeEditar ? <EditarPessoa empresaId={id} pessoa={p} /> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null,
        )
      )}

      {acesso.pode("participants.create") && podeEditar ? (
        <Cartao className="grid gap-4">
          <h2 className="font-display text-xl">Incluir pessoa</h2>
          <NovaPessoa empresaId={id} />
        </Cartao>
      ) : null}
    </main>
  );
}
