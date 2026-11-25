import { describe, expect, it } from "vitest";
import { analisarOrganograma, placar, resumoDoOrganograma } from "@/modules/organograma/analise";
import { compararEstruturas } from "@/modules/organograma/comparar";
import { cargoSchema, montarArvore, profundidade, type Cargo } from "@/modules/organograma/schema";
import { achadosDoOrganograma } from "@/modules/relatorio/montar";

/** Dados 100% fictícios. */
const cargo = (id: string, p: Partial<Cargo> = {}): Cargo => ({
  id,
  title: id,
  area: null,
  holder_name: `Pessoa ${id}`,
  is_family: false,
  is_owner: false,
  defined_role: true,
  has_backup: true,
  reports_to: null,
  also_reports_to: null,
  change_note: null,
  ...p,
});
const titulos = (c: Cargo[]) => analisarOrganograma(c).map((a) => a.titulo);

describe("árvore", () => {
  it("monta pela linha principal, em ordem alfabética, e conta os níveis", () => {
    const a = montarArvore([
      cargo("Diretoria"),
      cargo("Vendas", { reports_to: "Diretoria" }),
      cargo("Compras", { reports_to: "Diretoria" }),
      cargo("Vendedor", { reports_to: "Vendas" }),
    ]);
    expect(a.map((n) => n.cargo.title)).toEqual(["Diretoria"]);
    expect(a[0]!.filhos.map((n) => n.cargo.title)).toEqual(["Compras", "Vendas"]);
    expect(profundidade(a)).toBe(3);
  });
  it("superior inexistente vira topo e um ciclo não trava a montagem", () => {
    const a = montarArvore([
      cargo("A", { reports_to: "fantasma" }),
      cargo("B", { reports_to: "C" }),
      cargo("C", { reports_to: "B" }),
    ]);
    expect(a.map((n) => n.cargo.title)).toEqual(["A"]);
  });
});

