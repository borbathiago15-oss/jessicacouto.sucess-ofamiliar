"use client";

import { useActionState, useTransition } from "react";
import {
  confirmTotpEnrollment,
  startTotpEnrollment,
  type ConfirmState,
  type EnrollmentState,
} from "../../actions";
import { FormMessage, buttonClass, inputClass, labelClass } from "../../_components/auth-card";

export function EnrollForm() {
  const [scan, generate] = useActionState<EnrollmentState, void>(
    async () => startTotpEnrollment(),
    { step: "idle" },
  );
  const [result, confirm, confirming] = useActionState<ConfirmState, FormData>(
    confirmTotpEnrollment,
    {},
  );
  const [starting, startTransition] = useTransition();

  if (scan.step !== "scan") {
    return (
      <div className="flex flex-col gap-4">
        {scan.error ? <FormMessage tone="error">{scan.error}</FormMessage> : null}
        <button
          type="button"
          className={buttonClass}
          disabled={starting}
          onClick={() => startTransition(() => generate())}
        >
          {starting ? "Gerando…" : "Gerar código QR"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- QR em data URI gerado pelo Supabase Auth */}
      <img
        src={scan.qrCode}
        alt="Código QR para cadastrar o autenticador"
        width={192}
        height={192}
        className="self-center rounded bg-white p-2"
      />
      <p className="text-sm">
        Chave para digitação manual:{" "}
        <code data-testid="totp-secret" className="font-mono break-all">
          {scan.secret}
        </code>
      </p>
      {result.error ? <FormMessage tone="error">{result.error}</FormMessage> : null}
      <form action={confirm} className="flex flex-col gap-4">
        <input type="hidden" name="factorId" value={scan.factorId} />
        <label className={labelClass}>
          Código de 6 dígitos
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
        <button type="submit" className={buttonClass} disabled={confirming}>
          {confirming ? "Verificando…" : "Confirmar"}
        </button>
      </form>
    </div>
  );
}
