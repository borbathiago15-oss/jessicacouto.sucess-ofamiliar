"use client";

import { useActionState, useState, useTransition } from "react";
import { Botao, campoClasses } from "@/components/ui";
import {
  PAPEIS,
  ROTULO_PAPEL,
  ROTULO_REGISTRO,
  ROTULO_SUCESSAO,
  SITUACOES_SUCESSAO,
  TIPOS_REGISTRO,
} from "@/modules/familia/schema";
import {
  adicionarPessoa,
  atualizarPessoa,
  desvincularPessoa,
  registrarNoHistorico,
  type Aviso,
} from "./actions";

export type PessoaTela = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  declared_role: string;
  role_in_org: string | null;
  is_family: boolean;
  kinship: string | null;
  generation: number | null;
  ownership_pct: number | null;
  works_in_company: boolean;
  area: string | null;
  successor_status: string;
};

const rotulo = "grid gap-1 text-[13px] font-semibold";

function Mensagem({ aviso, testid }: { aviso: Aviso; testid: string }) {
  if (!aviso) return null;
  return (
    <p
      role="status"
      data-testid={testid}
      className={aviso.ok ? "text-ok text-sm" : "text-critico text-sm"}
    >
      {aviso.mensagem}
    </p>
  );
}

/** Campos de pessoa e vínculo. `p` é o prefixo dos ids (um formulário por pessoa). */
function Campos({ p, v }: { p: string; v?: PessoaTela }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label htmlFor={`${p}-nome`} className={rotulo}>
        Nome completo
        <input
          id={`${p}-nome`}
          name="full_name"
          className={campoClasses}
          defaultValue={v?.full_name}
          required
          maxLength={200}
        />
      </label>
      <label htmlFor={`${p}-papel`} className={rotulo}>
        Papel
        <select
          id={`${p}-papel`}
          name="declared_role"
          className={campoClasses}
          defaultValue={v?.declared_role ?? "other"}
        >
          {PAPEIS.map((x) => (
            <option key={x} value={x}>
              {ROTULO_PAPEL[x]}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor={`${p}-cargo`} className={rotulo}>
        Cargo na empresa
        <input
          id={`${p}-cargo`}
          name="role_in_org"
          className={campoClasses}
          defaultValue={v?.role_in_org ?? ""}
          maxLength={120}
        />
      </label>
      <label htmlFor={`${p}-area`} className={rotulo}>
        Área
        <input
          id={`${p}-area`}
          name="area"
          className={campoClasses}
          defaultValue={v?.area ?? ""}
          maxLength={120}
        />
      </label>
      <label htmlFor={`${p}-parentesco`} className={rotulo}>
        Parentesco com o(a) fundador(a)
        <input
          id={`${p}-parentesco`}
          name="kinship"
          className={campoClasses}
          defaultValue={v?.kinship ?? ""}
          maxLength={80}
          placeholder="Ex.: filha, genro, sobrinho"
        />
      </label>
      <label htmlFor={`${p}-geracao`} className={rotulo}>
        Geração (1 = fundadora)
        <input
          id={`${p}-geracao`}
          name="generation"
          type="number"
          min={1}
          max={6}
          className={campoClasses}
          defaultValue={v?.generation ?? ""}
        />
      </label>
      <label htmlFor={`${p}-participacao`} className={rotulo}>
        Participação societária (%)
        <input
          id={`${p}-participacao`}
          name="ownership_pct"
          inputMode="decimal"
          className={campoClasses}
          defaultValue={v?.ownership_pct ?? ""}
        />
      </label>
      <label htmlFor={`${p}-sucessao`} className={rotulo}>
        Situação na sucessão
        <select
          id={`${p}-sucessao`}
          name="successor_status"
          className={campoClasses}
          defaultValue={v?.successor_status ?? "none"}
        >
          {SITUACOES_SUCESSAO.map((x) => (
            <option key={x} value={x}>
              {ROTULO_SUCESSAO[x]}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor={`${p}-email`} className={rotulo}>
        E-mail (opcional)
        <input
          id={`${p}-email`}
          name="email"
          type="email"
          className={campoClasses}
          defaultValue={v?.email ?? ""}
          maxLength={254}
        />
      </label>
      <label htmlFor={`${p}-telefone`} className={rotulo}>
        Telefone (opcional)
        <input
          id={`${p}-telefone`}
          name="phone"
          className={campoClasses}
          defaultValue={v?.phone ?? ""}
          maxLength={40}
        />
      </label>
      <div className="grid content-end gap-2 text-[14px]">
        <label htmlFor={`${p}-familia`} className="flex items-center gap-2">
          <input
            id={`${p}-familia`}
            name="is_family"
            type="checkbox"
            className="accent-terra-texto size-4"
            defaultChecked={v?.is_family ?? true}
          />
          É da família
        </label>
        <label htmlFor={`${p}-trabalha`} className="flex items-center gap-2">
          <input
            id={`${p}-trabalha`}
            name="works_in_company"
            type="checkbox"
            className="accent-terra-texto size-4"
            defaultChecked={v?.works_in_company ?? false}
          />
          Trabalha na empresa
        </label>
      </div>
    </div>
  );
}

export function NovaPessoa({ empresaId }: { empresaId: string }) {
  const [aviso, acao, pendente] = useActionState(adicionarPessoa.bind(null, empresaId), null);
  return (
    <form action={acao} className="grid gap-3">
      <Campos p="nova" />
      <div>
        <Botao type="submit" disabled={pendente}>
          Incluir pessoa
        </Botao>
      </div>
      <Mensagem aviso={aviso} testid="familia-aviso" />
    </form>
  );
}

export function EditarPessoa({ empresaId, pessoa }: { empresaId: string; pessoa: PessoaTela }) {
  const [aviso, acao, pendente] = useActionState(
    atualizarPessoa.bind(null, empresaId, pessoa.id),
    null,
  );
  const [avisoRemocao, setAvisoRemocao] = useState<Aviso>(null);
  const [removendo, iniciar] = useTransition();
  return (
    <details className="border-linho rounded-[var(--radius-campo)] border px-3 py-2">
      <summary className="text-terra-texto cursor-pointer text-sm font-semibold">
        Editar<span className="sr-only"> {pessoa.full_name}</span>
      </summary>
      <form action={acao} className="mt-3 grid gap-3">
        <Campos p={`p-${pessoa.id}`} v={pessoa} />
        <div className="flex flex-wrap gap-2">
          <Botao type="submit" tamanho="pequeno" disabled={pendente}>
            Salvar
          </Botao>
          <Botao
            type="button"
            variante="secundario"
            tamanho="pequeno"
            disabled={removendo}
            onClick={() => {
              if (!window.confirm(`Remover ${pessoa.full_name} desta empresa?`)) return;
              iniciar(async () => setAvisoRemocao(await desvincularPessoa(empresaId, pessoa.id)));
            }}
          >
            Remover desta empresa
          </Botao>
        </div>
        <Mensagem aviso={aviso ?? avisoRemocao} testid="familia-edicao-aviso" />
      </form>
    </details>
  );
}

export function NovoRegistro({ empresaId, hoje }: { empresaId: string; hoje: string }) {
  const [aviso, acao, pendente] = useActionState(registrarNoHistorico.bind(null, empresaId), null);
  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-[12rem_12rem_1fr]">
      <label htmlFor="reg-tipo" className={rotulo}>
        Tipo
        <select id="reg-tipo" name="kind" className={campoClasses} defaultValue="meeting">
          {TIPOS_REGISTRO.map((t) => (
            <option key={t} value={t}>
              {ROTULO_REGISTRO[t]}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor="reg-data" className={rotulo}>
        Data
        <input
          id="reg-data"
          name="occurred_on"
          type="date"
          className={campoClasses}
          defaultValue={hoje}
          max={hoje}
          required
        />
      </label>
      <label htmlFor="reg-resumo" className={`${rotulo} sm:col-span-3`}>
        O que aconteceu
        <textarea
          id="reg-resumo"
          name="summary"
          rows={3}
          className={campoClasses}
          required
          maxLength={2000}
        />
      </label>
      <div className="grid gap-2 sm:col-span-3">
        <div>
          <Botao type="submit" disabled={pendente}>
            Registrar
          </Botao>
        </div>
        <Mensagem aviso={aviso} testid="historico-aviso" />
      </div>
    </form>
  );
}
