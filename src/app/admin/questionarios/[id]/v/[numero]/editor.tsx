"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Botao, Cartao, Selo, campoClasses } from "@/components/ui";
import {
  definicaoSchema,
  primeiroProblema,
  proximasTransicoes,
  ROTULO_ACAO,
  ROTULO_STATUS_VERSAO,
  ROTULO_TIPO,
  temAlternativas,
  TIPOS_PERGUNTA,
  type Definicao,
  type Dimensao,
  type Pergunta,
  type StatusVersao,
  type TipoPergunta,
} from "@/modules/questionnaires/schema";
import { mudarStatus, salvarDefinicao, type Aviso } from "../../../actions";
import { Previa } from "./previa";

type Props = {
  questionarioId: string;
  versaoId: string;
  inicial: Definicao;
  status: StatusVersao;
  podeEditar: boolean;
  podePublicar: boolean;
};

const rotulo = "grid gap-1 text-[13px] font-semibold";

function novaChave(prefixo: string, existentes: string[]) {
  let n = existentes.length + 1;
  while (existentes.includes(`${prefixo}${n}`)) n++;
  return `${prefixo}${n}`;
}

function mover<T>(lista: T[], i: number, d: -1 | 1): T[] {
  const nova = [...lista];
  const [x] = nova.splice(i, 1);
  if (x !== undefined) nova.splice(i + d, 0, x);
  return nova;
}

