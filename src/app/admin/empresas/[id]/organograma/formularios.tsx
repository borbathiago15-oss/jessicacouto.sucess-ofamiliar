"use client";

import { useActionState, useState, useTransition } from "react";
import { Botao, campoClasses } from "@/components/ui";
import type { AchadoOrganograma } from "@/modules/organograma/analise";
import type { Cargo, Cenario } from "@/modules/organograma/schema";
import {
  compartilharProposta,
  copiarAtual,
  criarCargo,
  excluirCargo,
  levarParaMatriz,
  salvarCargo,
  salvarResumo,
  type Aviso,
} from "./actions";

const rotulo = "grid gap-1 text-[13px] font-semibold";
const caixa = "flex items-start gap-2 text-[13px]";

function Mensagem({ aviso, testid }: { aviso: Aviso; testid: string }) {
  if (!aviso) return null;
  return (
    <p
      role="status"
      data-testid={testid}
      className={aviso.ok ? "text-ok m-0 text-sm" : "text-critico m-0 text-sm"}
    >
      {aviso.mensagem}
    </p>
  );
}

type Opcao = { id: string; title: string; holder_name: string | null };

function Superior({
  p,
  nome,
  rot,
  valor,
  outros,
}: {
  p: string;
  nome: "reports_to" | "also_reports_to";
  rot: string;
  valor?: string | null;
  outros: Opcao[];
}) {
  return (
    <label htmlFor={`${p}-${nome}`} className={rotulo}>
      {rot}
      <select id={`${p}-${nome}`} name={nome} className={campoClasses} defaultValue={valor ?? ""}>
        <option value="">{nome === "reports_to" ? "Ninguém (topo)" : "Nenhum"}</option>
        {outros.map((o) => (
          <option key={o.id} value={o.id}>
            {o.title}
            {o.holder_name ? ` (${o.holder_name})` : " (vago)"}
          </option>
        ))}
      </select>
    </label>
  );
}

function CamposCargo({
  p,
  c,
  opcoes,
  cenario,
}: {
  p: string;
  c?: Cargo;
  opcoes: Opcao[];
  cenario: Cenario;
}) {
  const outros = opcoes.filter((o) => o.id !== c?.id);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <label htmlFor={`${p}-title`} className={rotulo}>
          Cargo
          <input
            id={`${p}-title`}
            name="title"
            className={campoClasses}
            required
            maxLength={120}
            defaultValue={c?.title ?? ""}
          />
        </label>
        <label htmlFor={`${p}-holder`} className={rotulo}>
          Quem ocupa (vazio = vago)
          <input
            id={`${p}-holder`}
            name="holder_name"
            className={campoClasses}
            maxLength={200}
            defaultValue={c?.holder_name ?? ""}
          />
        </label>
        <label htmlFor={`${p}-area`} className={rotulo}>
          Área
          <input
            id={`${p}-area`}
            name="area"
            className={campoClasses}
            maxLength={120}
            defaultValue={c?.area ?? ""}
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Superior p={p} outros={outros} nome="reports_to" rot="Responde a" valor={c?.reports_to} />
        <Superior
          p={p}
          outros={outros}
          nome="also_reports_to"
          rot="Também responde a (dupla subordinação)"
          valor={c?.also_reports_to}
        />
      </div>
      <fieldset className="border-linho grid min-w-0 gap-2 rounded-[var(--radius-campo)] border p-3 sm:grid-cols-2">
        <legend className="px-1 text-[13px] font-semibold">Sobre quem ocupa</legend>
        <label className={caixa}>
          <input type="checkbox" name="is_family" defaultChecked={c?.is_family} /> É da família
        </label>
        <label className={caixa}>
          <input type="checkbox" name="is_owner" defaultChecked={c?.is_owner} /> É sócio(a)
        </label>
        <label className={caixa}>
          <input type="checkbox" name="defined_role" defaultChecked={c?.defined_role} /> Papel,
          critério de entrada e remuneração definidos
        </label>
        <label className={caixa}>
          <input type="checkbox" name="has_backup" defaultChecked={c?.has_backup} /> Tem substituto
          preparado
        </label>
      </fieldset>
      {cenario === "proposed" ? (
        <label htmlFor={`${p}-nota`} className={rotulo}>
          Por que esta mudança (aparece na comparação e no portal)
          <textarea
            id={`${p}-nota`}
            name="change_note"
            rows={2}
            maxLength={1000}
            className={campoClasses}
            defaultValue={c?.change_note ?? ""}
          />
        </label>
      ) : null}
    </>
  );
}

export function NovoCargo({
  empresaId,
  cenario,
  opcoes,
}: {
  empresaId: string;
  cenario: Cenario;
  opcoes: Opcao[];
}) {
  const [aviso, acao, pendente] = useActionState(criarCargo.bind(null, empresaId, cenario), null);
  return (
    <form action={acao} className="grid gap-3">
      <CamposCargo p={`novo-${cenario}`} opcoes={opcoes} cenario={cenario} />
      <div>
        <Botao type="submit" disabled={pendente}>
          Incluir cargo
        </Botao>
      </div>
      <Mensagem aviso={aviso} testid="cargo-aviso" />
    </form>
  );
}

