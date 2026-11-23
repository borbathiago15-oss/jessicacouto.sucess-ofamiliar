import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicEnv } from "@/lib/env/public";
import type { ItemPrioridade } from "@/modules/prioridades/schema";
import { CorpoRelatorio, prepararRelatorio } from "@/modules/relatorio/relatorio";

export const metadata: Metadata = {
  title: "Relatório Executivo (exemplo fictício)",
  robots: { index: false, follow: false },
};

const item = (p: Partial<ItemPrioridade> & { title: string }): ItemPrioridade => ({
  id: p.title,
  description: null,
  origin: "manual",
  impact: 3,
  urgency: 3,
  effort: 3,
  phase: "plan",
  why: null,
  responsible: null,
  due_on: null,
  indicator: null,
  target: null,
  result: null,
  learning: null,
  ...p,
});

/**
 * Exemplo do Relatório Executivo com uma empresa 100% fictícia, para revisar o
 * visual sem banco de dados. Disponível só fora de produção.
 */
export default async function RelatorioExemploPage({
  searchParams,
}: {
  searchParams: Promise<{ modo?: string }>;
}) {
  if (publicEnv.NEXT_PUBLIC_APP_ENV === "production") notFound();
  const apresentacao = (await searchParams).modo === "apresentacao";

  const base = {
    receitaBruta: 10_000_000,
    deducoes: 1_500_000,
    cmv: 5_200_000,
    despesasOperacionais: 1_900_000,
    depreciacao: 150_000,
    despesasFinanceiras: 260_000,
    receitasFinanceiras: 20_000,
    impostosLucro: 180_000,
    proLabore: 480_000,
    salariosFamiliares: 240_000,
    despesasPessoais: 120_000,
    distribuicoes: 600_000,
    caixa: 400_000,
    receber: 1_600_000,
    estoques: 1_300_000,
    outrosAC: 100_000,
    imobilizado: 2_000_000,
    fornecedores: 900_000,
    emprestimosCP: 700_000,
    outrosPC: 350_000,
    emprestimosLP: 1_200_000,
    patrimonioLiquido: 2_250_000,
  };

  const d = prepararRelatorio({
    empresaNome: "Empresa Fictícia Ltda.",
    periodos: [
      {
        rotulo: "2024",
        meses: 12,
        valores: {
          ...base,
          receitaBruta: 9_200_000,
          cmv: 4_900_000,
          distribuicoes: 300_000,
          caixa: 700_000,
        },
      },
      { rotulo: "2025", meses: 12, valores: base },
    ],
    membros: [
      {
        nome: "Fundador Fictício",
        papel: "founder",
        cargo: "Diretor-presidente",
        is_family: true,
        generation: 1,
        ownership_pct: 60,
        works_in_company: true,
        successor_status: "none",
      },
      {
        nome: "Cônjuge Fictícia",
        papel: "other",
        cargo: null,
        is_family: true,
        generation: 1,
        ownership_pct: 20,
        works_in_company: false,
        successor_status: "none",
      },
      {
        nome: "Filha Fictícia",
        papel: "heir",
        cargo: "Gerente comercial",
        is_family: true,
        generation: 2,
        ownership_pct: 10,
        works_in_company: true,
        successor_status: "potential",
      },
      {
        nome: "Filho Fictício",
        papel: "heir",
        cargo: null,
        is_family: true,
        generation: 2,
        ownership_pct: 10,
        works_in_company: false,
        successor_status: "none",
      },
      {
        nome: "Gestor Fictício",
        papel: "manager",
        cargo: "Diretor financeiro",
        is_family: false,
        generation: null,
        ownership_pct: null,
        works_in_company: true,
        successor_status: "none",
      },
    ],
    itens: [
      item({
        title: "Separar despesas da família das contas da empresa",
        impact: 5,
        urgency: 5,
        responsible: "Fundador Fictício",
        due_on: "2027-01-31",
        phase: "do",
      }),
      item({
        title: "Definir política de retiradas da família",
        impact: 5,
        urgency: 4,
        responsible: "Conselho de família",
        due_on: "2027-02-28",
      }),
      item({
        title: "Plano de desenvolvimento da sucessora",
        impact: 5,
        urgency: 3,
        due_on: "2027-09-30",
      }),
      item({
        title: "Renegociar dívida de curto prazo",
        impact: 4,
        urgency: 3,
        responsible: "Diretor financeiro",
      }),
    ],
    mensagensSalvas: [],
    decisoes: [
      "Qual teto de retiradas a família aceita até o caixa se recompor?",
      "Quem conduz a escolha do sucessor e em que prazo?",
    ],
    config: {
      consultant_name: "Consultora Fictícia",
      consultant_title: "Consultora em sucessão familiar",
      credentials: "Texto fictício de credenciais.",
      methodology:
        "Texto fictício de metodologia. A JC substitui este texto na configuração dos relatórios.",
      limitations: "Texto fictício de limitações.",
    },
    hoje: "2026-11-23",
    emissao: new Date("2026-11-23T12:00:00-03:00"),
  });

  return (
    <main
      className={`mx-auto grid gap-10 px-6 py-10 print:max-w-none print:gap-0 print:p-0 ${apresentacao ? "max-w-[1180px]" : "max-w-[860px]"}`}
    >
      <style>
        {apresentacao
          ? "@page { size: A4 landscape; margin: 0 }"
          : "@page { size: A4; margin: 16mm 14mm }"}
      </style>
      <p className="bg-atencao-fundo text-atencao m-0 rounded-[10px] px-3 py-2 text-sm print:hidden">
        Exemplo com dados 100% fictícios.{" "}
        <Link
          href={apresentacao ? "/design/relatorio" : "/design/relatorio?modo=apresentacao"}
          className="underline"
        >
          {apresentacao ? "Ver como documento" : "Ver como apresentação"}
        </Link>
      </p>
      <CorpoRelatorio d={d} apresentacao={apresentacao} />
    </main>
  );
}
