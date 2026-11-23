import Link from "next/link";
import { FioContinuidade, Monograma } from "@/components/ui";
import { brl, calcularProposta, horasTexto, parcelar } from "@/modules/propostas/calculo";
import { BotaoImprimir } from "../../../empresas/[id]/raio-x/relatorio/imprimir";
import { carregarProposta } from "../carregar";

export const metadata = { title: "Proposta comercial" };

const fuso = "America/Sao_Paulo";
const dataLonga = (v: string | Date) =>
  new Date(v).toLocaleDateString("pt-BR", {
    timeZone: fuso,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
const dataDeDia = (dia: string) => dataLonga(`${dia}T12:00:00-03:00`);

/** Documento padrão de envio: marca JC, logo do cliente, escopo, investimento e aceite. */
export default async function DocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, proposta: p } = await carregarProposta(id, `/admin/propostas/${id}/documento`);

  // Rascunho: prévia com o valor-hora vigente. Enviada: valores congelados.
  let valorHora = p.hourly_rate;
  if (p.status === "draft") {
    const { data } = await supabase.from("proposal_settings").select("hourly_rate").maybeSingle();
    valorHora = Number(data?.hourly_rate ?? 0);
  }
  const calc = calcularProposta(p.itens, { ...p, hourly_rate: valorHora });
  const total = p.total_value ?? calc.total;
  const horas = p.total_hours ?? calc.horas;
  const parcelas = parcelar(total, p.installments);
  const emissao = p.sent_at ?? new Date();
  const validade = p.valid_until
    ? dataDeDia(p.valid_until)
    : `${p.validity_days} dias a partir do envio`;
  const h2 = "font-display text-terra-texto text-xl font-semibold";
  const secao = "grid gap-3 break-inside-avoid";

  return (
    <main
      className="mx-auto grid max-w-[820px] gap-9 px-6 py-10 print:max-w-none print:p-0"
      data-testid="proposta-documento"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/admin/propostas/${id}`} className="text-terra-texto underline">
          Voltar à proposta
        </Link>
        <div className="flex items-center gap-3">
          {p.status === "draft" ? (
            <span className="text-atencao text-sm">
              Prévia: os valores ficam definitivos ao marcar como enviada.
            </span>
          ) : null}
          <BotaoImprimir />
        </div>
      </div>

      {/* Capa */}
      <section className="grid min-h-[70vh] content-between gap-10 print:min-h-[250mm] print:break-after-page">
        <div className="flex items-start justify-between gap-6">
          <div className="grid gap-1">
            <Monograma tamanho={52} />
            <span className="text-mudo text-sm">Jéssica Couto · Sucessão de Sucesso</span>
          </div>
          {p.client_logo_path ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagem privada servida pela própria rota
            <img
              src={`/admin/propostas/${id}/logo`}
              alt={`Logo de ${p.nomeFantasia}`}
              className="max-h-20 max-w-[220px] object-contain"
            />
          ) : null}
        </div>
        <div className="grid gap-4">
          <p className="text-mudo m-0 text-sm">Proposta comercial {p.number}</p>
          <h1 className="font-display text-4xl leading-tight font-semibold">{p.title}</h1>
          <FioContinuidade className="max-w-xs" />
          <p className="m-0 text-lg">
            Para <b>{p.empresa}</b>
          </p>
        </div>
        <p className="text-mudo m-0 text-sm">
          {dataLonga(emissao)} · Válida até {validade}
        </p>
      </section>

      {p.intro.trim() ? (
        <section className={secao}>
          <h2 className={h2}>Apresentação</h2>
          <p className="m-0 leading-relaxed whitespace-pre-wrap">{p.intro}</p>
        </section>
      ) : null}

      <section className="grid gap-3">
        <h2 className={h2}>Escopo do trabalho</h2>
        <ol className="m-0 grid gap-4 p-0" style={{ listStyle: "none" }}>
          {p.itens.map((i, k) => (
            <li key={k} className="border-linho grid break-inside-avoid gap-1 border-l-2 pl-4">
              <span className="font-display text-lg font-semibold">
                {k + 1}. {i.name}
                {p.show_hours ? (
                  <span className="text-mudo ml-2 text-sm font-normal">{horasTexto(i.hours)}</span>
                ) : null}
              </span>
              {i.description ? (
                <span className="text-mudo whitespace-pre-wrap">{i.description}</span>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section className={secao}>
        <h2 className={h2}>Investimento</h2>
        <div
          className="bg-papel border-linho grid gap-2 rounded-2xl border p-5"
          data-testid="documento-investimento"
        >
          {p.show_hours ? (
            <div className="flex justify-between text-sm">
              <span>Dedicação estimada</span>
              <span>{horasTexto(horas)}</span>
            </div>
          ) : null}
          <div className="font-display flex justify-between text-2xl font-semibold">
            <span>Investimento total</span>
            <span className="tabular-nums">{brl(total)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Forma de pagamento</span>
            <span className="tabular-nums">
              {parcelas.length > 1
                ? `${parcelas.length} parcelas de ${brl(parcelas.at(-1)!)}`
                : "Pagamento único"}
            </span>
          </div>
        </div>
        {p.payment_terms.trim() ? (
          <p className="m-0 text-sm whitespace-pre-wrap">{p.payment_terms}</p>
        ) : null}
        <p className="text-mudo m-0 text-sm">Proposta válida até {validade}.</p>
      </section>

      {p.closing_notes.trim() ? (
        <section className={secao}>
          <h2 className={h2}>Considerações finais</h2>
          <p className="m-0 leading-relaxed whitespace-pre-wrap">{p.closing_notes}</p>
        </section>
      ) : null}

      <section className={secao}>
        <h2 className={h2}>Aceite</h2>
        <p className="m-0 text-sm">
          De acordo com o escopo, o investimento e as condições desta proposta.
        </p>
        <div className="grid gap-10 pt-8 sm:grid-cols-2">
          {[p.empresa, "Jéssica Couto · Sucessão de Sucesso"].map((nome) => (
            <div key={nome} className="grid gap-1">
              <span className="border-cacau border-t" aria-hidden="true" />
              <span className="text-sm">{nome}</span>
              <span className="text-mudo text-xs">Data: ____/____/______</span>
            </div>
          ))}
        </div>
      </section>

      <p className="border-linho text-mudo m-0 border-t pt-3 text-xs">
        Documento confidencial, preparado exclusivamente para {p.empresa}. Proposta {p.number}.
      </p>
    </main>
  );
}
