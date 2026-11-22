import { describe, expect, it } from "vitest";
import {
  ADMIN_HOME,
  ADMIN_LOGIN,
  ADMIN_MFA_ENROLL,
  ADMIN_MFA_VERIFY,
  ADMIN_PASSWORD_RESET,
  decideAdminRoute,
  safeAdminPath,
  type AdminRouteState,
} from "@/lib/auth/admin-routes";

const base: AdminRouteState = {
  pathname: ADMIN_HOME,
  configured: true,
  hasUser: true,
  currentLevel: "aal2",
  nextLevel: "aal2",
};

describe("decideAdminRoute", () => {
  it("sem Supabase configurado, envia para o login", () => {
    expect(decideAdminRoute({ ...base, configured: false })).toBe(ADMIN_LOGIN);
  });

  it("sem sessão, envia para o login", () => {
    expect(decideAdminRoute({ ...base, hasUser: false, currentLevel: null, nextLevel: null })).toBe(
      ADMIN_LOGIN,
    );
  });

  it("login e recuperação são públicos", () => {
    const anon = { ...base, hasUser: false, currentLevel: null, nextLevel: null } as const;
    expect(decideAdminRoute({ ...anon, pathname: ADMIN_LOGIN })).toBeNull();
    expect(decideAdminRoute({ ...anon, pathname: "/admin/recuperar-senha" })).toBeNull();
  });

  it("AAL2 acessa o painel", () => {
    expect(decideAdminRoute(base)).toBeNull();
  });

  it("AAL2 no login volta ao painel", () => {
    expect(decideAdminRoute({ ...base, pathname: ADMIN_LOGIN })).toBe(ADMIN_HOME);
  });

  it("AAL1 com fator cadastrado precisa verificar o código", () => {
    expect(decideAdminRoute({ ...base, currentLevel: "aal1" })).toBe(ADMIN_MFA_VERIFY);
    expect(decideAdminRoute({ ...base, currentLevel: "aal1", pathname: "/admin/empresas" })).toBe(
      `${ADMIN_MFA_VERIFY}?next=%2Fadmin%2Fempresas`,
    );
  });

  it("AAL1 com fator não pode cadastrar outro fator nem trocar senha sem MFA", () => {
    expect(decideAdminRoute({ ...base, currentLevel: "aal1", pathname: ADMIN_MFA_ENROLL })).toBe(
      `${ADMIN_MFA_VERIFY}?next=%2Fadmin%2Fmfa%2Fcadastrar`,
    );
    expect(
      decideAdminRoute({ ...base, currentLevel: "aal1", pathname: ADMIN_PASSWORD_RESET }),
    ).toBe(`${ADMIN_MFA_VERIFY}?next=%2Fadmin%2Fredefinir-senha`);
  });

  it("AAL1 sem fator precisa cadastrar o autenticador", () => {
    const noFactor = { ...base, currentLevel: "aal1", nextLevel: "aal1" } as const;
    expect(decideAdminRoute(noFactor)).toBe(ADMIN_MFA_ENROLL);
    expect(decideAdminRoute({ ...noFactor, pathname: ADMIN_MFA_ENROLL })).toBeNull();
    expect(decideAdminRoute({ ...noFactor, pathname: ADMIN_PASSWORD_RESET })).toBeNull();
    expect(decideAdminRoute({ ...noFactor, pathname: ADMIN_MFA_VERIFY })).toBe(ADMIN_MFA_ENROLL);
  });
});

describe("safeAdminPath", () => {
  it.each([
    ["/admin/empresas", "/admin/empresas"],
    ["/admin", "/admin"],
    ["/admin/empresas?x=1", "/admin/empresas"],
  ])("aceita caminho interno %s", (input, expected) => {
    expect(safeAdminPath(input)).toBe(expected);
  });

  it.each([
    "https://exemplo-malicioso.test/admin",
    "//exemplo-malicioso.test",
    "/admin@exemplo-malicioso.test",
    "/administrador",
    "/\\exemplo-malicioso.test",
    "/admin/login",
    "javascript:alert(1)",
    "",
    null,
  ])("rejeita %s", (input) => {
    expect(safeAdminPath(input)).toBe(ADMIN_HOME);
  });
});
