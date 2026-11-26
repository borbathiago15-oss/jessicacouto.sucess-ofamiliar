"use client";

import Link from "next/link";
import { Botao, botaoClasses, FioContinuidade } from "@/components/ui";
import {
  mapaDeTemas,
  planoNoventaDias,
  ROTULO_LEITURA,
  type NivelLeitura,
  type ResultadoDiagnostico,
} from "@/modules/diagnostico/schema";

const TOM_LEITURA: Record<NivelLeitura, { cor: string; fundo: string; passos: number }> = {
  atencao: { cor: "bg-critico", fundo: "bg-critico-fundo text-critico", passos: 1 },
  construcao: { cor: "bg-atencao", fundo: "bg-atencao-fundo text-atencao", passos: 2 },
  estruturado: { cor: "bg-ok", fundo: "bg-ok-fundo text-ok", passos: 3 },
};

function SeloLeitura({ nivel }: { nivel: NivelLeitura }) {
  return (
    <span
      className={`${TOM_LEITURA[nivel].fundo} rounded-full px-3 py-1 text-[12.5px] font-semibold whitespace-nowrap`}
    >
      {ROTULO_LEITURA[nivel]}
    </span>
  );
}

/** Régua de três passos: quanto mais preenchida, mais estruturado o tema. */
function Regua({ nivel }: { nivel: NivelLeitura }) {
  const t = TOM_LEITURA[nivel];
  return (
    <span className="grid w-full grid-cols-3 gap-1" aria-hidden="true">
      {[1, 2, 3].map((n) => (
        <span key={n} className={`h-2 rounded-full ${n <= t.passos ? t.cor : "bg-linho"}`} />
      ))}
    </span>
  );
}

/**
 * Leitura completa para quem respondeu: mapa por tema, por que importa e o que
 * fazer em cada resposta, o plano dos próximos 90 dias e o próximo passo.
 * Nunca mostra a classificação interna (essa vai só para o CRM).
 */
