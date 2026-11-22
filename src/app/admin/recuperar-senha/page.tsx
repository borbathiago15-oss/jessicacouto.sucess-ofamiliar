import Link from "next/link";
import { requestPasswordRecovery } from "../actions";
import {
  AuthCard,
  FormMessage,
  buttonClass,
  inputClass,
  labelClass,
} from "../_components/auth-card";

export default async function RecoverPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string }>;
}) {
  const { enviado } = await searchParams;

  return (
    <AuthCard
      title="Recuperar senha"
      description="Informe seu e-mail. Se houver uma conta, você receberá um link para definir uma nova senha. A verificação em duas etapas continua obrigatória."
    >
      {enviado ? (
        <FormMessage tone="info">
          Se o e-mail estiver cadastrado, o link de recuperação foi enviado.
        </FormMessage>
      ) : null}
      <form action={requestPasswordRecovery} className="flex flex-col gap-4">
        <label className={labelClass}>
          E-mail
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            className={inputClass}
          />
        </label>
        <button type="submit" className={buttonClass}>
          Enviar link
        </button>
      </form>
      <Link href="/admin/login" className="text-burgundy text-sm underline">
        Voltar ao login
      </Link>
    </AuthCard>
  );
}
