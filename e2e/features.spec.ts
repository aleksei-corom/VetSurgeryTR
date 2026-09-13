// Smoke de regresión de las funciones recientes: columna «Impresiones» de
// Pacientes, ficha con chips de impresión, Admin (pestañas y filtros) y
// Bitácora (filtros + Exportar CSV). Corren contra el mock de IPC — validan
// la UI y su cableado, no el backend (eso lo cubren los smoke de Rust).
import { test, expect, loginAsAdmin, goTo } from "./helpers";

test.describe("Pacientes", () => {
  test("el listado muestra la columna «Impresiones» con el total por paciente", async ({
    mockedPage: page,
  }) => {
    await loginAsAdmin(page);
    await goTo(page, "Pacientes");

    // El mock devuelve PAC-2026-0001 con 3 impresiones acumuladas.
    const row = page.locator(".table-wrap tbody tr").filter({ hasText: "PAC-2026-0001" });
    await expect(row).toBeVisible();
    await expect(row.locator("td[data-label='Impresiones']")).toHaveText("3");
    // La cabecera existe (escritorio) con el orden Cirugías · Impresiones · Estado.
    const heads = await page.locator(".table-wrap thead th").allTextContents();
    const i = heads.findIndex((h) => h === "Impresiones");
    expect(i, "columna Impresiones presente").toBeGreaterThan(-1);
    expect(heads[i - 1]).toBe("Cirugías");
    expect(heads[i + 1]).toBe("Estado");
  });

  test("la ficha del paciente muestra el chip de impresiones por documento", async ({
    mockedPage: page,
  }) => {
    await loginAsAdmin(page);
    await goTo(page, "Pacientes");
    await page.locator(".table-wrap tbody tr").first().click();

    const modal = page.getByRole("dialog", { name: /Rocky/ });
    await expect(modal).toBeVisible();
    await expect(
      modal.getByText(/Historia clínica del paciente:\s*3/),
    ).toBeVisible();
  });
});

test.describe("Admin", () => {
  test("pestañas Veterinarios/Usuarios/Clínica visibles para admin", async ({
    mockedPage: page,
  }) => {
    await loginAsAdmin(page);
    await goTo(page, "Admin");
    for (const tab of ["Veterinarios", "Usuarios", "Clínica"]) {
      await expect(
        page.getByRole("tab", { name: new RegExp(tab) }),
      ).toBeVisible();
    }
  });

  test("filtro de estado de veterinarios: Todos/Activos/Inactivos", async ({
    mockedPage: page,
  }) => {
    await loginAsAdmin(page);
    await goTo(page, "Admin");

    const sel = page.locator("select").filter({
      has: page.locator("option", { hasText: "Solo activos" }),
    });
    await expect(sel).toBeVisible();
    await sel.selectOption({ label: "Solo activos" });
    // El mock tiene 1 veterinario activo: sigue visible tras filtrar.
    await expect(page.locator("tbody tr").first()).toBeVisible();
  });

  test("la búsqueda de usuarios filtra y muestra estado vacío", async ({
    mockedPage: page,
  }) => {
    await loginAsAdmin(page);
    await goTo(page, "Admin");

    const usersTab = page.getByRole("tab", { name: /Usuarios/ });
    await usersTab.click();

    const search = page.locator(".search-box input");
    await search.fill("zzz-inexistente");
    await expect(page.getByText("Sin resultados")).toBeVisible();
  });
});

test.describe("Bitácora", () => {
  test("filtros de módulo/acción presentes y entradas listadas", async ({
    mockedPage: page,
  }) => {
    await loginAsAdmin(page);
    await goTo(page, "Bitácora");

    await expect(
      page.getByRole("combobox").filter({ hasText: "Todos los módulos" }).first(),
    ).toBeVisible();
    await expect(page.locator("tbody tr").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Exportar CSV/ }),
    ).toBeVisible();
  });
});

test.describe("Panel", () => {
  test("tarjeta «Documentos impresos» con tipos ordenados desc y acceso a bitácora", async ({
    mockedPage: page,
  }) => {
    await loginAsAdmin(page);

    const card = page
      .locator(".card")
      .filter({ hasText: "Documentos impresos" })
      .filter({ hasNot: page.getByText("Cirugías por mes") });
    await expect(card).toBeVisible();

    // Mock: consentimiento 4 · fórmula 3 · historia quirúrgica 2 · paciente 1.
    const counts = await card.locator(".bar-count").allTextContents();
    expect(counts.map(Number)).toEqual([4, 3, 2, 1]);

    await card.getByRole("button", { name: /Ver bitácora/ }).click();
    await expect(
      page.getByRole("combobox").filter({ hasText: "Todos los módulos" }).first(),
    ).toBeVisible(); // llegó a la Bitácora
  });
});
