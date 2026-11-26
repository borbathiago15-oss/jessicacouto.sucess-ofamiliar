import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Barras, Medidor, Radar } from "@/components/charts";
import { Blocos } from "@/components/site/blocos";
import {
  Botao,
  Cartao,
  Campo,
  Chamada,
  Consentimento,
  EscalaResposta,
  FioContinuidade,
  Monograma,
  Selo,
  Titulo,
} from "@/components/ui";
import { contraste, formatarContraste } from "@/lib/design/contrast";
import { publicEnv } from "@/lib/env/public";
import { cores, paresDeTexto } from "@/styles/tokens";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

/** Referência visual do design system. Disponível só fora de produção. Dados fictícios. */
export default function DesignSystemPage() {
  if (publicEnv.NEXT_PUBLIC_APP_ENV === "production") notFound();

  const exemplo = [
    { rotulo: "Delegação", valor: 25 },
    { rotulo: "Preparação da transição", valor: 38 },
    { rotulo: "Papel futuro", valor: 0 },
    { rotulo: "Conhecimento compartilhado", valor: 25 },
    { rotulo: "Papéis e governança", valor: null },
    { rotulo: "Dependência do fundador", valor: 0 },
  ];

  return (
    <main className="mx-auto grid max-w-6xl gap-10 px-[max(16px,env(safe-area-inset-left))] py-12">
      <header className="grid gap-3">
        <div className="flex items-center gap-3">
          <Monograma />
          <Chamada>JC | Sucessão de Sucesso · Design system</Chamada>
        </div>
        <Titulo>Creme, marrom e mostarda</Titulo>
        <p className="text-mudo max-w-[62ch]">
          Tokens, tipografia, componentes e gráficos da plataforma. Fonte da verdade:{" "}
          <code>src/styles/tokens.css</code>. Dados desta página são fictícios.
        </p>
        <FioContinuidade />
      </header>

      <section aria-labelledby="cores" className="grid gap-4">
        <Titulo nivel={2}>
          <span id="cores">Cores</span>
        </Titulo>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Object.entries(cores).map(([nome, hex]) => (
            <li key={nome} className="border-linho bg-papel grid overflow-hidden rounded-xl border">
              <span className="h-14" style={{ background: hex }} />
              <span className="grid px-3 py-2 text-[13px]">
                <b>{nome}</b>
                <span className="text-mudo tabular-nums">{hex}</span>
              </span>
            </li>
          ))}
        </ul>
        <Cartao>
          <Titulo nivel={3}>Pares de texto (WCAG AA ≥ 4,5:1)</Titulo>
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-mudo text-left">
                  <th className="py-2 pr-4 font-semibold">Exemplo</th>
                  <th className="py-2 pr-4 font-semibold">Texto</th>
                  <th className="py-2 pr-4 font-semibold">Fundo</th>
                  <th className="py-2 text-right font-semibold">Contraste</th>
                </tr>
              </thead>
              <tbody>
                {paresDeTexto.map(([t, f]) => {
                  const tx = t === "branco" ? "#ffffff" : cores[t];
                  return (
                    <tr key={`${t}-${f}`} className="border-linho border-t">
                      <td className="py-2 pr-4">
                        <span
                          className="rounded-md px-2 py-1 font-semibold"
                          style={{ color: tx, background: cores[f] }}
                        >
                          Sucessão
                        </span>
                      </td>
                      <td className="py-2 pr-4">{t}</td>
                      <td className="py-2 pr-4">{f}</td>
                      <td className="py-2 text-right">
                        {formatarContraste(contraste(tx, cores[f]))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Cartao>
      </section>

      <section className="grid gap-4">
        <Titulo nivel={2}>Tipografia</Titulo>
        <Cartao className="grid gap-4">
          <p className="font-display text-[clamp(2.5rem,6vw,4.5rem)] leading-none font-medium tracking-[-0.02em]">
            Sua empresa está preparada para a próxima geração?
          </p>
          <Titulo>Título de página em Bodoni Moda</Titulo>
          <Titulo nivel={2}>Título de seção</Titulo>
          <Titulo nivel={3}>Título de cartão</Titulo>
          <p className="max-w-[65ch]">
            Texto corrido em Figtree, 15,5 a 16,5 px, entrelinha 1,6. A comunicação é pessoal,
            direta e sem filtros, sempre “com base nas respostas informadas”.
          </p>
          <p className="font-display text-terra-texto text-2xl italic">Jéssica Couto</p>
        </Cartao>
      </section>

      <section className="grid gap-4">
        <Titulo nivel={2}>Componentes</Titulo>
        <div className="grid gap-4 md:grid-cols-2">
          <Cartao className="grid content-start gap-4">
            <Titulo nivel={3}>Botões e selos</Titulo>
            <div className="flex flex-wrap gap-3">
              <Botao type="button">Fazer o diagnóstico gratuito</Botao>
              <Botao type="button" variante="secundario">
                Receber o guia
              </Botao>
              <Botao type="button" tamanho="pequeno">
                Começar
              </Botao>
            </div>
            <div className="flex flex-wrap gap-2">
              <Selo tom="critico">Ponto a desenvolver</Selo>
              <Selo tom="atencao">Prática em construção</Selo>
              <Selo tom="ok">Prática estruturada</Selo>
              <Selo tom="neutro">Dados insuficientes</Selo>
              <Selo tom="marca">Chegou agora</Selo>
            </div>
          </Cartao>
          <Cartao superficie="blush" className="grid content-start gap-2">
            <Titulo nivel={3}>Superfície de destaque</Titulo>
            <p>Usada para o próximo passo, a leitura da JC e capas.</p>
          </Cartao>
        </div>
        <Cartao>
          <form className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo id="ds-nome" rotulo="Nome" defaultValue="Pessoa Exemplo" autoComplete="off" />
              <Campo
                id="ds-email"
                rotulo="E-mail"
                type="email"
                defaultValue="pessoa@exemplo.test"
                ajuda="Usado só para entregar o diagnóstico."
                autoComplete="off"
              />
            </div>
            <EscalaResposta
              nome="ds-q1"
              legenda="Delegação · pergunta exemplificativa"
              pergunta="Você consegue delegar decisões relevantes sem retomar o controle diante de qualquer divergência?"
              valor={2}
            />
            <div className="bg-porcelana grid gap-2.5 rounded-2xl p-4">
              <Consentimento id="ds-aviso" obrigatorio defaultChecked>
                Li e aceito o Aviso de Privacidade. <b>Obrigatório.</b>
              </Consentimento>
              <Consentimento id="ds-contato">
                Aceito ser contatada pela equipe da JC. Opcional.
              </Consentimento>
            </div>
          </form>
        </Cartao>
      </section>

      <section className="grid gap-4">
        <Titulo nivel={2}>Gráficos</Titulo>
        <div className="grid gap-4 md:grid-cols-2">
          <Cartao className="grid justify-items-center">
            <Radar titulo="Leitura por dimensão (exemplo)" dados={exemplo} />
          </Cartao>
          <Cartao className="grid content-center gap-6">
            <Medidor valor={49} rotulo="Índice de Prontidão (exemplo)" />
            <Barras dados={exemplo} />
          </Cartao>
        </div>
        <Cartao className="grid justify-items-center">
          <Radar
            titulo="Antes e depois (exemplo)"
            dados={["Delegação", "Governança", "Papéis claros", "Conhecimento", "Plano"].map(
              (r, i) => ({
                rotulo: r,
                valor: [55, 45, 60, 50, 70][i] ?? null,
              }),
            )}
            comparacao={[25, 15, 25, 25, 25]}
          />
        </Cartao>
      </section>

      <section aria-labelledby="blocos-site" className="grid gap-6">
        <h2 id="blocos-site" className="font-display m-0 text-2xl">
          Blocos visuais do site
        </h2>
        <Blocos
          blocos={[
            {
              tipo: "livro",
              chamada: "Livro gratuito",
              titulo: "Livro fictício de exemplo",
              subtitulo: "Subtítulo fictício",
              texto: "Texto fictício sobre para quem é o livro e o que a pessoa vai encontrar.",
              topicos: [
                "Tópico fictício um",
                "Tópico fictício dois",
                "Tópico fictício três",
                "Tópico fictício quatro",
              ],
              cta: { rotulo: "Baixar (exemplo)", href: "/guias#receber" },
            },
            {
              tipo: "situacoes",
              titulo: "Quando procurar (exemplo)",
              itens: [
                { situacao: "Situação fictícia A", resposta: "O que fazer, fictício." },
                { situacao: "Situação fictícia B", resposta: "O que fazer, fictício." },
                { situacao: "Situação fictícia C", resposta: "O que fazer, fictício." },
                { situacao: "Situação fictícia D", resposta: "O que fazer, fictício." },
              ],
            },
            {
              tipo: "faq",
              titulo: "Perguntas frequentes (exemplo)",
              itens: [
                { pergunta: "Pergunta fictícia um?", resposta: "Resposta fictícia." },
                { pergunta: "Pergunta fictícia dois?", resposta: "Resposta fictícia." },
              ],
            },
            {
              tipo: "checklist",
              titulo: "Checklist (exemplo)",
              grupos: [
                { nome: "Grupo fictício A", itens: ["Item fictício 1", "Item fictício 2"] },
                { nome: "Grupo fictício B", itens: ["Item fictício 3", "Item fictício 4"] },
              ],
              nota: "Nota fictícia.",
            },
            {
              tipo: "numeros",
              titulo: "Título de exemplo da faixa de números",
              itens: [
                {
                  valor: "24%",
                  rotulo: "Rótulo de exemplo do primeiro número",
                  fonte: "Fonte fictícia",
                },
                {
                  valor: "65%",
                  rotulo: "Rótulo de exemplo do segundo número",
                  fonte: "Fonte fictícia",
                },
                { valor: "5 anos", rotulo: "Rótulo de exemplo do terceiro número" },
              ],
            },
            {
              tipo: "perfis",
              titulo: "Para quem é (exemplo)",
              texto: "Texto de apoio fictício.",
              itens: [
                { icone: "construiu", nome: "Quem construiu", descricao: "Descrição fictícia." },
                { icone: "assume", nome: "Quem vai assumir", descricao: "Descrição fictícia." },
                {
                  icone: "familia",
                  nome: "Família",
                  descricao: "Descrição fictícia.",
                  href: "/diagnostico",
                  rotulo: "Link de exemplo",
                },
              ],
            },
            {
              tipo: "circulos",
              titulo: "Três círculos (exemplo)",
              texto: "Texto de apoio fictício.",
              itens: [
                { nome: "Família", descricao: "Descrição fictícia." },
                { nome: "Propriedade", descricao: "Descrição fictícia." },
                { nome: "Gestão", descricao: "Descrição fictícia." },
              ],
            },
            {
              tipo: "movimentos",
              titulo: "Movimentos (exemplo)",
              itens: ["Um", "Dois", "Três", "Quatro", "Cinco"].map((n) => ({
                nome: n,
                descricao: "Descrição fictícia.",
              })),
            },
            {
              tipo: "caminhos",
              titulo: "Caminhos (exemplo)",
              itens: [
                { titulo: "Caminho A", descricao: "Descrição fictícia.", href: "/diagnostico" },
                { titulo: "Caminho B", descricao: "Descrição fictícia.", href: "/guias" },
                { titulo: "Caminho C", descricao: "Descrição fictícia.", href: "/contato" },
              ],
            },
          ]}
        />
      </section>
    </main>
  );
}
