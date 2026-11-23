import { enforceAdminRoute } from "@/lib/auth/guard";
import { updatePassword } from "../actions";
import {
  AuthCard,
  FormMessage,
  buttonClass,
  inputClass,
  labelClass,
} from "../_components/auth-card";

const errors: Record<string, string> = {
  senha: "A senha precisa ter ao menos 12 caracteres, com letra maiúscula, minúscula e número.",
  confirmacao: "As senhas não conferem.",
  atualizacao: "Não foi possível atualizar a senha. Solicite um novo link.",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  await enforceAdminRoute("/admin/redefinir-senha");
  const { erro } = await searchParams;

  return (
    <AuthCard
      title="Definir nova senha"
      description="Ao salvar, suas outras sessões serão encerradas."
    >
      {erro && errors[erro] ? <FormMessage tone="error">{errors[erro]}</FormMessage> : null}
      <form action={updatePassword} className="flex flex-col gap-4">
        <label className={labelClass}>
          Nova senha
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Confirmar senha
          <input
            name="confirmation"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            className={inputClass}
          />
        </label>
        <button type="submit" className={buttonClass}>
          Salvar senha
        </button>
      </form>
    </AuthCard>
  );
}
