"use client";

import { useState, type ComponentProps } from "react";
import type { Aviso } from "../../actions";
import { EditorRaioX } from "./editor";

/**
 * Guarda a mensagem de retorno fora do editor. O editor é recriado (key) quando os
 * dados do servidor mudam, por exemplo ao criar um período ou importar um arquivo;
 * sem isso, a confirmação sumiria junto.
 */
export function TelaRaioX({
  chave,
  ...props
}: { chave: string } & Omit<ComponentProps<typeof EditorRaioX>, "aviso" | "setAviso">) {
  const [aviso, setAviso] = useState<Aviso>(null);
  return <EditorRaioX key={chave} {...props} aviso={aviso} setAviso={setAviso} />;
}
