import { enforceAdminRoute } from "@/lib/auth/guard";
import Link from "next/link";
import { signInWithPassword } from "../actions";
import {
  AuthCard,
  FormMessage,
  buttonClass,
  inputClass,
  labelClass,
} from "../_components/auth-card";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

const errors: Record<string, string> = {
  credenciais: "E-mail ou senha inválidos.",
  configuracao: "Autenticação indisponível neste ambiente.",
  sessao: "Sua sessão foi encerrada. Entre novamente.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  await enforceAdminRoute("/admin/login");
  const { erro } = await searchParams;
  const configured = Boolean(getSupabasePublicConfig());

  return (
    <AuthCard title="Entrar" description="Acesso restrito à equipe autorizada.">
      {!configured ? (
        <FormMessage tone="error">{errors.configuracao}</FormMessage>
      ) : (
        <>
          {erro && errors[erro] ? <FormMessage tone="error">{errors[erro]}</FormMessage> : null}
          <form action={signInWithPassword} className="flex flex-col gap-4">
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
            <label className={labelClass}>
              Senha
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className={inputClass}
              />
            </label>
            <button type="submit" className={buttonClass}>
              Entrar
            </button>
          </form>
          <Link href="/admin/recuperar-senha" className="text-burgundy text-sm underline">
            Esqueci minha senha
          </Link>
        </>
      )}
    </AuthCard>
  );
}
