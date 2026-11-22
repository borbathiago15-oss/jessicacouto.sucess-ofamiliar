import { describe, expect, it } from "vitest";
import { parsePublicEnv, parseServerEnv } from "@/lib/env/schema";

// Somente valores fictícios.
const FAKE_SUPABASE = "https://exemplo-ficticio.supabase.co";

describe("parsePublicEnv", () => {
  it("aplica padrões seguros de desenvolvimento", () => {
    const env = parsePublicEnv({});
    expect(env.NEXT_PUBLIC_APP_ENV).toBe("development");
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("http://localhost:3000");
  });

  it("rejeita ambiente desconhecido", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_APP_ENV: "qa" })).toThrow();
  });

  it("rejeita URL inválida", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "não-é-url" })).toThrow();
  });

  it.each([
    "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_RESEND_API_KEY",
    "NEXT_PUBLIC_SECRET",
    "NEXT_PUBLIC_DB_PASSWORD",
  ])("bloqueia segredo exposto como variável pública: %s", (name) => {
    expect(() => parsePublicEnv({ [name]: "valor-ficticio" })).toThrow(/nome de segredo/);
  });

  it.each(["staging", "production"])("exige https e domínio não local em %s", (envName) => {
    expect(() =>
      parsePublicEnv({
        NEXT_PUBLIC_APP_ENV: envName,
        NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      }),
    ).toThrow(/https/);
  });

  it("impede Supabase local em produção", () => {
    expect(() =>
      parsePublicEnv({
        NEXT_PUBLIC_APP_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "https://exemplo-ficticio.com.br",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      }),
    ).toThrow(/local/);
  });

  it("aceita configuração de homologação válida", () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_APP_ENV: "staging",
      NEXT_PUBLIC_SITE_URL: "https://homolog.exemplo-ficticio.com.br",
      NEXT_PUBLIC_SUPABASE_URL: FAKE_SUPABASE,
    });
    expect(env.NEXT_PUBLIC_APP_ENV).toBe("staging");
  });
});

describe("mensagens de erro", () => {
  it("não expõem o valor recebido", () => {
    const valorFicticio = "valor-ficticio-que-nao-deve-vazar";
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: valorFicticio })).toThrow();
    try {
      parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: valorFicticio });
    } catch (error) {
      expect(String(error)).not.toContain(valorFicticio);
      expect(String(error)).toContain("NEXT_PUBLIC_SUPABASE_URL");
    }
  });
});

describe("parseServerEnv", () => {
  it("rejeita chave de serviço vazia", () => {
    expect(() => parseServerEnv({ SUPABASE_SERVICE_ROLE_KEY: "" })).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it("aceita ausência da chave antes do M1", () => {
    expect(parseServerEnv({})).toEqual({});
  });
});
