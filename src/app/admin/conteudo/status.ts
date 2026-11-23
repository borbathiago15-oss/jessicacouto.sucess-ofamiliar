import type { Tom } from "@/components/ui";

export const ROTULO_STATUS: Record<string, [string, Tom]> = {
  draft: ["Rascunho", "neutro"],
  in_review: ["Em revisão", "atencao"],
  published: ["Publicado", "ok"],
  archived: ["Arquivado", "neutro"],
};
