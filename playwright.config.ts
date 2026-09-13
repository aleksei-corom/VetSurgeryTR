// VetSurgeryTR · Smoke tests E2E con Playwright.
//
// Corren la UI real (vite dev) contra el mock de IPC (scripts/dev-ipc-mock.js),
// inyectado con addInitScript ANTES de que cargue la app — misma vía que la
// verificación manual en el navegador. No tocan Firebird ni el backend Rust:
// son pruebas de regresión de UI (tema, layout angosto, columnas, diálogos).
//
//   bunx playwright test            # ambos proyectos (desktop + móvil)
//   bunx playwright test --ui       # exploratorio
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Archivos independientes entre sí; cada test se autocontiene (login propio).
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : [["list", { printSteps: false }]],
  timeout: 30_000,

  use: {
    baseURL: "http://localhost:1420",
    trace: "retain-on-failure",
    // La app consulta prefers-color-scheme como tema inicial; fijamos light
    // para que las aserciones de tema sean deterministas.
    colorScheme: "light",
  },

  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 5"],
        // Pixel 5 cae bajo el breakpoint 719px: las tablas se apilan en
        // tarjetas con data-label — es justo lo que validamos en este
        // proyecto.
      },
    },
  ],

  webServer: {
    command: "bun run dev",
    url: "http://localhost:1420",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
