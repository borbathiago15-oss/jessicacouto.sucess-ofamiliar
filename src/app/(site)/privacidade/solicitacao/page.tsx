import type { Metadata } from "next";
import { Titulo } from "@/components/ui";
import { FormularioTitular } from "./formulario";

export const metadata: Metadata = { title: "Seus direitos sobre os dados" };

export default function SolicitacaoTitularPage() {
  return (
    <div className="grid gap-6">
      <div className="grid max-w-[62ch] gap-3">
        <Titulo>Seus direitos sobre os dados</Titulo>
        <p className="text-mudo">
          Pela Lei Geral de Proteção de Dados, você pode pedir acesso, correção, exclusão,
          portabilidade dos seus dados ou revogar um consentimento. O pedido fica registrado e é
          respondido no e-mail informado.
        </p>
      </div>
      <FormularioTitular />
    </div>
  );
}