describe("pontos de atenção", () => {
  it("estrutura saudável não gera pontos", () => {
    expect(
      analisarOrganograma([
        cargo("Diretoria"),
        cargo("Vendas", { reports_to: "Diretoria", area: "Comercial" }),
        cargo("Vendedor", { reports_to: "Vendas", area: "Comercial" }),
      ]),
    ).toEqual([]);
    expect(analisarOrganograma([])).toEqual([]);
  });

  it("dois topos e dupla subordinação", () => {
    const t = titulos([
      cargo("Diretoria"),
      cargo("Conselho"),
      cargo("Financeiro", { reports_to: "Diretoria", also_reports_to: "Conselho" }),
    ]);
    expect(t).toContain("Mais de um topo na estrutura");
    expect(t).toContain("Dupla subordinação");
  });

  it("amplitude de controle: atenção acima de 8 e crítico acima de 12", () => {
    const subs = (n: number) =>
      Array.from({ length: n }, (_, i) => cargo(`S${i}`, { reports_to: "Diretoria" }));
    expect(analisarOrganograma([cargo("Diretoria"), ...subs(8)])).toEqual([]);
    const nove = analisarOrganograma([cargo("Diretoria"), ...subs(9)]);
    expect(nove[0]).toMatchObject({
      nivel: "atencao",
      titulo: "Muitas pessoas respondendo a Diretoria",
    });
    expect(analisarOrganograma([cargo("Diretoria"), ...subs(13)])[0]!.nivel).toBe("critico");
  });

  it("sócio com vários cargos concentra decisões (crítico); acúmulo sem sócio é atenção", () => {
    const fundador = analisarOrganograma([
      cargo("Diretoria", { holder_name: "Fundador Fictício", is_owner: true }),
      cargo("Compras", { holder_name: "fundador  fictício", reports_to: "Diretoria" }),
    ]);
    expect(fundador[0]).toMatchObject({
      nivel: "critico",
      titulo: "Decisões concentradas em Fundador Fictício",
    });
    const acumulo = analisarOrganograma([
      cargo("Diretoria"),
      cargo("Compras", { holder_name: "Gestora Fictícia", reports_to: "Diretoria" }),
      cargo("Logística", { holder_name: "Gestora Fictícia", reports_to: "Diretoria" }),
    ]);
    expect(acumulo[0]).toMatchObject({
      nivel: "atencao",
      titulo: "Acúmulo de cargos: Gestora Fictícia",
    });
  });

  it("liderança sem substituto, familiar sem critérios e cargos vagos", () => {
    const a = analisarOrganograma([
      cargo("Diretoria", { has_backup: false }),
      cargo("Vendas", { reports_to: "Diretoria", is_family: true, defined_role: false }),
      cargo("Compras", { reports_to: "Diretoria", holder_name: null }),
      cargo("Produção", { reports_to: "Diretoria", holder_name: null }),
      cargo("Operador", { reports_to: "Produção" }),
    ]);
    const porTitulo = Object.fromEntries(a.map((x) => [x.titulo, x]));
    expect(porTitulo["Liderança sem substituto preparado"]!.nivel).toBe("critico");
    expect(porTitulo["Familiares sem papel e critérios definidos"]!.nivel).toBe("atencao");
    expect(porTitulo["Cargo de liderança vago"]!.texto).toContain("Produção");
    expect(porTitulo["Cargos vagos"]!.texto).toContain("Compras");
    // Críticos primeiro.
    expect(a.findIndex((x) => x.nivel === "atencao")).toBeGreaterThan(
      a.findLastIndex((x) => x.nivel === "critico"),
    );
  });

  it("área com dois responsáveis e área com responsável vago", () => {
    const t = titulos([
      cargo("Diretoria"),
      cargo("Gerente Comercial", { reports_to: "Diretoria", area: "Comercial" }),
      cargo("Coordenador Comercial", { reports_to: "Diretoria", area: "comercial" }),
      cargo("Gerente Financeiro", {
        reports_to: "Diretoria",
        area: "Financeiro",
        holder_name: null,
      }),
      cargo("Analista", { reports_to: "Gerente Financeiro", area: "Financeiro" }),
    ]);
    expect(t).toContain("Comercial: mais de um responsável");
    expect(t).toContain("Financeiro: área sem responsável");
  });

  it("muitos níveis hierárquicos", () => {
    const cadeia = Array.from({ length: 6 }, (_, i) =>
      cargo(`N${i}`, { reports_to: i ? `N${i - 1}` : null }),
    );
    expect(titulos(cadeia)).toContain("Muitos níveis hierárquicos");
    expect(resumoDoOrganograma(cadeia)).toMatchObject({
      cargos: 6,
      pessoas: 6,
      niveis: 6,
      vagos: 0,
    });
  });

  it("chaves estáveis e únicas para a matriz", () => {
    const a = analisarOrganograma([
      cargo("Diretoria", { holder_name: "Sócia Fictícia", is_owner: true, has_backup: false }),
      cargo("Compras", { holder_name: "Sócia Fictícia", reports_to: "Diretoria" }),
      cargo("Conselho"),
    ]);
    const chaves = a.map((x) => x.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
    expect(chaves).toContain("organograma-concentracao-socia-ficticia");
    expect(placar(a).critico).toBeGreaterThan(0);
  });
});

describe("comparação entre atual e proposta", () => {
  const atual = [
    cargo("Diretoria", { holder_name: "Fundador Fictício", is_owner: true, has_backup: false }),
    cargo("Compras", { holder_name: "Fundador Fictício", reports_to: "Diretoria" }),
    cargo("Vendas", { reports_to: "Diretoria", is_family: true, defined_role: false }),
    cargo("Almoxarifado", { reports_to: "Compras" }),
  ];
  const proposta = [
    cargo("p1", {
      title: "Diretoria",
      holder_name: "Fundador Fictício",
      is_owner: true,
      has_backup: true,
    }),
    cargo("p2", {
      title: "compras",
      holder_name: "Gestora Contratada",
      reports_to: "p1",
      change_note: "Libera o fundador para a estratégia.",
    }),
    cargo("p3", {
      title: "Vendas",
      holder_name: "Pessoa Vendas",
      reports_to: "p1",
      is_family: true,
      defined_role: true,
    }),
    cargo("p4", { title: "Controladoria", reports_to: "p1", change_note: "Dá visão de caixa." }),
  ];
  const c = compararEstruturas(atual, proposta);

  it("lista cargos novos, extintos e alterados com a justificativa", () => {
    expect(c.novos).toEqual([{ cargo: "Controladoria", justificativa: "Dá visão de caixa." }]);
    expect(c.extintos).toEqual(["Almoxarifado"]);
    const compras = c.alterados.find((m) => m.cargo === "compras")!;
    expect(compras.itens).toContain("Ocupante: Fundador Fictício → Gestora Contratada");
    expect(compras.justificativa).toBe("Libera o fundador para a estratégia.");
    expect(c.alterados.find((m) => m.cargo === "Vendas")!.itens).toEqual([
      "Papel e critérios passam a ser definidos",
    ]);
  });

  it("mostra os pontos resolvidos e o placar antes e depois", () => {
    expect(c.resolvidos).toEqual(
      expect.arrayContaining([
        "Decisões concentradas em Fundador Fictício",
        "Familiares sem papel e critérios definidos",
      ]),
    );
    expect(c.antes.critico).toBeGreaterThan(c.depois.critico);
  });

  it("alimenta o relatório executivo", () => {
    const a = achadosDoOrganograma(atual, proposta);
    expect(a[0]).toMatchObject({ gravidade: 3, origem: "organograma" });
    expect(a.at(-1)!.mensagem).toMatch(/^A estrutura proposta pela JC resolve \d+ pontos/);
    expect(achadosDoOrganograma([], proposta)).toEqual([]);
  });
});

describe("formulário do cargo", () => {
  const base = {
    title: " Gerente ",
    area: "",
    holder_name: "",
    is_family: false,
    is_owner: false,
    defined_role: false,
    has_backup: false,
    reports_to: "",
    also_reports_to: "",
    change_note: "",
  };
  it("limpa vazios e exige superior principal antes do segundo", () => {
    expect(cargoSchema.parse(base)).toMatchObject({
      title: "Gerente",
      holder_name: null,
      reports_to: null,
    });
    const id = "6f1b8f2e-2a5d-4c1e-9a0b-1c2d3e4f5a6b";
    expect(cargoSchema.safeParse({ ...base, also_reports_to: id }).success).toBe(false);
    expect(cargoSchema.safeParse({ ...base, reports_to: id, also_reports_to: id }).success).toBe(
      false,
    );
    expect(cargoSchema.safeParse({ ...base, reports_to: "x" }).success).toBe(false);
  });
});