export function Resultado({ r }: { r: ResultadoDiagnostico }) {
  const temas = mapaDeTemas(r.leituras);
  const plano = planoNoventaDias(r.leituras);
  const temLeituraDeRisco = r.leituras.some((l) => l.chave === "riscos");

  return (
    <article className="grid max-w-[56rem] gap-12" data-testid="diagnostico-resultado">
      <header className="grid gap-3">
        <span className="text-terra-texto text-sm font-semibold">
          Leitura do seu Diagnóstico de Sucessão
        </span>
        <h2 className="font-display m-0 text-[clamp(2rem,4.6vw,3.2rem)] leading-none font-medium">
          {r.nome}, obrigada por responder.
        </h2>
        {r.abertura ? <p className="m-0 max-w-[62ch] text-lg">{r.abertura}</p> : null}
        <FioContinuidade className="max-w-[22rem]" />
      </header>

      {temas.length ? (
        <section aria-labelledby="mapa" className="grid gap-5">
          <div className="grid gap-1">
            <h3 id="mapa" className="font-display m-0 text-[1.75rem]">
              O mapa da sua sucessão
            </h3>
            <p className="text-mudo m-0 text-[15px]">
              Cada tema mostra onde a sua família está hoje, pelas suas respostas.
            </p>
          </div>
          <ul
            className="border-linho m-0 grid list-none border-t p-0"
            data-testid="diagnostico-mapa"
          >
            {temas.map((t) => (
              <li
                key={t.dimensao}
                className="border-linho grid items-center gap-2 border-b py-3.5 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] sm:gap-6"
              >
                <b className="font-display text-lg font-semibold">{t.dimensao}</b>
                <Regua nivel={t.nivel} />
                <SeloLeitura nivel={t.nivel} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
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
      )}

      {r.leituras.length ? (
        <section aria-labelledby="leitura" className="grid gap-5">
          <h3 id="leitura" className="font-display m-0 text-[1.75rem]">
            Leitura por tema
          </h3>
          <ul className="m-0 grid list-none gap-4 p-0" data-testid="diagnostico-leituras">
            {r.leituras.map((l) => (
              <li
                key={`${l.chave}-${l.resposta}`}
                className="bg-papel border-linho grid gap-4 rounded-2xl border px-6 py-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-0.5">
                    <span className="text-terra-texto text-[13px] font-semibold">{l.dimensao}</span>
                    <b className="text-[1.05rem]">Você respondeu: {l.resposta}</b>
                  </div>
                  <SeloLeitura nivel={l.nivel} />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 sm:gap-8">
                  <div className="grid content-start gap-1">
                    <span className="text-mudo text-[13px] font-semibold">
                      Por que isso importa
                    </span>
                    <p className="m-0 text-[15px]">{l.porque}</p>
                  </div>
                  <div className="grid content-start gap-1">
                    <span className="text-mudo text-[13px] font-semibold">O que fazer</span>
                    <p className="m-0 text-[15px]">{l.fazer}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {r.riscos.length ? (
        <section aria-labelledby="riscos" className="grid gap-3">
          <h3 id="riscos" className="font-display m-0 text-[1.75rem]">
            O que eu faria no seu lugar
          </h3>
          <ul className="m-0 grid list-none gap-4 p-0">
            {r.riscos.map((x) => (
              <li key={x.rotulo} className="border-terra grid gap-1 border-l-4 py-1 pl-4">
                {temLeituraDeRisco ? null : <b>{x.rotulo}</b>}
                <span className="font-display text-[1.15rem] italic">{x.texto}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {plano.length ? (
        <section aria-labelledby="plano" className="grid gap-4">
          <div className="grid gap-1">
            <h3 id="plano" className="font-display m-0 text-[1.75rem]">
              Seus próximos 90 dias
            </h3>
            <p className="text-mudo m-0 text-[15px]">
              Por onde eu começaria, na ordem, a partir do que você me contou.
            </p>
          </div>
          <ol className="m-0 grid list-none gap-3 p-0" data-testid="diagnostico-plano">
            {plano.map((l, i) => (
              <li key={l.fazer} className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-3">
                <span className="border-terra font-display text-terra-texto grid size-10 place-items-center rounded-full border text-lg">
                  {i + 1}
                </span>
                <div className="grid gap-0.5 pt-1.5">
                  <b className="text-mudo text-[13px]">{l.dimensao}</b>
                  <span>{l.fazer}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {r.tema ? (
        <section aria-labelledby="tema" className="grid gap-2">
          <h3 id="tema" className="font-display m-0 text-[1.4rem]">
            O tema que você quer resolver
          </h3>
          <blockquote className="border-terra m-0 border-l-4 pl-4 text-lg italic">
            “{r.tema}”
          </blockquote>
        </section>
      ) : null}

      {r.proximo_passo ? (
        <section className="bg-blush grid gap-3 rounded-2xl px-6 py-6" aria-labelledby="proximo">
          <h3 id="proximo" className="font-display m-0 text-[1.75rem]">
            Próximo passo
          </h3>
          <p className="m-0 max-w-[62ch]">{r.proximo_passo}</p>
          <div className="flex flex-wrap gap-3 print:hidden">
            <Link href="/contato" className={botaoClasses()}>
              Conversar com a Jéssica
            </Link>
            <Link href="/artigos" className={botaoClasses("secundario")}>
              Ler os artigos da Jéssica
            </Link>
          </div>
          <span className="font-display text-terra-texto text-xl italic">Jéssica Couto</span>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3 print:hidden">
        <Botao type="button" variante="secundario" onClick={() => window.print()}>
          Salvar em PDF ou imprimir
        </Botao>
      </div>
      <p className="text-mudo m-0 text-[13px]">
        Esta leitura é baseada nas suas respostas e serve como ponto de partida. Não substitui uma
        avaliação aprofundada, nem psicológica, jurídica ou contábil.
      </p>
    </article>
  );
}
