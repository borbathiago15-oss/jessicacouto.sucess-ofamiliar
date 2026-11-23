"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Botao, Cartao, campoClasses } from "@/components/ui";
import {
  calcular,
  fmtNum,
  GRUPOS_CAMPOS,
  lerNumero,
  type CampoFinanceiro,
  type Valores,
} from "@/modules/raiox/calculo";
import {
  FamiliaECaixa,
  GraficoHistorico,
  Kpis,
  PontosDeAtencao,
  TabelaIndicadores,
} from "@/modules/raiox/visao";
import { excluirPeriodo, importarArquivoOffline, salvarPeriodo, type Aviso } from "../../actions";
import { levarAlertaParaMatriz } from "../prioridades/actions";

export type PeriodoTela = {
  id: string | null;
  label: string;
  months: number;
  values: Valores;
  notes: string;
};

function textoInicial(values: Valores): Partial<Record<CampoFinanceiro, string>> {
  const t: Partial<Record<CampoFinanceiro, string>> = {};
  for (const g of GRUPOS_CAMPOS)
    for (const c of g.campos) {
      const v = values[c.k];
      if (v) t[c.k] = c.inteiro ? String(v) : fmtNum.format(v);
    }
  return t;
}

export function EditorRaioX({
  empresaId,
  iniciais,
  podeEditar,
  aviso,
  setAviso,
}: {
  empresaId: string;
  iniciais: PeriodoTela[];
  podeEditar: boolean;
  /** Fica fora do editor: a mensagem sobrevive quando o editor é recriado com dados novos. */
  aviso: Aviso;
  setAviso: (a: Aviso) => void;
}) {
  const router = useRouter();
  const [periodos, setPeriodos] = useState<PeriodoTela[]>(iniciais);
  const [atual, setAtual] = useState(Math.max(0, iniciais.length - 1));
  const [textos, setTextos] = useState(() => iniciais.map((p) => textoInicial(p.values)));
  const [alterado, setAlterado] = useState(false);
  const [novoRotulo, setNovoRotulo] = useState("");
  const [pendente, iniciar] = useTransition();

  const p = periodos[atual];
  const calculados = useMemo(
    () => periodos.map((x) => ({ rotulo: x.label || "Sem nome", r: calcular(x.values, x.months) })),
    [periodos],
  );

  const mudar = (parcial: Partial<PeriodoTela>) => {
    setPeriodos((lista) => lista.map((x, i) => (i === atual ? { ...x, ...parcial } : x)));
    setAlterado(true);
  };

  const digitar = (k: CampoFinanceiro, texto: string) => {
    setTextos((lista) => lista.map((t, i) => (i === atual ? { ...t, [k]: texto } : t)));
    const n = lerNumero(texto);
    const values = { ...p!.values };
    if (n) values[k] = n;
    else delete values[k];
    mudar({ values });
  };

  const adicionar = () => {
    const label = novoRotulo.trim();
    if (!label) return setAviso({ ok: false, mensagem: "Informe o nome do período (ex.: 2025)." });
    if (periodos.some((x) => x.label === label))
      return setAviso({ ok: false, mensagem: "Já existe um período com esse nome." });
    if (alterado) return setAviso({ ok: false, mensagem: "Salve o período atual antes." });
    setPeriodos((lista) => [...lista, { id: null, label, months: 12, values: {}, notes: "" }]);
    setTextos((lista) => [...lista, {}]);
    setAtual(periodos.length);
    setNovoRotulo("");
    setAlterado(true);
    setAviso(null);
  };

  const salvar = () =>
    iniciar(async () => {
      if (!p) return;
      const r = await salvarPeriodo(
        empresaId,
        p.id,
        JSON.stringify({ label: p.label, months: p.months, values: p.values, notes: p.notes }),
      );
      setAviso(r);
      if (r?.ok) {
        if (r.id)
          setPeriodos((lista) => lista.map((x, i) => (i === atual ? { ...x, id: r.id! } : x)));
        setAlterado(false);
      }
    });

  const remover = () =>
    iniciar(async () => {
      if (!p) return;
      if (!window.confirm(`Remover o período “${p.label}” e os valores dele?`)) return;
      if (p.id) {
        const r = await excluirPeriodo(empresaId, p.id);
        setAviso(r);
        if (!r?.ok) return;
      }
      setPeriodos((lista) => lista.filter((_, i) => i !== atual));
      setTextos((lista) => lista.filter((_, i) => i !== atual));
      setAtual((i) => Math.max(0, i - 1));
      setAlterado(false);
    });

  const importar = (form: FormData) =>
    iniciar(async () => {
      const r = await importarArquivoOffline(empresaId, form);
      setAviso(r);
      if (r?.ok) router.refresh();
    });

  const trocar = (i: number) => {
    if (alterado)
      return setAviso({ ok: false, mensagem: "Salve o período atual antes de trocar." });
    setAtual(i);
    setAviso(null);
  };

  return (
    <div className="grid gap-6">
      <Cartao className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Períodos">
          {periodos.map((x, i) => (
            <button
              key={x.id ?? `novo-${i}`}
              type="button"
              role="tab"
              aria-selected={i === atual}
              onClick={() => trocar(i)}
              className={`rounded-full border px-3.5 py-1.5 text-sm ${
                i === atual
                  ? "border-terra bg-blush text-terra-texto font-semibold"
                  : "border-linho bg-papel"
              }`}
            >
              {x.label || "Sem nome"}
            </button>
          ))}
          {periodos.length === 0 ? (
            <span className="text-mudo text-sm">Nenhum período ainda.</span>
          ) : null}
        </div>
        {podeEditar ? (
          <div className="flex flex-wrap items-end gap-3">
            <label htmlFor="novo-periodo" className="grid gap-1 text-[13px] font-semibold">
              Novo período
              <input
                id="novo-periodo"
                className={campoClasses}
                value={novoRotulo}
                maxLength={40}
                placeholder="Ex.: 2025"
                onChange={(e) => setNovoRotulo(e.target.value)}
              />
            </label>
            <Botao type="button" variante="secundario" onClick={adicionar}>
              Adicionar período
            </Botao>
            <form action={importar} className="flex flex-wrap items-end gap-2">
              <label htmlFor="arquivo-offline" className="grid gap-1 text-[13px] font-semibold">
                Importar arquivo do Raio-X offline (.json)
                <input
                  id="arquivo-offline"
                  name="arquivo"
                  type="file"
                  accept="application/json,.json"
                  className="text-sm"
                  required
                />
              </label>
              <Botao type="submit" variante="secundario" disabled={pendente}>
                Importar
              </Botao>
            </form>
          </div>
        ) : null}
        {aviso ? (
          <p
            role="status"
            data-testid="raiox-aviso"
            className={aviso.ok ? "text-ok text-sm" : "text-critico text-sm"}
          >
            {aviso.mensagem}
          </p>
        ) : null}
      </Cartao>

      {p ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
          <Cartao className="grid gap-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <label htmlFor="rotulo" className="grid gap-1 text-[13px] font-semibold">
                Nome do período
                <input
                  id="rotulo"
                  className={campoClasses}
                  value={p.label}
                  maxLength={40}
                  disabled={!podeEditar}
                  onChange={(e) => mudar({ label: e.target.value })}
                />
              </label>
              <label htmlFor="meses" className="grid gap-1 text-[13px] font-semibold">
                Meses
                <input
                  id="meses"
                  type="number"
                  min={1}
                  max={24}
                  className={`${campoClasses} w-24`}
                  value={p.months}
                  disabled={!podeEditar}
                  onChange={(e) =>
                    mudar({ months: Math.min(24, Math.max(1, Number(e.target.value) || 12)) })
                  }
                />
              </label>
            </div>
            <p className="text-mudo m-0 text-[13px]">
              Valores do período, em reais. Pode digitar 1.234.567,89 ou 1234567.
            </p>

            <fieldset disabled={!podeEditar} className="m-0 grid min-w-0 gap-5 border-0 p-0">
              {GRUPOS_CAMPOS.map((g) => (
                <fieldset key={g.titulo} className="m-0 grid min-w-0 gap-2 border-0 p-0">
                  <legend className="font-display text-terra-texto mb-1 text-[17px] font-semibold">
                    {g.titulo}
                  </legend>
                  {g.campos.map((c) => (
                    <div key={c.k} className="grid items-center gap-2.5 sm:grid-cols-[1fr_170px]">
                      <label htmlFor={`c-${c.k}`} className="text-sm">
                        {c.rotulo}
                        {c.ajuda ? (
                          <span className="text-mudo block text-xs">{c.ajuda}</span>
                        ) : null}
                      </label>
                      <input
                        id={`c-${c.k}`}
                        className={`${campoClasses} text-right tabular-nums`}
                        inputMode="decimal"
                        autoComplete="off"
                        placeholder="0"
                        value={textos[atual]?.[c.k] ?? ""}
                        onChange={(e) => digitar(c.k, e.target.value)}
                        onBlur={(e) => {
                          const n = lerNumero(e.target.value);
                          if (n && !c.inteiro)
                            setTextos((lista) =>
                              lista.map((t, i) =>
                                i === atual ? { ...t, [c.k]: fmtNum.format(n) } : t,
                              ),
                            );
                        }}
                      />
                    </div>
                  ))}
                </fieldset>
              ))}
              <label htmlFor="leitura" className="grid gap-1 text-[13px] font-semibold">
                Leitura da consultora (vai para o relatório)
                <textarea
                  id="leitura"
                  rows={6}
                  maxLength={5000}
                  className={campoClasses}
                  value={p.notes}
                  onChange={(e) => mudar({ notes: e.target.value })}
                />
              </label>
            </fieldset>

            {podeEditar ? (
              <div className="flex flex-wrap items-center gap-2">
                <Botao type="button" onClick={salvar} disabled={pendente}>
                  Salvar período
                </Botao>
                <Botao type="button" variante="secundario" onClick={remover} disabled={pendente}>
                  Remover período
                </Botao>
                {alterado ? (
                  <span className="text-atencao text-[13px]">Alterações não salvas</span>
                ) : null}
              </div>
            ) : null}
          </Cartao>

          <div className="grid gap-4 lg:sticky lg:top-3">
            <Cartao className="grid gap-3">
              <h2 className="font-display text-xl">Indicadores · {p.label || "Sem nome"}</h2>
              <Kpis r={calculados[atual]!.r} />
            </Cartao>
            <Cartao className="grid gap-3">
              <h2 className="font-display text-xl">Família e caixa</h2>
              <FamiliaECaixa r={calculados[atual]!.r} />
            </Cartao>
            <Cartao className="grid gap-3">
              <h2 className="font-display text-xl">Pontos de atenção</h2>
              <PontosDeAtencao
                r={calculados[atual]!.r}
                acao={
                  podeEditar
                    ? (a) => (
                        <button
                          type="button"
                          className="underline"
                          disabled={pendente}
                          onClick={() =>
                            iniciar(async () => setAviso(await levarAlertaParaMatriz(empresaId, a)))
                          }
                        >
                          Levar para a Matriz de Prioridades
                          <span className="sr-only">: {a.titulo}</span>
                        </button>
                      )
                    : undefined
                }
              />
              <p className="text-mudo m-0 text-[12.5px]">
                Referências gerais de mercado. A leitura final é sua, conforme o setor e a história
                da empresa.
              </p>
            </Cartao>
          </div>
        </div>
      ) : null}

      {periodos.length > 0 ? (
        <Cartao className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl">Histórico da empresa</h2>
            <Link
              href={`/admin/empresas/${empresaId}/raio-x/relatorio`}
              className="text-terra-texto font-semibold underline"
            >
              Abrir relatório para imprimir
            </Link>
          </div>
          <GraficoHistorico periodos={calculados} />
          <TabelaIndicadores periodos={calculados} comVariacao />
        </Cartao>
      ) : null}
    </div>
  );
}
