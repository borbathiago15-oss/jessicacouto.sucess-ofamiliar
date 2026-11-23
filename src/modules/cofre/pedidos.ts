import { z } from "zod";
import { CATEGORIAS_COFRE } from "./tipos";

/** Pedidos de documentos: a JC pede, o familiar envia pelo portal. */
export const STATUS_PEDIDO = ["open", "sent", "accepted", "needs_changes", "cancelled"] as const;
export type StatusPedido = (typeof STATUS_PEDIDO)[number];

/** Rótulos para a equipe. */
export const ROTULO_STATUS_PEDIDO: Record<StatusPedido, string> = {
  open: "Pendente",
  sent: "Enviado, aguardando análise",
  accepted: "Recebido",
  needs_changes: "Precisa de ajuste",
  cancelled: "Cancelado",
};

/** Rótulos para o cliente (do ponto de vista de quem envia). */
export const ROTULO_STATUS_CLIENTE: Record<StatusPedido, string> = {
  open: "Pendente",
  sent: "Enviado. A Jéssica vai analisar",
  accepted: "Recebido pela Jéssica",
  needs_changes: "A Jéssica pediu um ajuste",
  cancelled: "Cancelado",
};

export const TOM_STATUS_PEDIDO: Record<
  StatusPedido,
  "ok" | "atencao" | "critico" | "neutro" | "marca"
> = {
  open: "atencao",
  sent: "marca",
  accepted: "ok",
  needs_changes: "critico",
  cancelled: "neutro",
};

/** Formulário da equipe para criar um pedido. */
export const novoPedidoSchema = z.object({
  title: z.string().trim().min(1, "Diga qual documento é necessário.").max(200),
  category: z.enum(CATEGORIAS_COFRE),
  note: z
    .string()
    .trim()
    .max(500)
    .transform((v) => v || null),
  due_on: z.union([z.iso.date(), z.literal("")]).transform((v) => v || null),
  assignee: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
});

/** O que o cliente recebe de portal_document_requests (o banco já filtrou). */
export const pedidosPortalSchema = z.array(
  z.object({
    id: z.uuid(),
    title: z.string(),
    category: z.enum(CATEGORIAS_COFRE),
    note: z.string().nullable(),
    due_on: z.string().nullable(),
    status: z.enum(STATUS_PEDIDO),
    review_note: z.string().nullable(),
    para_mim: z.boolean(),
    meus: z.array(
      z.object({
        id: z.uuid(),
        file_name: z.string(),
        size_bytes: z.number(),
        uploaded_at: z.string(),
        acessos: z.number(),
        ultimo_acesso: z.string().nullable(),
      }),
    ),
    de_outros: z.number(),
  }),
);
export type PedidoPortal = z.infer<typeof pedidosPortalSchema>[number];

/** Pendências: o que ainda depende do cliente. */
export function pendentes(pedidos: PedidoPortal[]): PedidoPortal[] {
  return pedidos.filter((p) => p.status === "open" || p.status === "needs_changes");
}

const comeca = (b: Uint8Array, ...assinatura: number[]) => assinatura.every((v, i) => b[i] === v);

/**
 * Confere se o conteúdo do arquivo bate com o tipo declarado (assinatura dos
 * primeiros bytes). Evita, por exemplo, um executável enviado com nome ".pdf".
 */
export function conteudoConfere(bytes: Uint8Array, tipo: string): boolean {
  switch (tipo) {
    case "application/pdf":
      return comeca(bytes, 0x25, 0x50, 0x44, 0x46); // %PDF
    case "image/png":
      return comeca(bytes, 0x89, 0x50, 0x4e, 0x47);
    case "image/jpeg":
      return comeca(bytes, 0xff, 0xd8, 0xff);
    case "image/webp":
      return comeca(bytes, 0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45;
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      return comeca(bytes, 0x50, 0x4b, 0x03, 0x04); // ZIP (Office moderno)
    case "application/msword":
    case "application/vnd.ms-excel":
      return comeca(bytes, 0xd0, 0xcf, 0x11, 0xe0); // Office antigo
    case "text/plain":
    case "text/csv":
      return !bytes.subarray(0, 8192).includes(0); // texto não tem byte nulo
    default:
      return false;
  }
}
