import { describe, expect, it } from "vitest";
import {
  agruparAgenda,
  comoInstante,
  diaDe,
  montarQuadro,
  dicaDaEtapa,
  novaOportunidadeSchema,
  proximaEtapa,
  oportunidadeSchema,
  tarefaSchema,
  type Etapa,
  type ItemAgenda,
  type Oportunidade,
} from "@/modules/funil/schema";

const ID = "3f0c2a1e-4b5d-4c6e-8f90-123456789abc";

describe("valor estimado", () => {
  const ler = (v: string) =>
    novaOportunidadeSchema.safeParse({ organization_id: ID, title: "Projeto", estimated_value: v });
  it.each([
    ["", null],
    ["50000", 50000],
    ["50.000", 50000],
    ["50.000,50", 50000.5],
    ["R$ 1.250.000,00", 1250000],
    ["12,5", 12.5],
  ])("%s", (texto, esperado) => {
    expect(ler(texto).data?.estimated_value).toBe(esperado);
  });
  it.each(["abc", "-10", "1e15"])("recusa %s", (texto) => {
    expect(ler(texto).success).toBe(false);
  });
});

describe("oportunidade e tarefa", () => {
  it("campos vazios viram nulos", () => {
    const r = oportunidadeSchema.parse({
      title: " Projeto ",
      estimated_value: "",
      stage_id: ID,
      next_action: " ",
      next_action_on: "",
      closed_reason: "",
    });
    expect(r).toEqual({
      title: "Projeto",
      estimated_value: null,
      stage_id: ID,
      next_action: null,
      next_action_on: null,
      closed_reason: null,
    });
  });
  it("exige empresa, descrição e prazo na tarefa", () => {
    expect(
      tarefaSchema.safeParse({ organization_id: ID, summary: "Ligar", due_on: "2026-05-10" })
        .success,
    ).toBe(true);
    expect(
      tarefaSchema.safeParse({ organization_id: "", summary: "Ligar", due_on: "2026-05-10" })
        .success,
    ).toBe(false);
    expect(
      tarefaSchema.safeParse({ organization_id: ID, summary: "Ligar", due_on: "10/05/2026" })
        .success,
    ).toBe(false);
  });
});

describe("datas", () => {
  it("o dia escolhido é o mesmo dia em Brasília", () => {
    expect(diaDe(comoInstante("2026-05-10"))).toBe("2026-05-10");
  });
  it("fim de noite em Brasília não vira o dia seguinte", () => {
    expect(diaDe("2026-05-11T02:30:00Z")).toBe("2026-05-10");
  });
});

describe("quadro do funil", () => {
  const etapas: Etapa[] = [
    { id: "b", name: "Proposta", position: 40, is_closed: false, is_won: false },
    { id: "a", name: "Novo", position: 10, is_closed: false, is_won: false },
    { id: "g", name: "Fechado", position: 60, is_closed: true, is_won: true },
    { id: "p", name: "Não avançou", position: 70, is_closed: true, is_won: false },
  ];
  const op = (id: string, stage_id: string, valor: number | null): Oportunidade => ({
    id,
    title: id,
    stage_id,
    empresa: "Empresa Fictícia",
    estimated_value: valor,
    next_action: null,
    next_action_at: null,
    closed_reason: null,
  });
  it("ordena as etapas e soma por coluna", () => {
    const q = montarQuadro(etapas, [
      op("1", "a", 10000),
      op("2", "a", null),
      op("3", "b", 30000),
      op("4", "g", 80000),
      op("5", "p", 5000),
    ]);
    expect(q.colunas.map((c) => c.etapa.id)).toEqual(["a", "b", "g", "p"]);
    expect(q.colunas[0]!.total).toBe(10000);
    expect(q.emAberto).toBe(3);
    expect(q.valorEmAberto).toBe(40000);
    expect(q.valorGanho).toBe(80000);
  });
});

describe("agenda", () => {
  const item = (id: string, dia: string): ItemAgenda => ({
    id,
    tipo: "tarefa",
    texto: id,
    empresa: "Empresa Fictícia",
    dia,
    href: "/",
  });
  it("separa por urgência e ordena por data", () => {
    const g = agruparAgenda(
      [
        item("depois", "2026-06-01"),
        item("hoje", "2026-05-10"),
        item("limite", "2026-05-17"),
        item("atrasada2", "2026-05-09"),
        item("atrasada1", "2026-04-30"),
        item("amanha", "2026-05-11"),
        item("oitavo", "2026-05-18"),
      ],
      "2026-05-10",
    );
    expect(g.atrasadas.map((i) => i.id)).toEqual(["atrasada1", "atrasada2"]);
    expect(g.hoje.map((i) => i.id)).toEqual(["hoje"]);
    expect(g.semana.map((i) => i.id)).toEqual(["amanha", "limite"]);
    expect(g.depois.map((i) => i.id)).toEqual(["oitavo", "depois"]);
  });
  it("virada de mês", () => {
    const g = agruparAgenda([item("x", "2026-02-03")], "2026-01-28");
    expect(g.semana).toHaveLength(1);
  });
});

describe("avançar no funil", () => {
  const e = (id: string, position: number, is_closed = false, is_won = false): Etapa => ({
    id,
    name: id,
    position,
    is_closed,
    is_won,
  });
  const etapas = [
    e("novo", 10),
    e("conversa", 20),
    e("ganho", 60, true, true),
    e("perdido", 70, true),
  ];

  it("vai para a etapa seguinte e chega ao ganho, nunca ao encerramento sem ganho", () => {
    expect(proximaEtapa(etapas, "novo")?.id).toBe("conversa");
    expect(proximaEtapa(etapas, "conversa")?.id).toBe("ganho");
    expect(proximaEtapa(etapas, "ganho")).toBeNull();
    expect(proximaEtapa(etapas, "inexistente")).toBeNull();
  });

  it("orienta o que fazer em cada etapa conhecida", () => {
    expect(dicaDaEtapa("Diagnóstico")).toContain("Raio-X");
    expect(dicaDaEtapa("Contrato fechado")).toContain("portal");
    expect(dicaDaEtapa("Etapa inventada")).toBeNull();
  });
});
