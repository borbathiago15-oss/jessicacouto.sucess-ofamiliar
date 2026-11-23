import Link from "next/link";
import { Cartao, Chamada, Selo, Titulo } from "@/components/ui";
import { ROTULO_CATEGORIA, tamanhoLegivel, type CategoriaCofre } from "@/modules/cofre/tipos";
import { carregarEmpresa } from "../carregar";
import { EnviarDocumento, ExcluirDocumento } from "./cofre";
import { Compartilhar } from "../portal/controles";

export const metadata = { title: "Cofre de documentos" };

const dataHora = (v: string | null) =>
  v
    ? new Date(v).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";

export default async function CofrePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { acesso, supabase, empresa } = await carregarEmpresa(
    id,
    `/admin/empresas/${id}/cofre`,
    "vault.read",
  );
  const { data } = await supabase
    .from("vault_documents")
    .select(
      "id, file_name, size_bytes, category, description, status, shared_with_client, uploaded_at, deleted_at, deletion_reason, purged_at, vault_access_log(at)",
    )
    .eq("organization_id", id)
    .in("status", ["active", "deleted"])
    .order("uploaded_at", { ascending: false });

  const ativos = (data ?? []).filter((d) => d.status === "active");
  const excluidos = (data ?? []).filter((d) => d.status === "deleted");

  return (
    <main className="mx-auto grid max-w-4xl gap-8 px-6 py-14">
      <header className="grid gap-2">
        <Chamada>
          <Link href={`/admin/empresas/${id}`} className="text-terra-texto underline">
            {empresa.trade_name}
          </Link>
        </Chamada>
        <Titulo>Cofre de documentos</Titulo>
        <p className="text-mudo max-w-[64ch]">
          Documentos sensíveis desta empresa. Cada abertura fica registrada, e a exclusão apaga o
          arquivo de verdade, deixando só o comprovante.
        </p>
      </header>

      <section aria-labelledby="guardados" className="grid gap-3">
        <h2 id="guardados" className="font-display text-xl">
          Documentos guardados
        </h2>
        {ativos.length === 0 ? (
          <p className="text-mudo">Nenhum documento guardado.</p>
        ) : (
          <ul className="border-linho m-0 grid list-none border-t p-0" data-testid="cofre-lista">
            {ativos.map((d) => {
              const acessos = d.vault_access_log ?? [];
              const ultimo =
                acessos
                  .map((a) => a.at)
                  .sort()
                  .at(-1) ?? null;
              return (
                <li key={d.id} className="border-linho grid gap-2 border-b py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="grid">
                      <span className="font-semibold">{d.file_name}</span>
                      <span className="text-mudo text-[13px]">
                        {tamanhoLegivel(d.size_bytes)} · guardado em {dataHora(d.uploaded_at)}
                        {d.description ? ` · ${d.description}` : ""}
                      </span>
                      <span className="text-mudo text-[13px]">
                        {acessos.length
                          ? `Aberto ${acessos.length} vez(es); última em ${dataHora(ultimo)}`
                          : "Ainda não foi aberto"}
                      </span>
                    </div>
                    <Selo tom="marca">{ROTULO_CATEGORIA[d.category as CategoriaCofre]}</Selo>
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    {acesso.pode("vault.download") ? (
                      <a
                        href={`/admin/empresas/${id}/cofre/${d.id}`}
                        className="text-terra-texto text-sm font-semibold underline"
                      >
                        Baixar<span className="sr-only"> {d.file_name}</span>
                      </a>
                    ) : null}
                    {acesso.pode("portal.manage") ? (
                      <Compartilhar
                        empresaId={id}
                        tipo="documento"
                        id={d.id}
                        inicial={d.shared_with_client}
                        rotulo={d.file_name}
                      />
                    ) : null}
                    {acesso.pode("vault.delete") ? (
                      <ExcluirDocumento empresaId={id} documentoId={d.id} nome={d.file_name} />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {acesso.pode("vault.upload") ? (
        <Cartao className="grid gap-4">
          <h2 className="font-display text-xl">Guardar documento</h2>
          <EnviarDocumento empresaId={id} />
        </Cartao>
      ) : null}

      {excluidos.length > 0 ? (
        <section aria-labelledby="comprovantes" className="grid gap-3">
          <h2 id="comprovantes" className="font-display text-xl">
            Comprovantes de exclusão
          </h2>
          <ul
            className="border-linho m-0 grid list-none border-t p-0"
            data-testid="cofre-comprovantes"
          >
            {excluidos.map((d) => (
              <li key={d.id} className="border-linho grid border-b py-3 text-[14px]">
                <span>
                  <b>{d.file_name}</b> · excluído definitivamente em {dataHora(d.purged_at)}
                </span>
                <span className="text-mudo text-[13px]">Motivo: {d.deletion_reason}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
