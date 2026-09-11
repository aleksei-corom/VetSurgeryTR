// VetSurgeryTR — Shell de la aplicación: sidebar 240px en escritorio, barra de
// navegación inferior en pantallas <1024px y header con marca + fecha es-CO.
import type { ReactNode } from "react";
import { IconBox, IconPaw, IconPanel, IconActivity } from "./icons";

export type ViewId = "dashboard" | "patients" | "surgeries" | "inventory";

export interface NavItem {
  id: ViewId;
  label: string;
  title: string;
  icon: ReactNode;
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "Panel",
    title: "Panel de control",
    icon: <IconPanel size={20} />,
  },
  {
    id: "patients",
    label: "Pacientes",
    title: "Pacientes",
    icon: <IconPaw size={20} />,
  },
  {
    id: "surgeries",
    label: "Cirugías",
    title: "Agenda quirúrgica",
    icon: <IconActivity size={20} />,
  },
  {
    id: "inventory",
    label: "Inventario",
    title: "Inventario ortopédico",
    icon: <IconBox size={20} />,
  },
];

interface AppShellProps {
  active: ViewId;
  onNavigate: (view: ViewId) => void;
  children: ReactNode;
}

/** Fecha larga en español de Colombia: "lunes, 12 de enero de 2026". */
function fmtToday(): string {
  const s = new Intl.DateTimeFormat("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function AppShell({ active, onNavigate, children }: AppShellProps) {
  const current = NAV_ITEMS.find((n) => n.id === active);
  const today = fmtToday();

  return (
    <div className="app">
      {/* ---------- Sidebar (escritorio) ---------- */}
      <aside className="sidebar">
        <div className="side-brand">
          <img src="/favicon.png" width={34} height={34} alt="Logo VetSurgeryTR" />
          <div>
            <div className="side-brand-name">VetSurgeryTR</div>
            <div className="side-brand-sub">Cirugía ortopédica veterinaria</div>
          </div>
        </div>
        <nav className="side-nav" aria-label="Navegación principal">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === active ? "active" : ""}
              onClick={() => onNavigate(item.id)}
              aria-current={item.id === active ? "page" : undefined}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          v1.0.0 · Tauri v2 + Firebird 5
          <br />
          Kit de escritorio ISALAB-TR
        </div>
      </aside>

      {/* ---------- Columna principal ---------- */}
      <div className="main">
        <header className="header">
          <div className="header-brand">
            <img src="/favicon.png" width={28} height={28} alt="Logo VetSurgeryTR" />
            <span className="header-brand-name">VetSurgeryTR</span>
          </div>
          <h1 className="header-title">{current?.title ?? "VetSurgeryTR"}</h1>
          <span className="header-date">{today}</span>
        </header>
        <main className="content">{children}</main>
      </div>

      {/* ---------- Barra inferior (móvil) ---------- */}
      <nav className="bottom-nav" aria-label="Navegación principal">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === active ? "active" : ""}
            onClick={() => onNavigate(item.id)}
            aria-current={item.id === active ? "page" : undefined}
          >
            <span className="nav-indicator" aria-hidden="true" />
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