export function EditorVersao({
  questionarioId,
  versaoId,
  inicial,
  status: statusInicial,
  podeEditar,
  podePublicar,
}: Props) {
  const router = useRouter();
  const [def, setDef] = useState<Definicao>(inicial);
  const [status, setStatus] = useState<StatusVersao>(statusInicial);
  const [alterado, setAlterado] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendente, iniciar] = useTransition();

  const editavel = podeEditar && (status === "draft" || status === "review");
  const validacao = definicaoSchema.safeParse(def);
  const problema = validacao.success ? null : primeiroProblema(validacao.error);
  const transicoes = proximasTransicoes(status, { editar: podeEditar, publicar: podePublicar });
  const [rotuloStatus, tom] = ROTULO_STATUS_VERSAO[status];

  const alterar = (f: (d: Definicao) => Definicao) => {
    setDef(f);
    setAlterado(true);
  };
  const setPergunta = (i: number, q: Pergunta) =>
    alterar((d) => ({ ...d, questions: d.questions.map((x, k) => (k === i ? q : x)) }));
  const setDimensao = (i: number, x: Dimensao) =>
    alterar((d) => ({ ...d, dimensions: d.dimensions.map((y, k) => (k === i ? x : y)) }));

  const salvar = () =>
    iniciar(async () => {
      const r = await salvarDefinicao(versaoId, JSON.stringify(def));
      setAviso(r);
      if (r?.ok) setAlterado(false);
    });

  const transicionar = (alvo: StatusVersao) =>
    iniciar(async () => {
      if (alterado) {
        setAviso({ ok: false, mensagem: "Salve o rascunho antes de mudar o status." });
        return;
      }
      const r = await mudarStatus(questionarioId, versaoId, alvo);
      setAviso(r);
      if (r?.ok) {
        setStatus(alvo);
        router.refresh();
      }
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
      <div className="grid gap-4">
        <Cartao className="sticky top-3 z-10 grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Selo tom={tom}>{rotuloStatus}</Selo>
            {alterado ? (
              <span className="text-atencao text-[13px]">Alterações não salvas</span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {editavel ? (
              <Botao type="button" onClick={salvar} disabled={pendente || !!problema}>
                Salvar rascunho
              </Botao>
            ) : null}
            {transicoes.map((t) => (
              <Botao
                key={t}
                type="button"
                variante="secundario"
                disabled={pendente}
                onClick={() => transicionar(t)}
              >
                {ROTULO_ACAO[t]}
              </Botao>
            ))}
          </div>
          {editavel && problema ? (
            <p className="text-critico text-sm" data-testid="editor-problema">
              {problema}
            </p>
          ) : null}
          {aviso ? (
            <p
              role="status"
              data-testid="editor-aviso"
              className={aviso.ok ? "text-ok text-sm" : "text-critico text-sm"}
            >
              {aviso.mensagem}
            </p>
          ) : null}
          {!editavel ? (
            <p className="text-mudo text-[13px]">
              {status === "draft" || status === "review"
                ? "Você pode ver, mas não editar esta versão."
                : "Esta versão não pode mais ser alterada. Para ajustar, crie uma nova versão."}
            </p>
          ) : null}
        </Cartao>

        <fieldset disabled={!editavel} className="m-0 grid min-w-0 gap-4 border-0 p-0">
          <Cartao className="grid gap-3">
            <h2 className="font-display text-xl">Dimensões</h2>
            {def.dimensions.length === 0 ? (
              <p className="text-mudo text-sm">Opcional: agrupe perguntas por dimensão.</p>
            ) : null}
            {def.dimensions.map((d, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
                <label htmlFor={`d${i}-key`} className={rotulo}>
                  Identificador
                  <input
                    id={`d${i}-key`}
                    className={campoClasses}
                    value={d.key}
                    onChange={(e) => setDimensao(i, { ...d, key: e.target.value })}
                  />
                </label>
                <label htmlFor={`d${i}-titulo`} className={rotulo}>
                  Título
                  <input
                    id={`d${i}-titulo`}
                    className={campoClasses}
                    value={d.title}
                    onChange={(e) => setDimensao(i, { ...d, title: e.target.value })}
                  />
                </label>
                <Botao
                  type="button"
                  variante="secundario"
                  tamanho="pequeno"
                  onClick={() =>
                    alterar((x) => ({
                      dimensions: x.dimensions.filter((_, k) => k !== i),
                      questions: x.questions.map((q) =>
                        q.dimension === d.key ? { ...q, dimension: null } : q,
                      ),
                    }))
                  }
                >
                  Remover
                </Botao>
              </div>
            ))}
            <div>
              <Botao
                type="button"
                variante="secundario"
                tamanho="pequeno"
                onClick={() =>
                  alterar((x) => ({
                    ...x,
                    dimensions: [
                      ...x.dimensions,
                      {
                        key: novaChave(
                          "dimensao_",
                          x.dimensions.map((y) => y.key),
                        ),
                        title: "Nova dimensão",
                        description: null,
                      },
                    ],
                  }))
                }
              >
                Adicionar dimensão
              </Botao>
            </div>
          </Cartao>

          {def.questions.map((q, i) => (
            <EditorPergunta
              key={i}
              i={i}
              q={q}
              total={def.questions.length}
              anteriores={def.questions.slice(0, i).filter((p) => temAlternativas(p.kind))}
              dimensoes={def.dimensions}
              onChange={(nova) => setPergunta(i, nova)}
              onMover={(dir) => alterar((x) => ({ ...x, questions: mover(x.questions, i, dir) }))}
              onRemover={() =>
                alterar((x) => ({ ...x, questions: x.questions.filter((_, k) => k !== i) }))
              }
            />
          ))}
          <div>
            <Botao
              type="button"
              variante="secundario"
              onClick={() =>
                alterar((x) => ({
                  ...x,
                  questions: [
                    ...x.questions,
                    {
                      key: novaChave(
                        "p",
                        x.questions.map((y) => y.key),
                      ),
                      dimension: null,
                      prompt: "Nova pergunta",
                      help_text: null,
                      kind: "single_choice",
                      is_required: true,
                      condition: null,
                      options: [
                        { label: "Sim", value: 1, is_not_applicable: false },
                        { label: "Não", value: 0, is_not_applicable: false },
                      ],
                    },
                  ],
                }))
              }
            >
              Adicionar pergunta
            </Botao>
          </div>
        </fieldset>
      </div>

      <Cartao className="grid gap-3 lg:sticky lg:top-3">
        <h2 className="font-display text-xl">Prévia</h2>
        <Previa def={def} />
      </Cartao>
    </div>
  );
}

function EditorPergunta({
  i,
  q,
  total,
  anteriores,
  dimensoes,
  onChange,
  onMover,
  onRemover,
}: {
  i: number;
  q: Pergunta;
  total: number;
  anteriores: Pergunta[];
  dimensoes: Dimensao[];
  onChange: (q: Pergunta) => void;
  onMover: (d: -1 | 1) => void;
  onRemover: () => void;
}) {
  const id = `q${i}`;
  const origem = anteriores.find((p) => p.key === q.condition?.question);

  const mudarTipo = (kind: TipoPergunta) => {
    if (!temAlternativas(kind)) return onChange({ ...q, kind, options: [] });
    const options =
      q.options.length >= 2
        ? q.options
        : [
            { label: "Opção 1", value: 1, is_not_applicable: false },
            { label: "Opção 2", value: 2, is_not_applicable: false },
          ];
    onChange({ ...q, kind, options });
  };

  return (
    <Cartao className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg">Pergunta {i + 1}</h3>
        <div className="flex gap-1.5">
          <Botao
            type="button"
            variante="secundario"
            tamanho="pequeno"
            disabled={i === 0}
            onClick={() => onMover(-1)}
          >
            Subir
          </Botao>
          <Botao
            type="button"
            variante="secundario"
            tamanho="pequeno"
            disabled={i === total - 1}
            onClick={() => onMover(1)}
          >
            Descer
          </Botao>
          <Botao type="button" variante="secundario" tamanho="pequeno" onClick={onRemover}>
            Remover
          </Botao>
        </div>
      </div>

      <label htmlFor={`${id}-prompt`} className={rotulo}>
        Enunciado
        <textarea
          id={`${id}-prompt`}
          rows={2}
          className={campoClasses}
          value={q.prompt}
          onChange={(e) => onChange({ ...q, prompt: e.target.value })}
        />
      </label>
      <label htmlFor={`${id}-ajuda`} className={rotulo}>
        Texto de apoio (opcional)
        <input
          id={`${id}-ajuda`}
          className={campoClasses}
          value={q.help_text ?? ""}
          onChange={(e) => onChange({ ...q, help_text: e.target.value || null })}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label htmlFor={`${id}-key`} className={rotulo}>
          Identificador
          <input
            id={`${id}-key`}
            className={campoClasses}
            value={q.key}
            onChange={(e) => onChange({ ...q, key: e.target.value })}
          />
        </label>
        <label htmlFor={`${id}-tipo`} className={rotulo}>
          Tipo
          <select
            id={`${id}-tipo`}
            className={campoClasses}
            value={q.kind}
            onChange={(e) => mudarTipo(e.target.value as TipoPergunta)}
          >
            {TIPOS_PERGUNTA.map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO[t]}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-dim`} className={rotulo}>
          Dimensão
          <select
            id={`${id}-dim`}
            className={campoClasses}
            value={q.dimension ?? ""}
            onChange={(e) => onChange({ ...q, dimension: e.target.value || null })}
          >
            <option value="">Nenhuma</option>
            {dimensoes.map((d) => (
              <option key={d.key} value={d.key}>
                {d.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label htmlFor={`${id}-obrigatoria`} className="flex items-center gap-2 text-[14px]">
        <input
          id={`${id}-obrigatoria`}
          type="checkbox"
          className="accent-terra-texto size-4"
          checked={q.is_required}
          onChange={(e) => onChange({ ...q, is_required: e.target.checked })}
        />
        Resposta obrigatória
      </label>

      {temAlternativas(q.kind) ? (
        <fieldset className="border-linho grid min-w-0 gap-2 rounded-[var(--radius-campo)] border p-3">
          <legend className="px-1 text-[13px] font-semibold">Alternativas</legend>
          {q.options.map((o, k) => (
            <div key={k} className="grid gap-2 sm:grid-cols-[1fr_6rem_auto_auto] sm:items-end">
              <label htmlFor={`${id}-o${k}`} className={rotulo}>
                Texto
                <input
                  id={`${id}-o${k}`}
                  className={campoClasses}
                  value={o.label}
                  onChange={(e) =>
                    onChange({
                      ...q,
                      options: q.options.map((x, j) =>
                        j === k ? { ...x, label: e.target.value } : x,
                      ),
                    })
                  }
                />
              </label>
              <label htmlFor={`${id}-o${k}-valor`} className={rotulo}>
                Valor
                <input
                  id={`${id}-o${k}-valor`}
                  type="number"
                  step="any"
                  className={campoClasses}
                  value={o.value ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...q,
                      options: q.options.map((x, j) =>
                        j === k
                          ? { ...x, value: e.target.value === "" ? null : Number(e.target.value) }
                          : x,
                      ),
                    })
                  }
                />
              </label>
              <label
                htmlFor={`${id}-o${k}-na`}
                className="flex items-center gap-1.5 pb-2.5 text-[13px]"
              >
                <input
                  id={`${id}-o${k}-na`}
                  type="checkbox"
                  className="accent-terra-texto size-4"
                  checked={o.is_not_applicable}
                  onChange={(e) =>
                    onChange({
                      ...q,
                      options: q.options.map((x, j) =>
                        j === k ? { ...x, is_not_applicable: e.target.checked } : x,
                      ),
                    })
                  }
                />
                Não se aplica
              </label>
              <Botao
                type="button"
                variante="secundario"
                tamanho="pequeno"
                aria-label={`Remover alternativa ${k + 1}`}
                onClick={() => onChange({ ...q, options: q.options.filter((_, j) => j !== k) })}
              >
                Remover
              </Botao>
            </div>
          ))}
          <div>
            <Botao
              type="button"
              variante="secundario"
              tamanho="pequeno"
              onClick={() =>
                onChange({
                  ...q,
                  options: [
                    ...q.options,
                    {
                      label: `Opção ${q.options.length + 1}`,
                      value: q.options.length + 1,
                      is_not_applicable: false,
                    },
                  ],
                })
              }
            >
              Adicionar alternativa
            </Botao>
          </div>
        </fieldset>
      ) : null}

      {anteriores.length > 0 ? (
        <fieldset className="border-linho grid min-w-0 gap-2 rounded-[var(--radius-campo)] border p-3">
          <legend className="px-1 text-[13px] font-semibold">Mostrar somente se</legend>
          <label htmlFor={`${id}-cond`} className={rotulo}>
            Pergunta anterior
            <select
              id={`${id}-cond`}
              className={campoClasses}
              value={q.condition?.question ?? ""}
              onChange={(e) =>
                onChange({
                  ...q,
                  condition: e.target.value ? { question: e.target.value, any_of: [] } : null,
                })
              }
            >
              <option value="">Sempre mostrar</option>
              {anteriores.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.key} · {p.prompt.slice(0, 60)}
                </option>
              ))}
            </select>
          </label>
          {origem && q.condition ? (
            <div className="grid gap-1">
              <span className="text-[13px] font-semibold">Quando a resposta for</span>
              {origem.options.map((o, k) => (
                <label
                  key={o.label}
                  htmlFor={`${id}-cond-${k}`}
                  className="flex items-center gap-2 text-[14px]"
                >
                  <input
                    id={`${id}-cond-${k}`}
                    type="checkbox"
                    className="accent-terra-texto size-4"
                    checked={q.condition!.any_of.includes(o.label)}
                    onChange={(e) =>
                      onChange({
                        ...q,
                        condition: {
                          question: q.condition!.question,
                          any_of: e.target.checked
                            ? [...q.condition!.any_of, o.label]
                            : q.condition!.any_of.filter((a) => a !== o.label),
                        },
                      })
                    }
                  />
                  {o.label}
                </label>
              ))}
            </div>
          ) : null}
        </fieldset>
      ) : null}
    </Cartao>
  );
}
