import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Acessibilidade automática (WCAG 2.1 A e AA) nas telas existentes.
for (const rota of ["/", "/design", "/admin/login", "/admin/recuperar-senha"]) {
  test(`sem violações de acessibilidade em ${rota}`, async ({ page }) => {
    await page.goto(rota);
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
  });
}
