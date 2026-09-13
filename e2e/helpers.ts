// Helpers compartidos de los smoke tests: inyección del mock de IPC y
// autenticación. El mock es el mismo archivo que usa la verificación manual
// (scripts/dev-ipc-mock.js); Playwright lo inyecta en cada página ANTES del
// bundle con addInitScript, imitando la vía del navegador.
import { test as base, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const MOCK = readFileSync(join(here, "..", "scripts", "dev-ipc-mock.js"), "utf8");

export const test = base.extend<{ mockedPage: Page }>({
  mockedPage: async ({ page }, use) => {
    await page.addInitScript(MOCK);
    await use(page);
  },
});

export { expect };

/**
 * Login completo contra el mock (admin/admin123). Como esa contraseña
 * inicial fuerza el cambio obligatorio, pasa por el formulario de nueva
 * contraseña — exactamente el flujo del usuario real.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByText("Iniciar sesión")).toBeVisible();

  await page.locator("input").nth(1).fill("admin123");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  // Primer ingreso: pantalla de cambio de contraseña obligatorio.
  const save = page.getByRole("button", { name: "Guardar y entrar" });
  await expect(save).toBeVisible();
  await page.locator("input").nth(0).fill("admin123");
  await page.locator("input").nth(1).fill("admin123");
  await save.click();

  // La app entra al Panel: el user chip del header debe aparecer.
  await expect(page.getByText("Administrador").first()).toBeVisible();
}

/** Navega a una vista: nav lateral (≥1024px) o nav inferior (móvil). */
export async function goTo(page: Page, view: string): Promise<void> {
  const item = page
    .locator("nav[aria-label='Navegación principal'] button")
    .filter({ hasText: view });
  await item.filter({ visible: true }).first().click();
}
