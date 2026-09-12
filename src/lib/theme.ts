// VetSurgeryTR — tema claro/oscuro con variables CSS.
// Persistencia en localStorage con detección del esquema del SO como
// preferencia inicial. La clase/atributo se aplica en <html> ANTES del
// primer render (initTheme desde main.tsx) para evitar parpadeos.

export type Theme = "light" | "dark";

const STORAGE_KEY = "vst-theme";

export function getStoredTheme(): Theme {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    if (t === "light" || t === "dark") return t;
  } catch {
    // localStorage puede fallar en webviews con almacenamiento restringido.
  }
  return prefersDark() ? "dark" : "light";
}

export function prefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/** Aplica el tema al documento (data-theme en <html>). */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

/** Lectura temprana + sincronización con cambios del SO (si no hay elección). */
export function initTheme(): void {
  applyTheme(getStoredTheme());
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      try {
        if (!localStorage.getItem(STORAGE_KEY)) applyTheme(e.matches ? "dark" : "light");
      } catch {
        /* noop */
      }
    });
  }
}

/** Cambia el tema, lo persiste y devuelve el nuevo valor. */
export function setTheme(theme: Theme): Theme {
  applyTheme(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* noop */
  }
  return theme;
}

export function toggleTheme(current: Theme): Theme {
  return setTheme(current === "dark" ? "light" : "dark");
}
