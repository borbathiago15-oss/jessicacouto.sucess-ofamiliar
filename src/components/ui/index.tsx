import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

/** Junta classes ignorando valores vazios. */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Botões
// ---------------------------------------------------------------------------
type Variante = "primario" | "secundario";
type Tamanho = "normal" | "pequeno";

const baseBotao =
  "inline-flex items-center justify-center gap-2 rounded-full border font-semibold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const variantes: Record<Variante, string> = {
  primario:
    "border-terra-texto bg-terra-texto text-white hover:bg-terra-escuro hover:border-terra-escuro",
  secundario:
    "border-blush-2 bg-transparent text-terra-texto hover:border-terra-texto hover:bg-papel",
};
const tamanhos: Record<Tamanho, string> = {
  normal: "px-5 py-2.5 text-[15px]",
  pequeno: "px-3.5 py-1.5 text-sm",
};

export function botaoClasses(variante: Variante = "primario", tamanho: Tamanho = "normal") {
  return cx(baseBotao, variantes[variante], tamanhos[tamanho]);
}

export function Botao({
  variante = "primario",
  tamanho = "normal",
  className,
  ...props
}: ComponentPropsWithoutRef<"button"> & { variante?: Variante; tamanho?: Tamanho }) {
  return <button className={cx(botaoClasses(variante, tamanho), className)} {...props} />;
}

export function BotaoLink({
  variante = "primario",
  tamanho = "normal",
  className,
  ...props
}: ComponentPropsWithoutRef<typeof Link> & { variante?: Variante; tamanho?: Tamanho }) {
  return <Link className={cx(botaoClasses(variante, tamanho), className)} {...props} />;
}

// ---------------------------------------------------------------------------
// Selo (estado)
// ---------------------------------------------------------------------------
export type Tom = "ok" | "atencao" | "critico" | "neutro" | "marca";
const tons: Record<Tom, string> = {
  ok: "bg-ok-fundo text-ok",
  atencao: "bg-atencao-fundo text-atencao",
  critico: "bg-critico-fundo text-critico",
  neutro: "bg-linho text-mudo",
  marca: "bg-blush text-terra-texto",
};

