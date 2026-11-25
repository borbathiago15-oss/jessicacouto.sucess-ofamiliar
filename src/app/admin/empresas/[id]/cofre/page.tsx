import Link from "next/link";
import { Cartao, Chamada, Selo, Titulo } from "@/components/ui";
import { ROTULO_CATEGORIA, tamanhoLegivel, type CategoriaCofre } from "@/modules/cofre/tipos";
import { carregarEmpresa } from "../carregar";
import { EnviarDocumento, ExcluirDocumento } from "./cofre";
import { Compartilhar } from "../portal/controles";
import { NovoPedido, RevisarPedido } from "./pedidos";
import {
  ROTULO_STATUS_PEDIDO,
  TOM_STATUS_PEDIDO,
  type StatusPedido,
} from "@/modules/cofre/pedidos";

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
      "id, file_name, size_bytes, category, description, status, shared_with_client, uploaded_at, deleted_at, deletion_reason, purged_at, request_id, uploaded_via_portal, vault_access_log(at)",
    )
    .eq("organization_id", id)
    .in("status", ["active", "deleted"])
    .order("uploaded_at", { ascending: false });

  const { data: pedidosDados } = await supabase
    .from("document_requests")
    .select("id, title, category, note, due_on, status, review_note, assignee_user_id, created_at")
    .eq("organization_id", id)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });
  const pedidos = pedidosDados ?? [];
  const pessoas = acesso.pode("portal.manage")
    ? (
        ((await supabase.rpc("portal_list_members", { p_org: id })).data ?? []) as {
          user_id: string;
          email: string;
          revoked_at: string | null;
        }[]
      ).filter((p) => !p.revoked_at)
    : [];
  const emailDe = (u: string | null) => pessoas.find((p) => p.user_id === u)?.email ?? null;
  const tituloPedido = (pid: string | null) => pedidos.find((q) => q.id === pid)?.title ?? null;

  const { data: vencendoDados } = await supabase.rpc("vault_expiring", {
    p_org: id,
    p_horizon_days: 15,
  });
  const vencendo = (vencendoDados ?? []) as {
    id: string;
    file_name: string;
    request_title: string;
    expires_on: string;
  }[];
  const hoje = new Date().toISOString().slice(0, 10);

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

      {vencendo.length > 0 ? (
        <section
          aria-labelledby="prazo"
          className="bg-atencao-fundo grid gap-3 rounded-2xl p-4"
          data-testid="prazo-guarda"
        >
          <h2 id="prazo" className="font-display text-xl">
            Prazo de guarda
          </h2>
          <p className="m-0 text-sm">
            Documentos enviados pela família cuja análise terminou. Depois do prazo, apague: o que
            não existe mais não vaza.{" "}
            <Link href="/admin/seguranca" className="text-terra-texto underline">
              Ajustar o prazo
            </Link>
          </p>
          <ul className="m-0 grid list-none gap-3 p-0">
            {vencendo.map((v) => (
              <li key={v.id} className="grid gap-2">
                <span>
                  <b>{v.file_name}</b> · pedido: {v.request_title} ·{" "}
                  {v.expires_on <= hoje
                    ? `venceu em ${v.expires_on.split("-").reverse().join("/")}`
                    : `vence em ${v.expires_on.split("-").reverse().join("/")}`}
                </span>
                {acesso.pode("vault.delete") ? (
                  <ExcluirDocumento
                    empresaId={id}
                    documentoId={v.id}
                    nome={v.file_name}
                    motivoInicial="Prazo de guarda vencido"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="pedidos" className="grid gap-3">
        <h2 id="pedidos" className="font-display text-xl">
          Documentos pedidos à família
        </h2>
        <p className="text-mudo m-0 max-w-[64ch] text-sm">
          A família vê estes pedidos no portal e envia os arquivos direto aqui no cofre. Cada
          arquivo enviado só é visto por quem enviou e pela equipe JC.
        </p>
        {pedidos.length === 0 ? (
          <p className="text-mudo">Nenhum pedido em aberto.</p>
        ) : (
          <ul className="border-linho m-0 grid list-none border-t p-0" data-testid="pedidos-lista">
            {pedidos.map((q) => {
              const arquivos = ativos.filter((d) => d.request_id === q.id);
              return (
                <li key={q.id} className="border-linho grid gap-2 border-b py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="grid">
                      <span className="font-semibold">{q.title}</span>
                      <span className="text-mudo text-[13px]">
                        {ROTULO_CATEGORIA[q.category as CategoriaCofre]}
                        {q.due_on ? ` · prazo ${q.due_on.split("-").reverse().join("/")}` : ""}
                        {" · "}
                        {q.assignee_user_id
                          ? `para ${emailDe(q.assignee_user_id) ?? "uma pessoa da família"}`
                          : "para a família"}
                        {` · ${arquivos.length} arquivo(s)`}
                      </span>
                      {q.note ? <span className="text-mudo text-[13px]">{q.note}</span> : null}
                      {q.status === "needs_changes" && q.review_note ? (
                        <span className="text-[13px]">Ajuste pedido: {q.review_note}</span>
                      ) : null}
                    </div>
                    <Selo tom={TOM_STATUS_PEDIDO[q.status as StatusPedido]}>
                      {ROTULO_STATUS_PEDIDO[q.status as StatusPedido]}
                    </Selo>
                  </div>
                  {acesso.pode("vault.upload") ? (
                    <RevisarPedido
                      empresaId={id}
                      pedidoId={q.id}
                      titulo={q.title}
                      temArquivo={arquivos.length > 0 && q.status !== "accepted"}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {acesso.pode("vault.upload") ? (
          <Cartao className="grid gap-4">
            <h3 className="font-display text-lg">Pedir um documento</h3>
            <NovoPedido empresaId={id} pessoas={pessoas} />
            {pessoas.length === 0 ? (
              <p className="text-mudo m-0 text-sm">
                Ninguém da família tem acesso ao portal ainda. Dê acesso na página do portal para
                que vejam os pedidos.
              </p>
            ) : null}
          </Cartao>
        ) : null}
      </section>

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
                      {d.uploaded_via_portal ? (
                        <span className="text-terra-texto text-[13px] font-semibold">
                          Enviado pela família no portal
                          {tituloPedido(d.request_id)
                            ? ` · pedido: ${tituloPedido(d.request_id)}`
                            : ""}
                        </span>
                      ) : null}
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
