import { describe, expect, it } from "vitest";
import {
  conteudoConfere,
  novoPedidoSchema,
  pedidosPortalSchema,
  pendentes,
  type PedidoPortal,
} from "@/modules/cofre/pedidos";

const bytes = (...v: number[]) => new Uint8Array([...v, ...new Array(16).fill(0x20)]);

describe("conteúdo do arquivo confere com o tipo", () => {
  it("aceita PDF, PNG, JPEG, Office e texto verdadeiros", () => {
    expect(conteudoConfere(bytes(0x25, 0x50, 0x44, 0x46), "application/pdf")).toBe(true);
    expect(conteudoConfere(bytes(0x89, 0x50, 0x4e, 0x47), "image/png")).toBe(true);
    expect(conteudoConfere(bytes(0xff, 0xd8, 0xff), "image/jpeg")).toBe(true);
    expect(
      conteudoConfere(
        bytes(0x50, 0x4b, 0x03, 0x04),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    ).toBe(true);
    expect(conteudoConfere(bytes(0xd0, 0xcf, 0x11, 0xe0), "application/vnd.ms-excel")).toBe(true);
    expect(conteudoConfere(new TextEncoder().encode("a;b\n1;2"), "text/csv")).toBe(true);
  });

  it("recusa executável com nome de PDF e binário como texto", () => {
    expect(conteudoConfere(bytes(0x4d, 0x5a), "application/pdf")).toBe(false); // "MZ" (.exe)
    expect(conteudoConfere(new Uint8Array([0x41, 0x00, 0x42]), "text/plain")).toBe(false);
    expect(conteudoConfere(bytes(0x25, 0x50, 0x44, 0x46), "application/zip")).toBe(false);
  });
});

describe("pedido da equipe", () => {
  it("limpa campos opcionais vazios", () => {
    const r = novoPedidoSchema.parse({
      title: "  Contrato social  ",
      category: "societario",
      note: "",
      due_on: "",
      assignee: "",
    });
    expect(r).toEqual({
      title: "Contrato social",
      category: "societario",
      note: null,
      due_on: null,
      assignee: null,
    });
  });
  it("exige o nome do documento e categoria conhecida", () => {
    expect(novoPedidoSchema.safeParse({ title: " ", category: "societario" }).success).toBe(false);
    expect(novoPedidoSchema.safeParse({ title: "DRE", category: "x" }).success).toBe(false);
  });
});

describe("pedidos no portal", () => {
  const base: PedidoPortal = {
    id: "00000000-0000-4000-8000-000000000001",
    title: "DRE 2025",
    category: "financeiro",
    note: null,
    due_on: null,
    status: "open",
    review_note: null,
    para_mim: false,
    meus: [],
    de_outros: 0,
  };
  it("aceita o formato do banco", () => {
    expect(pedidosPortalSchema.safeParse([base]).success).toBe(true);
  });
  it("pendências são as abertas e as que pedem ajuste", () => {
    const lista = (["open", "sent", "accepted", "needs_changes"] as const).map((status) => ({
      ...base,
      status,
    }));
    expect(pendentes(lista).map((p) => p.status)).toEqual(["open", "needs_changes"]);
  });
});