export function Selo({ tom = "neutro", children }: { tom?: Tom; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold whitespace-nowrap",
        tons[tom],
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Superfícies e títulos
// ---------------------------------------------------------------------------
type Superficie = "borda" | "blush" | "salvia" | "papel";
const superficies: Record<Superficie, string> = {
  borda: "bg-papel border border-linho",
  blush: "bg-blush",
  salvia: "bg-salvia-claro",
  papel: "bg-papel",
};

export function Cartao({
  superficie = "borda",
  className,
  ...props
}: ComponentPropsWithoutRef<"section"> & { superficie?: Superficie }) {
  return (
    <section
      className={cx(
        "min-w-0 rounded-[var(--radius-cartao)] p-5 sm:p-6",
        superficies[superficie],
        className,
      )}
      {...props}
    />
  );
}

export function Chamada({ children }: { children: ReactNode }) {
  return <p className="text-terra-texto text-[13.5px] font-semibold">{children}</p>;
}

export function Titulo({
  nivel = 1,
  className,
  children,
}: {
  nivel?: 1 | 2 | 3;
  className?: string;
  children: ReactNode;
}) {
  const Tag = `h${nivel}` as const;
  const estilos = {
    1: "font-display text-[clamp(2rem,4.2vw,2.9rem)] leading-[1.08] font-semibold tracking-[-0.01em]",
    2: "font-display text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.12] font-medium",
    3: "font-display text-[1.375rem] leading-[1.2] font-semibold",
  }[nivel];
  return <Tag className={cx(estilos, className)}>{children}</Tag>;
}

// ---------------------------------------------------------------------------
// Marca
// ---------------------------------------------------------------------------
/**
 * Monograma JC (arquivo da marca, sem redesenho). `claro` é a versão para fundo
 * escuro: as letras ficam em off-white e o dourado é o mesmo.
 */
export function Monograma({ tamanho = 34, claro = false }: { tamanho?: number; claro?: boolean }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- arquivo pequeno e estático da marca
    <img
      src={claro ? "/brand/jc-monograma-claro.png" : "/brand/jc-monograma.png"}
      alt=""
      aria-hidden="true"
      width={Math.round((tamanho * 419) / 320)}
      height={tamanho}
      className="shrink-0"
      style={{ height: tamanho, width: "auto" }}
    />
  );
}

/** "Fio da continuidade": a linha contínua da identidade, com o ponto em terracota. */
export function FioContinuidade({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 600 30"
      preserveAspectRatio="none"
      className={cx("block h-[30px] w-full", className)}
    >
      <path
        d="M0 22 C 130 22, 170 5, 300 7 S 470 27, 600 6"
        fill="none"
        className="stroke-champanhe"
        strokeWidth="1.2"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx="300" cy="7" r="3" className="fill-terra" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Campos de formulário
// ---------------------------------------------------------------------------
export const campoClasses =
  "w-full rounded-[var(--radius-campo)] border border-linho bg-porcelana px-3 py-2.5 text-base font-normal text-cacau placeholder:text-mudo focus:border-terra-texto";

export function Campo({
  rotulo,
  id,
  ajuda,
  ...props
}: ComponentPropsWithoutRef<"input"> & { rotulo: string; id: string; ajuda?: string }) {
  return (
    <label htmlFor={id} className="grid gap-1.5 text-[13.5px] font-semibold">
      {rotulo}
      <input
        id={id}
        className={campoClasses}
        aria-describedby={ajuda ? `${id}-ajuda` : undefined}
        {...props}
      />
      {ajuda ? (
        <span id={`${id}-ajuda`} className="text-mudo text-[13px] font-normal">
          {ajuda}
        </span>
      ) : null}
    </label>
  );
}

export function Consentimento({
  id,
  obrigatorio,
  children,
  ...props
}: ComponentPropsWithoutRef<"input"> & { id: string; obrigatorio?: boolean; children: ReactNode }) {
  return (
    <label htmlFor={id} className="flex items-start gap-2.5 text-[14.5px]">
      <input
        id={id}
        type="checkbox"
        required={obrigatorio}
        className="accent-terra-texto mt-1.5 size-4 shrink-0"
        {...props}
      />
      <span>{children}</span>
    </label>
  );
}

/**
 * Escala de resposta 1–5 com "Não sei" (Documento Mestre §6.4; rótulos em validação).
 * Grupo de rádio nativo: navegável por teclado e lido corretamente por leitores de tela.
 */
export const ROTULOS_ESCALA = [
  [1, "Não existe"],
  [2, "Pontual"],
  [3, "Em construção"],
  [4, "Definido"],
  [5, "Estruturado"],
  [0, "Não sei"],
] as const;

export function EscalaResposta({
  nome,
  legenda,
  pergunta,
  valor,
}: {
  nome: string;
  legenda: string;
  pergunta: string;
  valor?: number;
}) {
  return (
    <fieldset className="border-linho grid min-w-0 gap-3 border-t py-5">
      <legend className="text-terra-texto float-left mb-1 w-full text-[12.5px] font-semibold">
        {legenda}
      </legend>
      <p className="font-display text-[1.2rem] leading-snug font-medium">{pergunta}</p>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {ROTULOS_ESCALA.map(([v, t]) => (
          <span key={v} className="relative">
            <input
              type="radio"
              id={`${nome}-${v}`}
              name={nome}
              value={v}
              defaultChecked={valor === v}
              className="peer absolute opacity-0"
            />
            <label
              htmlFor={`${nome}-${v}`}
              className="border-linho bg-papel text-mudo peer-checked:border-terra peer-checked:bg-blush peer-checked:text-terra-texto peer-focus-visible:outline-terra-texto grid h-full cursor-pointer gap-0.5 rounded-[var(--radius-campo)] border px-1.5 py-2 text-center text-xs peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2"
            >
              <b className="font-display text-cacau text-lg leading-none">{v || "?"}</b>
              {t}
            </label>
          </span>
        ))}
      </div>
    </fieldset>
  );
}
