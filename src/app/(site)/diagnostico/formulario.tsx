"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Botao, campoClasses, FioContinuidade } from "@/components/ui";
import {
  faltaResponder,
  type FormularioPublico,
  type Respostas,
  type ResultadoDiagnostico,
} from "@/modules/diagnostico/schema";
import { enviarDiagnostico, type EstadoDiagnostico } from "./actions";

const rotulo = "grid gap-1 text-[14px] font-semibold";

export function FormularioDiagnostico({ f }: { f: FormularioPublico }) {
  const [estado, acao, enviando] = useActionState<EstadoDiagnostico, FormData>(enviarDiagnostico, {
    status: "inicial",
  });
  const [passo, setPasso] = useState(0);
  const [respostas, setRespostas] = useState<Respostas>({});
  const [aberta, setAberta] = useState("");
  const [inicio, setInicio] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);

  if (estado.status === "pronto") return <Resultado r={estado.resultado} />;

  const total = f.perguntas.length;
  const naPergunta = passo < total;
  const p = naPergunta ? f.perguntas[passo]! : null;

  const marcar = (instante: number, chave: string, valor: string, tipo: string, max?: number) => {
    if (!inicio) setInicio(instante);
    setAviso(null);
    setRespostas((r) => {
      const atual = r[chave] ?? [];
      if (tipo === "escolha") return { ...r, [chave]: [valor] };
      if (atual.includes(valor)) return { ...r, [chave]: atual.filter((v) => v !== valor) };
      if (max && atual.length >= max) return r;
      return { ...r, [chave]: [...atual, valor] };
    });
  };

  const avancar = () => {
    if (p && p.tipo !== "aberta" && !respostas[p.chave]?.length) {
      setAviso("Escolha uma opção para continuar.");
      return;
    }
    setAviso(null);
    setPasso((n) => n + 1);
  };

  return (
    <div className="grid max-w-[46rem] gap-6">
      <div className="grid gap-2">
        <div className="text-mudo flex justify-between text-sm">
          <span>
            {naPergunta ? `Pergunta ${passo + 1} de ${total}` : "Para receber a sua leitura"}
          </span>
          <span aria-hidden="true">{Math.round((Math.min(passo, total) / total) * 100)}%</span>
        </div>
        <div
          className="bg-linho h-1.5 overflow-hidden rounded-full"
          role="progressbar"
          aria-label="Progresso do diagnóstico"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={Math.min(passo, total)}
        >
          <div
            className="bg-terra h-full transition-[width]"
            style={{ width: `${(Math.min(passo, total) / total) * 100}%` }}
          />
        </div>
      </div>

      {p ? (
        <fieldset className="grid min-w-0 gap-4 border-0 p-0" key={p.chave}>
          <legend className="font-display mb-1 text-[clamp(1.6rem,3.4vw,2.3rem)] leading-tight font-medium">
            {p.texto}
          </legend>
          {p.ajuda ? <p className="text-mudo m-0">{p.ajuda}</p> : null}
          {p.tipo === "aberta" ? (
            <label className={rotulo}>
              <span className="sr-only">{p.texto}</span>
              <textarea
                className={campoClasses}
                rows={3}
                maxLength={500}
                value={aberta}
                onChange={(e) => {
                  if (!inicio) setInicio(e.timeStamp);
                  setAberta(e.target.value);
                }}
              />
              <span className="text-mudo text-xs font-normal">{aberta.length}/500</span>
            </label>
          ) : (
            <div className="grid gap-2" data-testid="diagnostico-opcoes">
              {p.opcoes?.map((o) => {
                const marcado = respostas[p.chave]?.includes(o.valor) ?? false;
                const cheio =
                  p.tipo === "multipla" &&
                  !marcado &&
                  (respostas[p.chave]?.length ?? 0) >= (p.max ?? 99);
                return (
                  <label
                    key={o.valor}
                    className={
                      marcado
                        ? "border-terra bg-blush flex cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3"
                        : "border-linho bg-papel hover:border-champanhe flex cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3"
                    }
                  >
                    <input
                      type={p.tipo === "escolha" ? "radio" : "checkbox"}
                      name={`p-${p.chave}`}
                      className="accent-terra mt-1"
                      checked={marcado}
                      disabled={cheio}
                      onChange={(e) => marcar(e.timeStamp, p.chave, o.valor, p.tipo, p.max)}
                    />
                    <span>{o.rotulo}</span>
                  </label>
                );
              })}
            </div>
          )}
          {aviso ? (
            <p role="status" className="text-critico m-0 text-sm">
              {aviso}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            {passo > 0 ? (
              <Botao type="button" variante="secundario" onClick={() => setPasso((n) => n - 1)}>
                Voltar
              </Botao>
            ) : null}
            <Botao type="button" onClick={avancar}>
              {p.tipo === "aberta" && !aberta ? "Pular e continuar" : "Continuar"}
            </Botao>
          </div>
        </fieldset>
      ) : (
        <form
          action={acao}
          className="grid gap-4"
          onSubmit={(e) => {
            const falta = faltaResponder(f, respostas);
            if (falta) {
              e.preventDefault();
              setAviso(`Falta responder: ${falta}`);
              return;
            }
            // Tempo entre a primeira resposta e o envio (o servidor recusa envios instantâneos).
            const campo = e.currentTarget.elements.namedItem("duracao");
            if (campo instanceof HTMLInputElement)
              campo.value = String(Math.round(e.timeStamp - inicio));
          }}
        >
          <h2 className="font-display m-0 text-[clamp(1.6rem,3.4vw,2.3rem)] leading-tight font-medium">
            Para onde envio a sua leitura?
          </h2>
          <input type="hidden" name="versao" value={f.versao} />
          <input type="hidden" name="respostas" value={JSON.stringify(respostas)} />
          <input type="hidden" name="aberta" value={aberta} />
          <input type="hidden" name="duracao" defaultValue="0" />
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
            <label>
              Site
              <input name="site" tabIndex={-1} autoComplete="off" defaultValue="" />
            </label>
          </div>
          <label htmlFor="d-nome" className={rotulo}>
            Seu nome
            <input
              id="d-nome"
              name="nome"
              className={campoClasses}
              required
              maxLength={200}
              autoComplete="name"
            />
          </label>
          <label htmlFor="d-email" className={rotulo}>
            E-mail
            <input
              id="d-email"
              name="email"
              type="email"
              className={campoClasses}
              required
              maxLength={254}
              autoComplete="email"
            />
          </label>
          <label htmlFor="d-fone" className={rotulo}>
            Telefone ou WhatsApp (opcional)
            <input
              id="d-fone"
              name="telefone"
              className={campoClasses}
              maxLength={40}
              autoComplete="tel"
            />
          </label>
          <label className="flex items-start gap-2 text-[14px]">
            <input type="checkbox" name="contato" defaultChecked className="accent-terra mt-1" />
            <span>Aceito que a Jéssica entre em contato para conversar sobre o resultado.</span>
          </label>
          <label className="flex items-start gap-2 text-[14px]">
            <input type="checkbox" name="novidades" className="accent-terra mt-1" />
            <span>Quero receber conteúdos e novidades da JC (opcional).</span>
          </label>
          <p className="text-mudo m-0 text-[13px]">
            Suas respostas são confidenciais e tratadas conforme a{" "}
            <Link href="/privacidade" className="text-terra-texto underline">
              Política de Privacidade
            </Link>
            . O diagnóstico não é avaliação psicológica, jurídica nem contábil.
          </p>
          {aviso || estado.status === "erro" ? (
            <p role="status" className="text-critico m-0 text-sm" data-testid="diagnostico-aviso">
              {aviso ?? (estado.status === "erro" ? estado.mensagem : "")}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Botao type="button" variante="secundario" onClick={() => setPasso(total - 1)}>
              Voltar
            </Botao>
            <Botao type="submit" disabled={enviando}>
              {enviando ? "Enviando..." : "Ver o meu resultado"}
            </Botao>
          </div>
        </form>
      )}
    </div>
  );
}

function Resultado({ r }: { r: ResultadoDiagnostico }) {
  return (
    <article className="grid max-w-[48rem] gap-8" data-testid="diagnostico-resultado">
      <header className="grid gap-3">
        <span className="text-terra-texto text-sm font-semibold">Seu ponto de partida</span>
        <h2 className="font-display m-0 text-[clamp(2rem,4.6vw,3.2rem)] leading-none font-medium">
          {r.nome}, obrigada por responder.
        </h2>
        {r.abertura ? <p className="m-0 text-lg">{r.abertura}</p> : null}
        <FioContinuidade className="max-w-[22rem]" />
      </header>

      <section aria-labelledby="retrato" className="grid gap-3">
        <h3 id="retrato" className="font-display m-0 text-2xl">
          Onde a sua família está
        </h3>
        <dl className="border-linho m-0 grid border-t">
          {r.retrato.map((i) => (
            <div
              key={i.pergunta}
              className="border-linho grid gap-1 border-b py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-6"
            >
              <dt className="text-mudo text-sm">{i.pergunta}</dt>
              <dd className="m-0 font-semibold">{i.resposta}</dd>
            </div>
          ))}
        </dl>
      </section>

      {r.riscos.length ? (
        <section aria-labelledby="riscos" className="grid gap-3">
          <h3 id="riscos" className="font-display m-0 text-2xl">
            O que eu faria no seu lugar
          </h3>
          <ul className="m-0 grid list-none gap-3 p-0">
            {r.riscos.map((x) => (
              <li
                key={x.rotulo}
                className="bg-papel border-linho grid gap-1 rounded-2xl border px-5 py-4"
              >
                <b>{x.rotulo}</b>
                <span>{x.texto}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {r.tema ? (
        <blockquote className="border-terra m-0 border-l-4 pl-4 text-lg italic">
          “{r.tema}”
        </blockquote>
      ) : null}

      {r.proximo_passo ? (
        <section className="bg-blush grid gap-2 rounded-2xl px-6 py-5" aria-labelledby="proximo">
          <h3 id="proximo" className="font-display m-0 text-2xl">
            Próximo passo
          </h3>
          <p className="m-0">{r.proximo_passo}</p>
          <span className="font-display text-terra-texto text-xl italic">Jéssica Couto</span>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3 print:hidden">
        <Botao type="button" variante="secundario" onClick={() => window.print()}>
          Salvar em PDF ou imprimir
        </Botao>
      </div>
      <p className="text-mudo m-0 text-[13px]">
        Esta leitura é baseada nas suas respostas e não é uma avaliação de maturidade, nem
        psicológica, jurídica ou contábil.
      </p>
    </article>
  );
}