export function EditarCargo({
  empresaId,
  cargo,
  cenario,
  opcoes,
}: {
  empresaId: string;
  cargo: Cargo;
  cenario: Cenario;
  opcoes: Opcao[];
}) {
  const [aviso, acao, pendente] = useActionState(salvarCargo.bind(null, empresaId, cargo.id), null);
  const [confirmar, setConfirmar] = useState(false);
  const [excluindo, iniciar] = useTransition();
  const [erro, setErro] = useState<Aviso>(null);
  return (
    <details className="mt-1">
      <summary
        className="text-terra-texto w-fit cursor-pointer text-[13px] font-semibold"
        aria-label={`Editar ${cargo.title}`}
      >
        Editar
      </summary>
      <form action={acao} className="mt-2 grid gap-3">
        <CamposCargo p={`c-${cargo.id}`} c={cargo} opcoes={opcoes} cenario={cenario} />
        <div className="flex flex-wrap items-center gap-3">
          <Botao type="submit" tamanho="pequeno" disabled={pendente}>
            Salvar
          </Botao>
          {confirmar ? (
            <>
              <Botao
                type="button"
                tamanho="pequeno"
                variante="secundario"
                disabled={excluindo}
                onClick={() =>
                  iniciar(async () => setErro(await excluirCargo(empresaId, cargo.id)))
                }
              >
                Confirmar exclusão
              </Botao>
              <button
                type="button"
                className="text-sm underline"
                onClick={() => setConfirmar(false)}
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              type="button"
              className="text-critico text-sm underline"
              onClick={() => setConfirmar(true)}
            >
              Excluir cargo
            </button>
          )}
        </div>
        <Mensagem aviso={erro ?? aviso} testid="cargo-edicao-aviso" />
      </form>
    </details>
  );
}

export function CopiarAtual({ empresaId, substitui }: { empresaId: string; substitui: boolean }) {
  const [aviso, setAviso] = useState<Aviso>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [pendente, iniciar] = useTransition();
  const copiar = () =>
    iniciar(async () => {
      setAviso(await copiarAtual(empresaId));
      setConfirmar(false);
    });
  return (
    <div className="grid gap-2">
      {substitui && confirmar ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-critico text-sm">A proposta atual será apagada e recomeçada.</span>
          <Botao type="button" tamanho="pequeno" disabled={pendente} onClick={copiar}>
            Recomeçar a proposta
          </Botao>
          <button type="button" className="text-sm underline" onClick={() => setConfirmar(false)}>
            Cancelar
          </button>
        </div>
      ) : (
        <div>
          <Botao
            type="button"
            tamanho="pequeno"
            variante={substitui ? "secundario" : "primario"}
            disabled={pendente}
            onClick={() => (substitui ? setConfirmar(true) : copiar())}
          >
            {substitui
              ? "Recomeçar a partir da estrutura atual"
              : "Começar a partir da estrutura atual"}
          </Botao>
        </div>
      )}
      <Mensagem aviso={aviso} testid="copiar-aviso" />
    </div>
  );
}

export function ResumoProposta({ empresaId, valor }: { empresaId: string; valor: string | null }) {
  const [aviso, acao, pendente] = useActionState(salvarResumo.bind(null, empresaId), null);
  return (
    <form action={acao} className="grid gap-3">
      <label htmlFor="resumo-proposta" className={rotulo}>
        O racional da proposta, em poucas linhas
        <textarea
          id="resumo-proposta"
          name="proposal_summary"
          rows={4}
          maxLength={3000}
          className={campoClasses}
          defaultValue={valor ?? ""}
        />
        <span className="text-mudo text-xs font-normal">
          Aparece no topo da comparação e, se publicada, no portal do cliente.
        </span>
      </label>
      <div>
        <Botao type="submit" tamanho="pequeno" disabled={pendente}>
          Salvar racional
        </Botao>
      </div>
      <Mensagem aviso={aviso} testid="resumo-aviso" />
    </form>
  );
}

export function CompartilharProposta({
  empresaId,
  compartilhada,
}: {
  empresaId: string;
  compartilhada: boolean;
}) {
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <div className="grid gap-2">
      <div>
        <Botao
          type="button"
          tamanho="pequeno"
          variante={compartilhada ? "secundario" : "primario"}
          disabled={pendente}
          onClick={() =>
            iniciar(async () => setAviso(await compartilharProposta(empresaId, !compartilhada)))
          }
        >
          {compartilhada ? "Retirar do portal" : "Publicar no portal do cliente"}
        </Botao>
      </div>
      <Mensagem aviso={aviso} testid="compartilhar-aviso" />
    </div>
  );
}

export function PontosComMatriz({
  empresaId,
  achados,
  podeLevar,
}: {
  empresaId: string;
  achados: AchadoOrganograma[];
  podeLevar: boolean;
}) {
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <div className="grid gap-2">
      <ul className="m-0 grid list-none gap-2 p-0" data-testid="organograma-pontos">
        {achados.map((a) => (
          <li
            key={a.chave}
            className={
              a.nivel === "critico"
                ? "bg-critico-fundo grid gap-1 rounded-[10px] px-3 py-2.5"
                : "bg-atencao-fundo grid gap-1 rounded-[10px] px-3 py-2.5"
            }
          >
            <b className={a.nivel === "critico" ? "text-critico" : "text-atencao"}>
              {a.nivel === "critico" ? "Crítico" : "Atenção"}: {a.titulo}
            </b>
            <span className="text-[14px]">{a.texto}</span>
            {podeLevar ? (
              <button
                type="button"
                className="text-terra-texto w-fit text-[13px] font-semibold underline"
                aria-label={`Levar para a Matriz de Prioridades: ${a.titulo}`}
                disabled={pendente}
                onClick={() => iniciar(async () => setAviso(await levarParaMatriz(empresaId, a)))}
              >
                Levar para a Matriz de Prioridades
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <Mensagem aviso={aviso} testid="matriz-aviso" />
    </div>
  );
}
