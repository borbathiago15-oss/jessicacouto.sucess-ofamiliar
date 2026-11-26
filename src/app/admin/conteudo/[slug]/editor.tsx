"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Blocos, urlMidia } from "@/components/site/blocos";
import { ROTULO_TEMA, TEMAS, type ArtigoMeta, type Tema } from "@/modules/cms/artigos";
import { Botao, Cartao, Selo, campoClasses } from "@/components/ui";
import {
  ICONES_PERFIL,
  ROTULO_BLOCO,
  ROTULO_ICONE_PERFIL,
  blocoVazio,
  type Bloco,
  type Conteudo,
  type TipoBloco,
} from "@/modules/cms/schema";
import {
  enviarImagem,
  enviarParaRevisao,
  publicar,
  salvarRascunho,
  type Resultado,
} from "../actions";
import { ROTULO_STATUS } from "../status";

type Props = {
  slug: string;
  rota: string;
  inicial: Conteudo;
  statusInicial: string | null;
  versaoInicial: number | null;
  podeEditar: boolean;
  podePublicar: boolean;
  /** Ações do CMS; por padrão, as das páginas do site. Artigos passam as próprias. */
  acoes?: AcoesCms;
  /** Quando presente, o editor também edita resumo, tema e capa do artigo. */
  artigo?: ArtigoMeta;
};

export type AcoesCms = {
  salvar: (slug: string, json: string) => Promise<Resultado>;
  revisar: (slug: string) => Promise<Resultado>;
  publicar: (slug: string) => Promise<Resultado>;
  enviarImagem: (
    slug: string,
    fd: FormData,
  ) => Promise<{ ok: true; path: string } | { ok: false; mensagem: string }>;
};

const rotuloCampo = "grid gap-1 text-[13px] font-semibold";

