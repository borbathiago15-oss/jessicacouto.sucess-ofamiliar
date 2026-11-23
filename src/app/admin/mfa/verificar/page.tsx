import { enforceAdminRoute } from "@/lib/auth/guard";
import { verifyTotp } from "../../actions";
import {
  AuthCard,
  FormMessage,
  buttonClass,
  inputClass,
  labelClass,
} from "../../_components/auth-card";
import { safeAdminPath } from "@/lib/auth/admin-routes";

export default async function VerifyMfaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; next?: string }>;
}) {
  await enforceAdminRoute("/admin/mfa/verificar");
  const { erro, next } = await searchParams;

  return (
    <AuthCard
      title="Verificação em duas etapas"
      description="Digite o código de 6 dígitos exibido no seu aplicativo autenticador."
    >
      {erro ? <FormMessage tone="error">Código inválido ou expirado.</FormMessage> : null}
      <form action={verifyTotp} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={safeAdminPath(next)} />
        <label className={labelClass}>
          Código
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            className={inputClass}
          />
        </label>
        <button type="submit" className={buttonClass}>
          Verificar
        </button>
      </form>
      <p className="text-sm">
        Perdeu acesso ao autenticador? Peça a uma administradora a redefinição do seu MFA.
      </p>
    </AuthCard>
  );
}
