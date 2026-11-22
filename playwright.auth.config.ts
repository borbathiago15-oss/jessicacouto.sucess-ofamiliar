import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de autenticação do /admin contra Supabase local (job auth-e2e do CI).
 * Requer NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY e SUPABASE_DB_URL do ambiente efêmero.
 */
const PORT = 3100;

export default defineConfig({
  testDir: "./tests/e2e-auth",
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
