import { enforceAdminRoute } from "@/lib/auth/guard";
import { AuthCard } from "../../_components/auth-card";
import { EnrollForm } from "./enroll-form";

export default async function EnrollMfaPage() {
  await enforceAdminRoute("/admin/mfa/cadastrar");
  return (
    <AuthCard
      title="Cadastre seu autenticador"
      description="O acesso ao ambiente administrativo exige verificação em duas etapas. Use um aplicativo autenticador (TOTP) para ler o código QR ou digite a chave manualmente."
    >
      <EnrollForm />
    </AuthCard>
  );
}
