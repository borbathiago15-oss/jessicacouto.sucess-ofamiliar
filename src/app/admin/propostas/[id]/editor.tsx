"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Botao, Cartao, campoClasses } from "@/components/ui";
import {
  brl,
  calcularProposta,
  ehAberta,
  horasTexto,
  lerDecimal,
  rascunhoSchema,
  type Rascunho,
  type StatusProposta,
} from "@/modules/propostas/calculo";
import {
  enviarLogo,
  excluirRascunho,
  mudarStatus,
  salvarRascunho,
  type Aviso,
  type NovoStatus,
} from "../actions";

export type EtapaCatalogo = {
  id: string;
  name: string;
  description: string | null;
  default_hours: number;
};

const rotulo = "grid gap-1 text-[13px] font-semibold";

function Linha({ rot, valor, forte }: { rot: string; valor: string; forte?: boolean }) {
  return (
    <div
      className={`flex justify-between gap-3 ${forte ? "font-display text-lg font-semibold" : "text-sm"}`}
    >
      <span>{rot}</span>
      <span className="tabular-nums">{valor}</span>
    </div>
  );
}

export function EditorProposta({
  id,
  status,
  inicial,
  valorHora,
  catalogo,
  logoVersao,
  podeEditar,
  totaisCongelados,
}: {
  id: string;
  status: StatusProposta;
  inicial: Rascunho;
  valorHora: number;
  catalogo: EtapaCatalogo[];
  /** Versão do logo (muda a cada envio), ou null se não houver logo. */
  logoVersao: string | null;
  podeEditar: boolean;
  totaisCongelados: { horas: number; total: number } | null;
}) {
  const router = useRouter();
  const [r, setR] = useState<Rascunho>(inicial);
  // Texto digitado dos campos numéricos (aceita vírgula).
  const [horasTxt, setHorasTxt] = useState(() =>
    inicial.items.map((i) => String(i.hours).replace(".", ",")),
  );
  const [fatorTxt, setFatorTxt] = useState(String(inicial.complexity_factor).replace(".", ","));
  const [descontoTxt, setDescontoTxt] = useState(String(inicial.discount_pct).replace(".", ","));
  const [alterado, setAlterado] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [motivo, setMotivo] = useState("");
  const [pendente, iniciar] = useTransition();
  const [etapaCat, setEtapaCat] = useState(catalogo[0]?.id ?? "");
  const logoForm = useRef<HTMLFormElement>(null);

  const editavel = podeEditar && status === "draft";
  const calc = calcularProposta(r.items, { ...r, hourly_rate: valorHora });
  const validacao = rascunhoSchema.safeParse(r);
  const problema = validacao.success ? null : validacao.error.issues[0]!.message;

  const mudar = (parcial: Partial<Rascunho>) => {
    setR((x) => ({ ...x, ...parcial }));
    setAlterado(true);
  };
  const mudarItem = (i: number, parcial: Partial<Rascunho["items"][number]>) =>
    mudar({ items: r.items.map((x, k) => (k === i ? { ...x, ...parcial } : x)) });
  const adicionar = (item: Rascunho["items"][number]) => {
    mudar({ items: [...r.items, item] });
    setHorasTxt((h) => [...h, String(item.hours).replace(".", ",")]);
  };
  const remover = (i: number) => {
    mudar({ items: r.items.filter((_, k) => k !== i) });
    setHorasTxt((h) => h.filter((_, k) => k !== i));
  };
  const mover = (i: number, d: -1 | 1) => {
    const troca = <T,>(l: T[]) => {
      const n = [...l];
      const [x] = n.splice(i, 1);
      n.splice(i + d, 0, x!);
      return n;
    };
    mudar({ items: troca(r.items) });
    setHorasTxt(troca);
  };

  const salvar = () =>
    iniciar(async () => {
      const res = await salvarRascunho(id, JSON.stringify(r));
      setAviso(res);
      if (res?.ok) setAlterado(false);
    });

  const status_ = (s: NovoStatus) =>
    iniciar(async () => {
      if (alterado) return setAviso({ ok: false, mensagem: "Salve o rascunho antes." });
      const res = await mudarStatus(id, s, motivo);
      setAviso(res);
      if (res?.ok) router.refresh();
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
      <div className="grid gap-5">
        <fieldset disabled={!editavel} className="m-0 grid min-w-0 gap-5 border-0 p-0">
          <Cartao className="grid gap-3">
            <label htmlFor="pr-titulo" className={rotulo}>
              Título
              <input
                id="pr-titulo"
                className={campoClasses}
                value={r.title}
                maxLength={200}
                onChange={(e) => mudar({ title: e.target.value })}
              />
            </label>
            <label htmlFor="pr-intro" className={rotulo}>
              Apresentação (abre o documento)
              <textarea
                id="pr-intro"
                rows={5}
                className={campoClasses}
                value={r.intro}
                maxLength={6000}
                onChange={(e) => mudar({ intro: e.target.value })}
              />
            </label>
          </Cartao>

          <Cartao className="grid gap-3">
            <h2 className="font-display text-xl">Etapas e esforço</h2>
            {r.items.length === 0 ? (
              <p className="text-mudo text-sm">Inclua as etapas do trabalho.</p>
            ) : null}
            <ol className="m-0 grid list-none gap-3 p-0">
              {r.items.map((item, i) => (
                <li key={i} className="border-linho grid gap-2 rounded-xl border p-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
                    <label htmlFor={`it${i}-nome`} className={rotulo}>
                      Etapa {i + 1}
                      <input
                        id={`it${i}-nome`}
                        className={campoClasses}
                        value={item.name}
                        maxLength={160}
                        onChange={(e) => mudarItem(i, { name: e.target.value })}
                      />
                    </label>
                    <label htmlFor={`it${i}-horas`} className={rotulo}>
                      Horas
                      <input
                        id={`it${i}-horas`}
                        inputMode="decimal"
                        className={`${campoClasses} text-right`}
                        value={horasTxt[i] ?? ""}
                        onChange={(e) => {
                          const txt = e.target.value;
                          setHorasTxt((h) => h.map((x, k) => (k === i ? txt : x)));
                          mudarItem(i, { hours: lerDecimal(txt) ?? 0 });
                        }}
                      />
                    </label>
                  </div>
                  <label htmlFor={`it${i}-desc`} className={rotulo}>
                    O que inclui
                    <textarea
                      id={`it${i}-desc`}
                      rows={2}
                      className={campoClasses}
                      value={item.description ?? ""}
                      maxLength={2000}
                      onChange={(e) => mudarItem(i, { description: e.target.value || null })}
                    />
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    <Botao
                      type="button"
                      variante="secundario"
                      tamanho="pequeno"
                      disabled={i === 0}
                      onClick={() => mover(i, -1)}
                    >
                      Subir<span className="sr-only"> etapa {i + 1}</span>
                    </Botao>
                    <Botao
                      type="button"
                      variante="secundario"
                      tamanho="pequeno"
                      disabled={i === r.items.length - 1}
                      onClick={() => mover(i, 1)}
                    >
                      Descer<span className="sr-only"> etapa {i + 1}</span>
                    </Botao>
                    <Botao
                      type="button"
                      variante="secundario"
                      tamanho="pequeno"
                      onClick={() => remover(i)}
                    >
                      Remover<span className="sr-only"> etapa {i + 1}</span>
                    </Botao>
                  </div>
                </li>
              ))}
            </ol>
            {editavel ? (
              <div className="flex flex-wrap items-end gap-2">
                {catalogo.length ? (
                  <>
                    <label htmlFor="pr-catalogo" className={rotulo}>
                      Etapa do catálogo
                      <select
                        id="pr-catalogo"
                        className={campoClasses}
                        value={etapaCat}
                        onChange={(e) => setEtapaCat(e.target.value)}
                      >
                        {catalogo.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({horasTexto(c.default_hours)})
                          </option>
                        ))}
                      </select>
                    </label>
                    <Botao
                      type="button"
                      variante="secundario"
                      onClick={() => {
                        const c = catalogo.find((x) => x.id === etapaCat);
                        if (c)
                          adicionar({
                            service_id: c.id,
                            name: c.name,
                            description: c.description,
                            hours: c.default_hours,
                          });
                      }}
                    >
                      Incluir do catálogo
                    </Botao>
                  </>
                ) : null}
                <Botao
                  type="button"
                  variante="secundario"
                  onClick={() =>
                    adicionar({ service_id: null, name: "Nova etapa", description: null, hours: 1 })
                  }
                >
                  Etapa avulsa
                </Botao>
              </div>
            ) : null}
          </Cartao>

          <Cartao className="grid gap-3">
            <h2 className="font-display text-xl">Preço e condições</h2>
            <div className="grid gap-3 sm:grid-cols-4">
              <label htmlFor="pr-fator" className={rotulo}>
                Fator de complexidade
                <input
                  id="pr-fator"
                  inputMode="decimal"
                  className={campoClasses}
                  value={fatorTxt}
                  onChange={(e) => {
                    setFatorTxt(e.target.value);
                    mudar({ complexity_factor: lerDecimal(e.target.value) ?? 0 });
                  }}
                />
                <span className="text-mudo text-xs font-normal">1 = padrão; até 3.</span>
              </label>
              <label htmlFor="pr-desconto" className={rotulo}>
                Desconto (%)
                <input
                  id="pr-desconto"
                  inputMode="decimal"
                  className={campoClasses}
                  value={descontoTxt}
                  onChange={(e) => {
                    setDescontoTxt(e.target.value);
                    mudar({ discount_pct: lerDecimal(e.target.value) ?? 0 });
                  }}
                />
              </label>
              <label htmlFor="pr-parcelas" className={rotulo}>
                Parcelas
                <input
                  id="pr-parcelas"
                  type="number"
                  min={1}
                  max={24}
                  className={campoClasses}
                  value={r.installments}
                  onChange={(e) => mudar({ installments: Number(e.target.value) || 1 })}
                />
              </label>
              <label htmlFor="pr-validade" className={rotulo}>
                Validade (dias)
                <input
                  id="pr-validade"
                  type="number"
                  min={1}
                  max={180}
                  className={campoClasses}
                  value={r.validity_days}
                  onChange={(e) => mudar({ validity_days: Number(e.target.value) || 1 })}
                />
              </label>
            </div>
            <label htmlFor="pr-pagamento" className={rotulo}>
              Condições de pagamento
              <textarea
                id="pr-pagamento"
                rows={2}
                className={campoClasses}
                value={r.payment_terms}
                maxLength={2000}
                onChange={(e) => mudar({ payment_terms: e.target.value })}
              />
            </label>
            <label htmlFor="pr-fechamento" className={rotulo}>
              Considerações finais
              <textarea
                id="pr-fechamento"
                rows={3}
                className={campoClasses}
                value={r.closing_notes}
                maxLength={4000}
                onChange={(e) => mudar({ closing_notes: e.target.value })}
              />
            </label>
            <label htmlFor="pr-horas" className="flex items-center gap-2 text-[14px]">
              <input
                id="pr-horas"
                type="checkbox"
                className="accent-terra-texto size-4"
                checked={r.show_hours}
                onChange={(e) => mudar({ show_hours: e.target.checked })}
              />
              Mostrar as horas de cada etapa no documento
            </label>
          </Cartao>
        </fieldset>
      </div>

      <div className="grid gap-4 lg:sticky lg:top-3 lg:max-h-[calc(100dvh-1.5rem)] lg:overflow-y-auto">
        <Cartao className="grid gap-2" data-testid="proposta-resumo">
          <h2 className="font-display text-xl">Investimento</h2>
          {totaisCongelados ? (
            <>
              <Linha rot="Horas" valor={horasTexto(totaisCongelados.horas)} />
              <Linha rot="Total (congelado no envio)" valor={brl(totaisCongelados.total)} forte />
            </>
          ) : (
            <>
              <Linha rot="Horas" valor={horasTexto(calc.horas)} />
              <Linha rot={`Horas × ${brl(valorHora)}`} valor={brl(calc.base)} />
              {r.complexity_factor !== 1 ? (
                <Linha
                  rot={`Fator de complexidade × ${String(r.complexity_factor).replace(".", ",")}`}
                  valor={brl(calc.comComplexidade)}
                />
              ) : null}
              {calc.desconto ? (
                <Linha
                  rot={`Desconto (${String(r.discount_pct).replace(".", ",")}%)`}
                  valor={`− ${brl(calc.desconto)}`}
                />
              ) : null}
              <Linha rot="Total" valor={brl(calc.total)} forte />
              <Linha
                rot={
                  calc.parcelas.length > 1
                    ? `${calc.parcelas.length} parcelas de`
                    : "Pagamento único"
                }
                valor={brl(calc.parcelas.at(-1) ?? 0)}
              />
              {!valorHora ? (
                <p className="text-atencao m-0 text-[13px]">
                  Valor-hora ainda não definido no catálogo.
                </p>
              ) : null}
            </>
          )}
        </Cartao>

        <Cartao className="grid gap-3">
          {editavel ? (
            <div className="flex flex-wrap items-center gap-2">
              <Botao type="button" onClick={salvar} disabled={pendente || !!problema}>
                Salvar rascunho
              </Botao>
              {alterado ? (
                <span className="text-atencao text-[13px]">Alterações não salvas</span>
              ) : null}
            </div>
          ) : null}
          {editavel && problema ? <p className="text-critico m-0 text-sm">{problema}</p> : null}
          <Link
            href={`/admin/propostas/${id}/documento`}
            className="text-terra-texto font-semibold underline"
          >
            Abrir documento para envio
          </Link>

          {podeEditar && status === "draft" ? (
            <div className="flex flex-wrap gap-2">
              <Botao
                type="button"
                variante="secundario"
                disabled={pendente}
                onClick={() => status_("sent")}
              >
                Marcar como enviada
              </Botao>
              <Botao
                type="button"
                variante="secundario"
                disabled={pendente}
                onClick={() => status_("quote")}
              >
                Registrar como só cotação
              </Botao>
            </div>
          ) : null}
          {podeEditar && ehAberta(status) ? (
            <div className="grid gap-3">
              <div className="flex flex-wrap gap-2">
                <Botao type="button" disabled={pendente} onClick={() => status_("accepted")}>
                  Registrar aceite
                </Botao>
                {status !== "sent" ? (
                  <Botao
                    type="button"
                    variante="secundario"
                    disabled={pendente}
                    onClick={() => status_("sent")}
                  >
                    Aguardando retorno
                  </Botao>
                ) : null}
                {status !== "negotiating" ? (
                  <Botao
                    type="button"
                    variante="secundario"
                    disabled={pendente}
                    onClick={() => status_("negotiating")}
                  >
                    Em negociação
                  </Botao>
                ) : null}
                {status !== "quote" ? (
                  <Botao
                    type="button"
                    variante="secundario"
                    disabled={pendente}
                    onClick={() => status_("quote")}
                  >
                    Só cotação
                  </Botao>
                ) : null}
              </div>
              <label htmlFor="pr-motivo" className={rotulo}>
                Motivo (para reprovar ou cancelar)
                <input
                  id="pr-motivo"
                  className={campoClasses}
                  value={motivo}
                  maxLength={500}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Botao
                  type="button"
                  variante="secundario"
                  disabled={pendente}
                  onClick={() => status_("declined")}
                >
                  Registrar recusa do cliente
                </Botao>
                <Botao
                  type="button"
                  variante="secundario"
                  disabled={pendente}
                  onClick={() => status_("cancelled")}
                >
                  Cancelar proposta
                </Botao>
              </div>
            </div>
          ) : null}
          {aviso ? (
            <p
              role="status"
              data-testid="proposta-aviso"
              className={aviso.ok ? "text-ok text-sm" : "text-critico text-sm"}
            >
              {aviso.mensagem}
            </p>
          ) : null}
        </Cartao>

        {editavel ? (
          <Cartao className="grid gap-2">
            <h2 className="font-display text-lg">Logo do cliente</h2>
            {logoVersao ? (
              // eslint-disable-next-line @next/next/no-img-element -- imagem privada servida pela própria rota
              <img
                src={`/admin/propostas/${id}/logo?v=${encodeURIComponent(logoVersao)}`}
                alt="Logo atual do cliente"
                className="max-h-16 w-auto object-contain"
              />
            ) : (
              <p className="text-mudo m-0 text-sm">Sem logo. O documento sai só com a marca JC.</p>
            )}
            <form
              ref={logoForm}
              action={(dados) =>
                iniciar(async () => {
                  const res = await enviarLogo(id, dados);
                  setAviso(res);
                  if (res?.ok) {
                    logoForm.current?.reset();
                    router.refresh();
                  }
                })
              }
              className="flex flex-wrap items-end gap-2"
            >
              <label htmlFor="pr-logo" className={rotulo}>
                PNG, JPG ou WebP, até 2 MB
                <input
                  id="pr-logo"
                  name="logo"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  required
                  className="text-sm font-normal"
                />
              </label>
              <Botao type="submit" variante="secundario" tamanho="pequeno" disabled={pendente}>
                Enviar logo
              </Botao>
            </form>
          </Cartao>
        ) : null}

        {editavel ? (
          <Botao
            type="button"
            variante="secundario"
            tamanho="pequeno"
            disabled={pendente}
            onClick={() => {
              if (window.confirm("Excluir este rascunho de proposta?"))
                iniciar(async () => setAviso(await excluirRascunho(id)));
            }}
          >
            Excluir rascunho
          </Botao>
        ) : null}
      </div>
    </div>
  );
}