function Texto({
  rotulo,
  valor,
  onChange,
  longo,
  id,
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  longo?: boolean;
  id: string;
}) {
  return (
    <label htmlFor={id} className={rotuloCampo}>
      {rotulo}
      {longo ? (
        <textarea
          id={id}
          rows={3}
          className={campoClasses}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          className={campoClasses}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

function opcional(v: string) {
  return v.trim() ? v : undefined;
}

export function Editor({
  slug,
  rota,
  inicial,
  statusInicial,
  versaoInicial,
  podeEditar,
  podePublicar,
  acoes = { salvar: salvarRascunho, revisar: enviarParaRevisao, publicar, enviarImagem },
  artigo,
}: Props) {
  const [blocos, setBlocos] = useState<Bloco[]>(inicial.blocos);
  const [meta, setMeta] = useState<ArtigoMeta | undefined>(artigo);
  const mudarMeta = (m: Partial<ArtigoMeta>) => {
    setMeta((x) => (x ? { ...x, ...m } : x));
    setAlterado(true);
  };
  const [status, setStatus] = useState(statusInicial);
  const [versao, setVersao] = useState(versaoInicial);
  const [alterado, setAlterado] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [novoTipo, setNovoTipo] = useState<TipoBloco>("texto");
  const [pendente, iniciar] = useTransition();

  const atualizar = (i: number, b: Bloco) => {
    setBlocos((atual) => atual.map((x, k) => (k === i ? b : x)));
    setAlterado(true);
  };
  const mover = (i: number, d: -1 | 1) => {
    setBlocos((atual) => {
      const novo = [...atual];
      const [b] = novo.splice(i, 1);
      if (b) novo.splice(i + d, 0, b);
      return novo;
    });
    setAlterado(true);
  };
  const remover = (i: number) => {
    setBlocos((atual) => atual.filter((_, k) => k !== i));
    setAlterado(true);
  };

  function aplicar(r: Resultado) {
    setAviso({ ok: r.ok, texto: r.mensagem });
    if (r.ok) {
      setStatus(r.status);
      setVersao(r.versao);
      setAlterado(false);
    }
  }

  const salvar = () =>
    iniciar(async () =>
      aplicar(
        await acoes.salvar(slug, JSON.stringify(meta ? { blocos, artigo: meta } : { blocos })),
      ),
    );
  const revisar = () => iniciar(async () => aplicar(await acoes.revisar(slug)));
  const publicarAgora = () => iniciar(async () => aplicar(await acoes.publicar(slug)));

  async function subirImagem(arquivo: File | undefined, aoEnviar: (path: string) => void) {
    if (!arquivo) return;
    const fd = new FormData();
    fd.set("arquivo", arquivo);
    const r = await acoes.enviarImagem(slug, fd);
    if (r.ok) aoEnviar(r.path);
    else setAviso({ ok: false, texto: r.mensagem });
  }

  const [rotuloStatus, tomStatus] = ROTULO_STATUS[status ?? ""] ?? [
    "Sem versão",
    "neutro" as const,
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <div className="grid gap-4">
        <Cartao className="sticky top-3 z-10 grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <Selo tom={tomStatus}>{rotuloStatus}</Selo>
              {versao ? <span className="text-mudo text-sm">versão {versao}</span> : null}
              {alterado ? (
                <span className="text-atencao text-sm font-semibold">alterações não salvas</span>
              ) : null}
            </span>
            <a
              href={rota}
              target="_blank"
              rel="noopener noreferrer"
              className="text-terra-texto text-sm underline"
            >
              Ver página publicada
            </a>
          </div>
          <div className="flex flex-wrap gap-2">
            <Botao
              type="button"
              tamanho="pequeno"
              onClick={salvar}
              disabled={!podeEditar || pendente}
            >
              Salvar rascunho
            </Botao>
            <Botao
              type="button"
              tamanho="pequeno"
              variante="secundario"
              onClick={revisar}
              disabled={!podeEditar || pendente || alterado || status !== "draft"}
            >
              Enviar para revisão
            </Botao>
            {podePublicar ? (
              <Botao
                type="button"
                tamanho="pequeno"
                variante="secundario"
                onClick={publicarAgora}
                disabled={pendente || alterado || status !== "in_review"}
              >
                Publicar
              </Botao>
            ) : null}
          </div>
          {aviso ? (
            <p
              role={aviso.ok ? "status" : "alert"}
              data-testid="editor-aviso"
              className={
                aviso.ok ? "text-ok text-sm font-semibold" : "text-critico text-sm font-semibold"
              }
            >
              {aviso.texto}
            </p>
          ) : null}
          {!podeEditar ? (
            <p className="text-mudo text-sm">Você pode ver, mas não editar este conteúdo.</p>
          ) : null}
        </Cartao>

        {meta ? (
          <Cartao className="grid gap-3" aria-label="Dados do artigo">
            <b className="font-display text-lg">Dados do artigo</b>
            <label htmlFor="art-resumo" className={rotuloCampo}>
              Resumo (aparece na lista de artigos e no Google; até 300 caracteres)
              <textarea
                id="art-resumo"
                rows={3}
                maxLength={300}
                className={campoClasses}
                value={meta.resumo}
                onChange={(e) => mudarMeta({ resumo: e.target.value })}
              />
            </label>
            <label htmlFor="art-tema" className={rotuloCampo}>
              Tema
              <select
                id="art-tema"
                className={campoClasses}
                value={meta.tema}
                onChange={(e) => mudarMeta({ tema: e.target.value as Tema })}
              >
                {TEMAS.map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_TEMA[t]}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="art-capa" className={rotuloCampo}>
              Imagem de capa (opcional; JPG, PNG ou WebP até 5 MB)
              <input
                id="art-capa"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="text-sm font-normal"
                onChange={(e) =>
                  subirImagem(e.target.files?.[0], (path) =>
                    mudarMeta({
                      capa: {
                        path,
                        alt: (meta.capa?.alt ?? meta.resumo.slice(0, 200)) || "Capa do artigo",
                      },
                    }),
                  )
                }
              />
            </label>
            {meta.capa ? (
              <div className="grid gap-2">
                <label htmlFor="art-capa-alt" className={rotuloCampo}>
                  Descrição da imagem (para leitores de tela)
                  <input
                    id="art-capa-alt"
                    maxLength={200}
                    className={campoClasses}
                    value={meta.capa.alt}
                    onChange={(e) =>
                      mudarMeta({ capa: { path: meta.capa!.path, alt: e.target.value } })
                    }
                  />
                </label>
                <div>
                  <Botao
                    type="button"
                    tamanho="pequeno"
                    variante="secundario"
                    onClick={() => mudarMeta({ capa: undefined })}
                  >
                    Remover capa
                  </Botao>
                </div>
              </div>
            ) : null}
          </Cartao>
        ) : null}

        {blocos.map((b, i) => (
          <Cartao
            key={i}
            className="grid gap-3"
            aria-label={`Bloco ${i + 1}: ${ROTULO_BLOCO[b.tipo]}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <b className="font-display text-lg">
                {i + 1}. {ROTULO_BLOCO[b.tipo]}
              </b>
              <span className="flex gap-1">
                <Botao
                  type="button"
                  tamanho="pequeno"
                  variante="secundario"
                  onClick={() => mover(i, -1)}
                  disabled={i === 0}
                  aria-label={`Subir bloco ${i + 1}`}
                >
                  Subir
                </Botao>
                <Botao
                  type="button"
                  tamanho="pequeno"
                  variante="secundario"
                  onClick={() => mover(i, 1)}
                  disabled={i === blocos.length - 1}
                  aria-label={`Descer bloco ${i + 1}`}
                >
                  Descer
                </Botao>
                <Botao
                  type="button"
                  tamanho="pequeno"
                  variante="secundario"
                  onClick={() => remover(i)}
                  aria-label={`Remover bloco ${i + 1}`}
                >
                  Remover
                </Botao>
              </span>
            </div>
            <CamposBloco
              id={`b${i}`}
              bloco={b}
              onChange={(nb) => atualizar(i, nb)}
              onImagem={(arquivo, aoEnviar) => subirImagem(arquivo, aoEnviar)}
            />
          </Cartao>
        ))}

        <Cartao superficie="blush" className="flex flex-wrap items-end gap-3">
          <label htmlFor="novo-bloco" className={rotuloCampo}>
            Novo bloco
            <select
              id="novo-bloco"
              className={campoClasses}
              value={novoTipo}
              onChange={(e) => setNovoTipo(e.target.value as TipoBloco)}
            >
              {(Object.keys(ROTULO_BLOCO) as TipoBloco[]).map((t) => (
                <option key={t} value={t}>
                  {ROTULO_BLOCO[t]}
                </option>
              ))}
            </select>
          </label>
          <Botao
            type="button"
            tamanho="pequeno"
            onClick={() => {
              setBlocos((a) => [...a, blocoVazio(novoTipo)]);
              setAlterado(true);
            }}
          >
            Adicionar bloco
          </Botao>
        </Cartao>
      </div>

      <section
        aria-label="Prévia"
        className="border-linho bg-porcelana grid gap-3 rounded-[var(--radius-cartao)] border p-5"
      >
        <span className="text-mudo text-[13px] font-semibold">Prévia (não publicada)</span>
        <div className="bg-papel grid gap-6 rounded-2xl p-5">
          {meta ? (
            <div className="grid gap-3">
              <span className="text-terra-texto text-[12.5px] font-semibold">
                {ROTULO_TEMA[meta.tema]}
              </span>
              <p className="text-mudo m-0 text-lg">{meta.resumo}</p>
              {meta.capa ? (
                // eslint-disable-next-line @next/next/no-img-element -- prévia de mídia privada
                <img
                  src={urlMidia(meta.capa.path, "/admin/midia")}
                  alt={meta.capa.alt}
                  className="max-h-64 w-full rounded-2xl object-cover"
                />
              ) : null}
            </div>
          ) : null}
          <Blocos blocos={blocos} midiaBase="/admin/midia" />
        </div>
      </section>
    </div>
  );
}

function CamposBloco({
  id,
  bloco: b,
  onChange,
  onImagem,
}: {
  id: string;
  bloco: Bloco;
  onChange: (b: Bloco) => void;
  onImagem: (arquivo: File | undefined, aoEnviar: (path: string) => void) => void;
}) {
  const imagemInput = (rotulo: string, aoEnviar: (path: string) => void): ReactNode => (
    <label htmlFor={`${id}-img`} className={rotuloCampo}>
      {rotulo}
      <input
        id={`${id}-img`}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="text-sm"
        onChange={(e) => onImagem(e.target.files?.[0], aoEnviar)}
      />
    </label>
  );

  switch (b.tipo) {
    case "hero":
      return (
        <div className="grid gap-3">
          <Texto
            id={`${id}-chamada`}
            rotulo="Chamada (opcional)"
            valor={b.chamada ?? ""}
            onChange={(v) => onChange({ ...b, chamada: opcional(v) })}
          />
          <Texto
            id={`${id}-titulo`}
            rotulo="Título"
            valor={b.titulo}
            onChange={(v) => onChange({ ...b, titulo: v })}
          />
          <Texto
            id={`${id}-texto`}
            rotulo="Texto de apoio (opcional)"
            longo
            valor={b.texto ?? ""}
            onChange={(v) => onChange({ ...b, texto: opcional(v) })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Texto
              id={`${id}-cta1r`}
              rotulo="Botão principal"
              valor={b.ctaPrimario?.rotulo ?? ""}
              onChange={(v) =>
                onChange({
                  ...b,
                  ctaPrimario: v
                    ? { rotulo: v, href: b.ctaPrimario?.href ?? "/diagnosticos" }
                    : undefined,
                })
              }
            />
            <Texto
              id={`${id}-cta1h`}
              rotulo="Link do botão principal"
              valor={b.ctaPrimario?.href ?? ""}
              onChange={(v) =>
                onChange({
                  ...b,
                  ctaPrimario: { rotulo: b.ctaPrimario?.rotulo ?? "Saiba mais", href: v },
                })
              }
            />
            <Texto
              id={`${id}-cta2r`}
              rotulo="Botão secundário"
              valor={b.ctaSecundario?.rotulo ?? ""}
              onChange={(v) =>
                onChange({
                  ...b,
                  ctaSecundario: v
                    ? { rotulo: v, href: b.ctaSecundario?.href ?? "/guias" }
                    : undefined,
                })
              }
            />
            <Texto
              id={`${id}-cta2h`}
              rotulo="Link do botão secundário"
              valor={b.ctaSecundario?.href ?? ""}
              onChange={(v) =>
                onChange({
                  ...b,
                  ctaSecundario: { rotulo: b.ctaSecundario?.rotulo ?? "Saiba mais", href: v },
                })
              }
            />
          </div>
          {imagemInput("Foto (somente fotos reais e autorizadas)", (path) =>
            onChange({ ...b, imagem: { path, alt: b.imagem?.alt ?? "Jéssica Couto" } }),
          )}
          {b.imagem ? (
            <div className="flex flex-wrap items-end gap-3">
              <Texto
                id={`${id}-alt`}
                rotulo="Descrição da foto"
                valor={b.imagem.alt}
                onChange={(v) => onChange({ ...b, imagem: { path: b.imagem!.path, alt: v } })}
              />
              <Botao
                type="button"
                tamanho="pequeno"
                variante="secundario"
                onClick={() => onChange({ ...b, imagem: undefined })}
              >
                Remover foto
              </Botao>
            </div>
          ) : null}
        </div>
      );
    case "texto":
      return (
        <div className="grid gap-3">
          <Texto
            id={`${id}-titulo`}
            rotulo="Título (opcional)"
            valor={b.titulo ?? ""}
            onChange={(v) => onChange({ ...b, titulo: opcional(v) })}
          />
          <Texto
            id={`${id}-pars`}
            rotulo="Parágrafos (separe com uma linha em branco)"
            longo
            valor={b.paragrafos.join("\n\n")}
            onChange={(v) =>
              onChange({
                ...b,
                paragrafos: v
                  .split(/\n\s*\n/)
                  .map((p) => p.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
      );
    case "movimentos":
      return (
        <div className="grid gap-3">
          <Texto
            id={`${id}-titulo`}
            rotulo="Título"
            valor={b.titulo}
            onChange={(v) => onChange({ ...b, titulo: v })}
          />
          {b.itens.map((it, k) => (
            <div key={k} className="grid gap-2 sm:grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)]">
              <Texto
                id={`${id}-n${k}`}
                rotulo={`Movimento ${k + 1}`}
                valor={it.nome}
                onChange={(v) =>
                  onChange({
                    ...b,
                    itens: b.itens.map((x, j) => (j === k ? { ...x, nome: v } : x)),
                  })
                }
              />
              <Texto
                id={`${id}-d${k}`}
                rotulo="Descrição"
                valor={it.descricao}
                onChange={(v) =>
                  onChange({
                    ...b,
                    itens: b.itens.map((x, j) => (j === k ? { ...x, descricao: v } : x)),
                  })
                }
              />
            </div>
          ))}
          <div className="flex gap-2">
            <Botao
              type="button"
              tamanho="pequeno"
              variante="secundario"
              onClick={() =>
                onChange({ ...b, itens: [...b.itens, { nome: "Novo", descricao: "Descrição" }] })
              }
              disabled={b.itens.length >= 8}
            >
              Adicionar item
            </Botao>
            <Botao
              type="button"
              tamanho="pequeno"
              variante="secundario"
              onClick={() => onChange({ ...b, itens: b.itens.slice(0, -1) })}
              disabled={b.itens.length <= 1}
            >
              Remover último
            </Botao>
          </div>
        </div>
      );
    case "caminhos":
      return (
        <div className="grid gap-3">
          <Texto
            id={`${id}-titulo`}
            rotulo="Título"
            valor={b.titulo}
            onChange={(v) => onChange({ ...b, titulo: v })}
          />
          <Texto
            id={`${id}-texto`}
            rotulo="Texto (opcional)"
            valor={b.texto ?? ""}
            onChange={(v) => onChange({ ...b, texto: opcional(v) })}
          />
          {b.itens.map((it, k) => (
            <div key={k} className="grid gap-2 sm:grid-cols-4">
              <Texto
                id={`${id}-t${k}`}
                rotulo={`Caminho ${k + 1}`}
                valor={it.titulo}
                onChange={(v) =>
                  onChange({
                    ...b,
                    itens: b.itens.map((x, j) => (j === k ? { ...x, titulo: v } : x)),
                  })
                }
              />
              <Texto
                id={`${id}-d${k}`}
                rotulo="Descrição"
                valor={it.descricao}
                onChange={(v) =>
                  onChange({
                    ...b,
                    itens: b.itens.map((x, j) => (j === k ? { ...x, descricao: v } : x)),
                  })
                }
              />
              <Texto
                id={`${id}-h${k}`}
                rotulo="Link"
                valor={it.href}
                onChange={(v) =>
                  onChange({
                    ...b,
                    itens: b.itens.map((x, j) => (j === k ? { ...x, href: v } : x)),
                  })
                }
              />
              <Texto
                id={`${id}-l${k}`}
                rotulo="Texto do link (opcional)"
                valor={it.rotulo ?? ""}
                onChange={(v) =>
                  onChange({
                    ...b,
                    itens: b.itens.map((x, j) => (j === k ? { ...x, rotulo: opcional(v) } : x)),
                  })
                }
              />
            </div>
          ))}
          <div className="flex gap-2">
            <Botao
              type="button"
              tamanho="pequeno"
              variante="secundario"
              onClick={() =>
                onChange({
                  ...b,
                  itens: [
                    ...b.itens,
                    { titulo: "Novo", descricao: "Descrição", href: "/diagnosticos" },
                  ],
                })
              }
              disabled={b.itens.length >= 4}
            >
              Adicionar caminho
            </Botao>
            <Botao
              type="button"
              tamanho="pequeno"
              variante="secundario"
              onClick={() => onChange({ ...b, itens: b.itens.slice(0, -1) })}
              disabled={b.itens.length <= 1}
            >
              Remover último
            </Botao>
          </div>
        </div>
      );
    case "servicos":
      return (
        <div className="grid gap-3">
          <Texto
            id={`${id}-titulo`}
            rotulo="Título"
            valor={b.titulo}
            onChange={(v) => onChange({ ...b, titulo: v })}
          />
          <Texto
            id={`${id}-texto`}
            rotulo="Texto (opcional)"
            valor={b.texto ?? ""}
            longo
            onChange={(v) => onChange({ ...b, texto: opcional(v) })}
          />
          {b.itens.map((it, k) => {
            const mudar = (parcial: Partial<typeof it>) =>
              onChange({
                ...b,
                itens: b.itens.map((x, j) => (j === k ? { ...x, ...parcial } : x)),
              });
            return (
              <fieldset
                key={k}
                className="border-linho grid min-w-0 gap-2 rounded-[var(--radius-campo)] border p-3"
              >
                <legend className="px-1 text-[13px] font-semibold">Serviço {k + 1}</legend>
                <Texto
                  id={`${id}-s${k}-nome`}
                  rotulo="Nome"
                  valor={it.nome}
                  onChange={(v) => mudar({ nome: v })}
                />
                <Texto
                  id={`${id}-s${k}-para`}
                  rotulo="Para quem é"
                  valor={it.paraQuem}
                  longo
                  onChange={(v) => mudar({ paraQuem: v })}
                />
                <Texto
                  id={`${id}-s${k}-entrega`}
                  rotulo="O que entrega"
                  valor={it.entrega}
                  longo
                  onChange={(v) => mudar({ entrega: v })}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Texto
                    id={`${id}-s${k}-formato`}
                    rotulo="Formato e duração (opcional)"
                    valor={it.formato ?? ""}
                    onChange={(v) => mudar({ formato: opcional(v) })}
                  />
                  <Texto
                    id={`${id}-s${k}-link`}
                    rotulo="Link (opcional)"
                    valor={it.href ?? ""}
                    onChange={(v) => mudar({ href: opcional(v) })}
                  />
                </div>
              </fieldset>
            );
          })}
          <div className="flex gap-2">
            <Botao
              type="button"
              tamanho="pequeno"
              variante="secundario"
              onClick={() =>
                onChange({
                  ...b,
                  itens: [
                    ...b.itens,
                    { nome: "Serviço", paraQuem: "Para quem é", entrega: "O que entrega" },
                  ],
                })
              }
              disabled={b.itens.length >= 16}
            >
              Adicionar serviço
            </Botao>
            <Botao
              type="button"
              tamanho="pequeno"
              variante="secundario"
              onClick={() => onChange({ ...b, itens: b.itens.slice(0, -1) })}
              disabled={b.itens.length <= 1}
            >
              Remover último
            </Botao>
          </div>
        </div>
      );
    case "destaque":
      return (
        <div className="grid gap-3">
          <Texto
            id={`${id}-chamada`}
            rotulo="Chamada (opcional)"
            valor={b.chamada ?? ""}
            onChange={(v) => onChange({ ...b, chamada: opcional(v) })}
          />
          <Texto
            id={`${id}-titulo`}
            rotulo="Título"
            valor={b.titulo}
            onChange={(v) => onChange({ ...b, titulo: v })}
          />
          <Texto
            id={`${id}-texto`}
            rotulo="Texto"
            longo
            valor={b.texto}
            onChange={(v) => onChange({ ...b, texto: v })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Texto
              id={`${id}-ctar`}
              rotulo="Botão (opcional)"
              valor={b.cta?.rotulo ?? ""}
              onChange={(v) =>
                onChange({
                  ...b,
                  cta: v ? { rotulo: v, href: b.cta?.href ?? "/guias" } : undefined,
                })
              }
            />
            <Texto
              id={`${id}-ctah`}
              rotulo="Link do botão"
              valor={b.cta?.href ?? ""}
              onChange={(v) =>
                onChange({ ...b, cta: { rotulo: b.cta?.rotulo ?? "Saiba mais", href: v } })
              }
            />
          </div>
        </div>
      );
    case "imagem":
      return (
        <div className="grid gap-3">
          {imagemInput("Imagem (JPG, PNG ou WebP, até 5 MB)", (path) => onChange({ ...b, path }))}
          <Texto
            id={`${id}-alt`}
            rotulo="Descrição da imagem (acessibilidade)"
            valor={b.alt}
            onChange={(v) => onChange({ ...b, alt: v })}
          />
          <Texto
            id={`${id}-leg`}
            rotulo="Legenda (opcional)"
            valor={b.legenda ?? ""}
            onChange={(v) => onChange({ ...b, legenda: opcional(v) })}
          />
        </div>
      );
    case "numeros":
      return (
        <div className="grid gap-3">
          <Texto
            id={`${id}-titulo`}
            rotulo="Título (opcional)"
            valor={b.titulo ?? ""}
            onChange={(v) => onChange({ ...b, titulo: opcional(v) })}
          />
          {b.itens.map((it, k) => {
            const muda = (campo: Partial<typeof it>) =>
              onChange({ ...b, itens: b.itens.map((x, j) => (j === k ? { ...x, ...campo } : x)) });
            return (
              <div
                key={k}
                className="grid gap-2 sm:grid-cols-[minmax(0,.5fr)_minmax(0,1.5fr)_minmax(0,1fr)]"
              >
                <Texto
                  id={`${id}-v${k}`}
                  rotulo={`Número ${k + 1}`}
                  valor={it.valor}
                  onChange={(v) => muda({ valor: v })}
                />
                <Texto
                  id={`${id}-r${k}`}
                  rotulo="O que mostra"
                  valor={it.rotulo}
                  onChange={(v) => muda({ rotulo: v })}
                />
                <Texto
                  id={`${id}-f${k}`}
                  rotulo="Fonte (opcional)"
                  valor={it.fonte ?? ""}
                  onChange={(v) => muda({ fonte: opcional(v) })}
                />
              </div>
            );
          })}
          <div className="flex gap-2">
            <Botao
              type="button"
              tamanho="pequeno"
              variante="secundario"
              onClick={() =>
                onChange({ ...b, itens: [...b.itens, { valor: "0", rotulo: "Descrição" }] })
              }
              disabled={b.itens.length >= 4}
            >
              Adicionar número
            </Botao>
            <Botao
              type="button"
              tamanho="pequeno"
              variante="secundario"
              onClick={() => onChange({ ...b, itens: b.itens.slice(0, -1) })}
              disabled={b.itens.length <= 2}
            >
              Remover último
            </Botao>
          </div>
        </div>
      );
    case "perfis":
      return (
        <div className="grid gap-3">
          <Texto
            id={`${id}-titulo`}
            rotulo="Título"
            valor={b.titulo}
            onChange={(v) => onChange({ ...b, titulo: v })}
          />
          <Texto
            id={`${id}-texto`}
            rotulo="Texto (opcional)"
            valor={b.texto ?? ""}
            onChange={(v) => onChange({ ...b, texto: opcional(v) })}
          />
          {b.itens.map((it, k) => {
            const muda = (campo: Partial<typeof it>) =>
              onChange({ ...b, itens: b.itens.map((x, j) => (j === k ? { ...x, ...campo } : x)) });
            return (
              <div key={k} className="border-linho grid gap-2 rounded-xl border p-3 sm:grid-cols-2">
                <label htmlFor={`${id}-i${k}`} className={rotuloCampo}>
                  Ícone
                  <select
                    id={`${id}-i${k}`}
                    className={campoClasses}
                    value={it.icone}
                    onChange={(e) => muda({ icone: e.target.value as typeof it.icone })}
                  >
                    {ICONES_PERFIL.map((ic) => (
                      <option key={ic} value={ic}>
                        {ROTULO_ICONE_PERFIL[ic]}
                      </option>
                    ))}
                  </select>
                </label>
                <Texto
                  id={`${id}-n${k}`}
                  rotulo={`Cartão ${k + 1}: nome`}
                  valor={it.nome}
                  onChange={(v) => muda({ nome: v })}
                />
                <Texto
                  id={`${id}-d${k}`}
                  rotulo="Descrição"
                  longo
                  valor={it.descricao}
                  onChange={(v) => muda({ descricao: v })}
                />
                <div className="grid gap-2">
                  <Texto
                    id={`${id}-h${k}`}
                    rotulo="Link (opcional)"
                    valor={it.href ?? ""}
                    onChange={(v) => muda({ href: opcional(v) })}
                  />
                  <Texto
                    id={`${id}-l${k}`}
                    rotulo="Texto do link (opcional)"
                    valor={it.rotulo ?? ""}
                    onChange={(v) => muda({ rotulo: opcional(v) })}
                  />
                </div>
              </div>
            );
          })}
          <div className="flex gap-2">
            <Botao
              type="button"
              tamanho="pequeno"
              variante="secundario"
              onClick={() =>
                onChange({
                  ...b,
                  itens: [...b.itens, { icone: "familia", nome: "Novo", descricao: "Descrição" }],
                })
              }
              disabled={b.itens.length >= 4}
            >
              Adicionar cartão
            </Botao>
            <Botao
              type="button"
              tamanho="pequeno"
              variante="secundario"
              onClick={() => onChange({ ...b, itens: b.itens.slice(0, -1) })}
              disabled={b.itens.length <= 2}
            >
              Remover último
            </Botao>
          </div>
        </div>
      );
    case "circulos":
      return (
        <div className="grid gap-3">
          <Texto
            id={`${id}-titulo`}
            rotulo="Título"
            valor={b.titulo}
            onChange={(v) => onChange({ ...b, titulo: v })}
          />
          <Texto
            id={`${id}-texto`}
            rotulo="Texto (opcional)"
            valor={b.texto ?? ""}
            onChange={(v) => onChange({ ...b, texto: opcional(v) })}
          />
          {b.itens.map((it, k) => {
            const muda = (campo: Partial<typeof it>) =>
              onChange({ ...b, itens: b.itens.map((x, j) => (j === k ? { ...x, ...campo } : x)) });
            return (
              <div key={k} className="grid gap-2 sm:grid-cols-[minmax(0,.6fr)_minmax(0,1.4fr)]">
                <Texto
                  id={`${id}-n${k}`}
                  rotulo={`Círculo ${k + 1}`}
                  valor={it.nome}
                  onChange={(v) => muda({ nome: v })}
                />
                <Texto
                  id={`${id}-d${k}`}
                  rotulo="Descrição"
                  valor={it.descricao}
                  onChange={(v) => muda({ descricao: v })}
                />
              </div>
            );
          })}
        </div>
      );
    case "livro":
      return (
        <div className="grid gap-3">
          <Texto
            id={`${id}-chamada`}
            rotulo="Chamada (opcional)"
            valor={b.chamada ?? ""}
            onChange={(v) => onChange({ ...b, chamada: opcional(v) })}
          />
          <Texto
            id={`${id}-titulo`}
            rotulo="Título do livro"
            valor={b.titulo}
            onChange={(v) => onChange({ ...b, titulo: v })}
          />
          <Texto
            id={`${id}-sub`}
            rotulo="Subtítulo na capa (opcional)"
            valor={b.subtitulo ?? ""}
            onChange={(v) => onChange({ ...b, subtitulo: opcional(v) })}
          />
          <Texto
            id={`${id}-texto`}
            rotulo="Para quem é e o que encontra"
            longo
            valor={b.texto}
            onChange={(v) => onChange({ ...b, texto: v })}
          />
          <Texto
            id={`${id}-topicos`}
            rotulo="Tópicos (um por linha)"
            longo
            valor={b.topicos.join("\n")}
            onChange={(v) =>
              onChange({
                ...b,
                topicos: v
                  .split("\n")
                  .map((t) => t.trim())
                  .filter(Boolean)
                  .slice(0, 10),
              })
            }
          />
          {imagemInput("Capa (opcional; sem imagem, a capa é desenhada)", (path) =>
            onChange({ ...b, capa: { path, alt: b.capa?.alt ?? `Capa de ${b.titulo}` } }),
          )}
          {b.capa ? (
            <Botao
              type="button"
              tamanho="pequeno"
              variante="secundario"
              onClick={() => onChange({ ...b, capa: undefined })}
            >
              Usar capa desenhada
            </Botao>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <Texto
              id={`${id}-ctar`}
              rotulo="Botão: texto (opcional)"
              valor={b.cta?.rotulo ?? ""}
              onChange={(v) =>
                onChange({
                  ...b,
                  cta: v ? { rotulo: v, href: b.cta?.href ?? "/guias#receber" } : undefined,
                })
              }
            />
            <Texto
              id={`${id}-ctah`}
              rotulo="Botão: link"
              valor={b.cta?.href ?? ""}
              onChange={(v) =>
                onChange({ ...b, cta: { rotulo: b.cta?.rotulo ?? "Baixar o livro", href: v } })
              }
            />
          </div>
        </div>
      );
    case "faq":
      return (
        <div className="grid gap-3">
          <Texto
            id={`${id}-titulo`}
            rotulo="Título"
            valor={b.titulo}
            onChange={(v) => onChange({ ...b, titulo: v })}
          />
          {b.itens.map((it, k) => {
            const muda = (campo: Partial<typeof it>) =>
              onChange({ ...b, itens: b.itens.map((x, j) => (j === k ? { ...x, ...campo } : x)) });
            return (
              <div key={k} className="border-linho grid gap-2 rounded-xl border p-3">
                <Texto
                  id={`${id}-p${k}`}
                  rotulo={`Pergunta ${k + 1}`}
                  valor={it.pergunta}
                  onChange={(v) => muda({ pergunta: v })}
                />
                <Texto
                  id={`${id}-r${k}`}
                  rotulo="Resposta"
                  longo
                  valor={it.resposta}
                  onChange={(v) => muda({ resposta: v })}
                />
              </div>
            );
          })}
          <div className="flex gap-2">
            <Botao
              type="button"
              tamanho="pequeno"
              variante="secundario"
              onClick={() =>
                onChange({
                  ...b,
                  itens: [...b.itens, { pergunta: "Nova pergunta", resposta: "Resposta" }],
                })
              }
              disabled={b.itens.length >= 12}
            >
              Adicionar pergunta
            </Botao>
            <Botao
              type="button"
              tamanho="pequeno"
              variante="secundario"
              onClick={() => onChange({ ...b, itens: b.itens.slice(0, -1) })}
              disabled={b.itens.length <= 1}
            >
              Remover última
            </Botao>
          </div>
        </div>
      );
    case "situacoes":
      return (
        <div className="grid gap-3">
          <Texto
            id={`${id}-titulo`}
            rotulo="Título"
            valor={b.titulo}
            onChange={(v) => onChange({ ...b, titulo: v })}
          />
          <Texto
            id={`${id}-texto`}
            rotulo="Texto (opcional)"
            valor={b.texto ?? ""}
            onChange={(v) => onChange({ ...b, texto: opcional(v) })}
          />
          {b.itens.map((it, k) => {
            const muda = (campo: Partial<typeof it>) =>
              onChange({ ...b, itens: b.itens.map((x, j) => (j === k ? { ...x, ...campo } : x)) });
            return (
              <div key={k} className="grid gap-2 sm:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
                <Texto
                  id={`${id}-s${k}`}
                  rotulo={`Situação ${k + 1}`}
                  valor={it.situacao}
                  onChange={(v) => muda({ situacao: v })}
                />
                <Texto
                  id={`${id}-r${k}`}
                  rotulo="O que fazer"
                  valor={it.resposta}
                  onChange={(v) => muda({ resposta: v })}
                />
              </div>
            );
          })}
          <div className="flex gap-2">
            <Botao
              type="button"
              tamanho="pequeno"
              variante="secundario"
              onClick={() =>
                onChange({
                  ...b,
                  itens: [...b.itens, { situacao: "Situação", resposta: "O que fazer" }],
                })
              }
              disabled={b.itens.length >= 8}
            >
              Adicionar situação
            </Botao>
            <Botao
              type="button"
              tamanho="pequeno"
              variante="secundario"
              onClick={() => onChange({ ...b, itens: b.itens.slice(0, -1) })}
              disabled={b.itens.length <= 2}
            >
              Remover última
            </Botao>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Texto
              id={`${id}-ctar`}
              rotulo="Botão: texto (opcional)"
              valor={b.cta?.rotulo ?? ""}
              onChange={(v) =>
                onChange({
                  ...b,
                  cta: v ? { rotulo: v, href: b.cta?.href ?? "/diagnostico" } : undefined,
                })
              }
            />
            <Texto
              id={`${id}-ctah`}
              rotulo="Botão: link"
              valor={b.cta?.href ?? ""}
              onChange={(v) =>
                onChange({ ...b, cta: { rotulo: b.cta?.rotulo ?? "Fazer o diagnóstico", href: v } })
              }
            />
          </div>
        </div>
      );
    case "checklist":
      return (
        <div className="grid gap-3">
          <Texto
            id={`${id}-titulo`}
            rotulo="Título"
            valor={b.titulo}
            onChange={(v) => onChange({ ...b, titulo: v })}
          />
          <Texto
            id={`${id}-texto`}
            rotulo="Texto (opcional)"
            valor={b.texto ?? ""}
            onChange={(v) => onChange({ ...b, texto: opcional(v) })}
          />
          {b.grupos.map((g, k) => {
            const muda = (campo: Partial<typeof g>) =>
              onChange({
                ...b,
                grupos: b.grupos.map((x, j) => (j === k ? { ...x, ...campo } : x)),
              });
            return (
              <div key={k} className="border-linho grid gap-2 rounded-xl border p-3">
                <Texto
                  id={`${id}-g${k}`}
                  rotulo={`Grupo ${k + 1}`}
                  valor={g.nome}
                  onChange={(v) => muda({ nome: v })}
                />
                <Texto
                  id={`${id}-i${k}`}
                  rotulo="Itens (um por linha)"
                  longo
                  valor={g.itens.join("\n")}
                  onChange={(v) =>
                    muda({
                      itens: v
                        .split("\n")
                        .map((t) => t.trim())
                        .filter(Boolean)
                        .slice(0, 8),
                    })
                  }
                />
              </div>
            );
          })}
          <div className="flex gap-2">
            <Botao
              type="button"
              tamanho="pequeno"
              variante="secundario"
              onClick={() =>
                onChange({ ...b, grupos: [...b.grupos, { nome: "Novo grupo", itens: ["Item"] }] })
              }
              disabled={b.grupos.length >= 4}
            >
              Adicionar grupo
            </Botao>
            <Botao
              type="button"
              tamanho="pequeno"
              variante="secundario"
              onClick={() => onChange({ ...b, grupos: b.grupos.slice(0, -1) })}
              disabled={b.grupos.length <= 1}
            >
              Remover último
            </Botao>
          </div>
          <Texto
            id={`${id}-nota`}
            rotulo="Nota (opcional)"
            valor={b.nota ?? ""}
            onChange={(v) => onChange({ ...b, nota: opcional(v) })}
          />
        </div>
      );
  }
}
