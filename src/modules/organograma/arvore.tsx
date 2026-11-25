import type { ReactNode } from "react";
import { Selo } from "@/components/ui";
import { montarArvore, type Cargo, type No } from "./schema";

type Opcoes = {
  porId: Map<string, Cargo>;
  detalhes: boolean;
  acao?: (c: Cargo) => ReactNode;
};

function ItemArvore({ no, o }: { no: No; o: Opcoes }) {
  const c = no.cargo;
  const segundo = c.also_reports_to ? o.porId.get(c.also_reports_to) : undefined;
  return (
    <li className="grid gap-2">
      <div
        className={
          c.holder_name
            ? "border-linho bg-papel grid gap-1.5 rounded-xl border px-3.5 py-2.5"
            : "border-blush-2 grid gap-1.5 rounded-xl border border-dashed px-3.5 py-2.5"
        }
        data-cargo={c.title}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="grid">
            <b className="font-display text-[1.05rem] leading-snug">{c.title}</b>
            <span className="text-mudo text-[13px]">
              {[c.holder_name ?? "Vago", c.area].filter(Boolean).join(" · ")}
            </span>
          </span>
          <span className="flex flex-wrap gap-1">
            {!c.holder_name ? <Selo tom="atencao">Vago</Selo> : null}
            {o.detalhes && c.is_owner ? <Selo tom="marca">Sócio(a)</Selo> : null}
            {o.detalhes && c.is_family ? <Selo tom="marca">Família</Selo> : null}
            {o.detalhes && c.is_family && c.holder_name && !c.defined_role ? (
              <Selo tom="atencao">Sem critérios</Selo>
            ) : null}
            {o.detalhes && c.holder_name && !c.has_backup && no.filhos.length ? (
              <Selo tom="atencao">Sem substituto</Selo>
            ) : null}
          </span>
        </div>
        {segundo ? (
          <span className="text-atencao text-[13px]">Responde também a {segundo.title}</span>
        ) : null}
        {c.change_note ? (
          <span className="text-terra-texto text-[13px]">
            <b>Por quê:</b> {c.change_note}
          </span>
        ) : null}
        {o.acao ? o.acao(c) : null}
      </div>
      {no.filhos.length ? (
        <ul className="border-champanhe m-0 ml-3 grid list-none gap-2 border-l-2 py-0 pr-0 pl-4">
          {no.filhos.map((f) => (
            <ItemArvore key={f.cargo.id} no={f} o={o} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * Organograma em lista aninhada (acessível e legível no celular): cada nível
 * recua com um fio à esquerda, como uma árvore de pastas.
 */
export function ArvoreOrganograma({
  cargos,
  detalhes = true,
  acao,
  testid,
  rotulo,
}: {
  cargos: Cargo[];
  /** Mostra os selos internos (família, sócio, critérios, substituto). */
  detalhes?: boolean;
  acao?: (c: Cargo) => ReactNode;
  testid?: string;
  rotulo: string;
}) {
  const o: Opcoes = { porId: new Map(cargos.map((c) => [c.id, c])), detalhes, acao };
  return (
    <ul aria-label={rotulo} className="m-0 grid list-none gap-2 p-0" data-testid={testid}>
      {montarArvore(cargos).map((n) => (
        <ItemArvore key={n.cargo.id} no={n} o={o} />
      ))}
    </ul>
  );
}
