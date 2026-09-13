// Smoke de regesión: tema claro/oscuro y layout de viewport angosto.
// Automatiza la verificación manual: el toggle aplica data-theme en <html>,
// las variables CSS responden, y bajo 720px las tablas se apilan en tarjetas.
import { test, expect, loginAsAdmin, goTo } from "./helpers";

test.describe("tema claro/oscuro", () => {
  test("arranca en light con colorScheme light y el toggle pasa a dark", async ({
    mockedPage: page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/VetSurgeryTR/i);

    // Tema inicial aplicado en <html> (colorScheme: light fijado en config).
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    const bgLight = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor,
    );

    // El toggle vive en el header de la app: primero hay que entrar.
    await loginAsAdmin(page);
    await page.locator("button.theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const bgDark = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor,
    );
    expect(bgDark).not.toBe(bgLight);
  });

  test("el tema persiste entre recargas (localStorage)", async ({
    mockedPage: page,
  }) => {
    await loginAsAdmin(page);
    await page.locator("button.theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("los KPI del panel son legibles en ambos temas (fondo ≠ texto)", async ({
    mockedPage: page,
  }) => {
    await loginAsAdmin(page);

    for (const theme of ["light", "dark"] as const) {
      await page.evaluate((t) => {
        localStorage.setItem("vst-theme", t);
      }, theme);
      await page.reload();
      await loginAsAdmin(page);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

      const contrast = await page.evaluate(() => {
        const card = document.querySelector(".kpi");
        if (!card) return null;
        const cs = getComputedStyle(card);
        return { bg: cs.backgroundColor, fg: cs.color };
      });
      expect(contrast, `tema ${theme}: KPI sin estilos`).not.toBeNull();
      expect(contrast!.bg).not.toBe("rgba(0, 0, 0, 0)");
    }
  });
});

test.describe("viewport angosto (móvil)", () => {
  test.use({ viewport: { width: 375, height: 720 } });

  test("el valor de inventario no parte cifras en la tarjeta KPI", async ({
    mockedPage: page,
  }) => {
    await loginAsAdmin(page);

    const value = page
      .locator(".kpi")
      .filter({ hasText: "Valor inventario" })
      .locator(".kpi-value");
    await expect(value).toHaveText(/^\$\s[\d.,]+$/); // una cifra completa
    const box = await value.boundingBox();
    expect(box, "valor KPI debe caber en una línea").toBeTruthy();
    expect(box!.height).toBeLessThan(34); // 22px fuente ≈ una línea
  });

  test("las etiquetas del gráfico «Documentos impresos» usan elipsis, no envuelven", async ({
    mockedPage: page,
  }) => {
    await loginAsAdmin(page);

    const card = page
      .locator(".card")
      .filter({ hasText: "Documentos impresos" })
      .filter({ hasNot: page.getByText("Cirugías por mes") });
    await expect(card).toBeVisible();

    const labels = card.locator(".bar-month");
    await expect(labels.first()).toBeVisible();
    const count = await labels.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const h = (await labels.nth(i).boundingBox())!.height;
      expect(h, `etiqueta ${i} envuelta a varias líneas`).toBeLessThan(26);
    }
  });

  test("las tablas se apilan en tarjetas con data-label bajo 720px", async ({
    mockedPage: page,
  }) => {
    await loginAsAdmin(page);
    await goTo(page, "Pacientes");

    await expect(page.getByText("PAC-2026-0001").first()).toBeVisible();
    // La tabla apilada oculta thead y muestra data-label por celda.
    await expect(page.locator(".table-wrap thead")).toBeHidden();
    const firstCell = page
      .locator(".table-wrap tbody tr td")
      .first();
    await expect(firstCell).toHaveAttribute("data-label", "Código");
  });

  test("sin scroll horizontal en ninguna vista principal", async ({
    mockedPage: page,
  }) => {
    await loginAsAdmin(page);
    const views = ["Panel", "Pacientes", "Cirugías", "Inventario", "Bitácora"];
    const check = async () => {
      for (const view of views) {
        await goTo(page, view);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `scroll horizontal en ${view}`).toBeLessThanOrEqual(0);
      }
    };

    // Pixel 5 (393px) y un teléfono angosto (375px, p. ej. iPhone SE):
    // el chip de usuario y la marca del header no deben empujar el layout.
    await check();
    await page.setViewportSize({ width: 375, height: 720 });
    await check();
  });
});
