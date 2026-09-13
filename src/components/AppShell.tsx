// VetSurgeryTR — Shell de la aplicación: sidebar 240px en escritorio, barra de
// navegación inferior en pantallas <1024px y header con marca + fecha es-CO.
// Incluye el toggle de tema claro/oscuro persistente.
import { useState, type ReactNode } from "react";
import { getStoredTheme, toggleTheme, type Theme } from "@/lib/theme";
import { IconBox, IconMoon, IconPaw, IconPanel, IconActivity, IconSave, IconSun, IconHistory, IconShield } from "./icons";
import UserChip from "./UserChip";
import type { Session } from "@/types";

export type ViewId = "dashboard" | "patients" | "surgeries" | "inventory" | "audit" | "admin";

export interface NavItem {
  id: ViewId;
  label: string;
  title: string;
  icon: ReactNode;
  /** Solo visible/habilitado para sesiones con rol ADMIN. */
  adminOnly?: boolean;
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
  {
    id: "audit",
    label: "Bitácora",
    title: "Bitácora de auditoría",
    icon: <IconHistory size={20} />,
  },
  {
    id: "admin",
    label: "Admin",
    title: "Administración (veterinarios y usuarios)",
    icon: <IconShield size={20} />,
    adminOnly: true,
  },
];

interface AppShellProps {
  active: ViewId;
  onNavigate: (view: ViewId) => void;
  onOpenBackups?: () => void;
  /** Sesión local activa: muestra el chip de usuario en la cabecera. */
  session: Session;
  onLoggedOut: () => void;
  onPasswordChanged?: () => void;
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

export function AppShell({
  active,
  onNavigate,
  onOpenBackups,
  session,
  onLoggedOut,
  onPasswordChanged,
  children,
}: AppShellProps) {
  const current = NAV_ITEMS.find((n) => n.id === active);
  const today = fmtToday();
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());
  // Vista Admin: solo para roles ADMIN (el resto ni la ve en el menú).
  const visibleNav = NAV_ITEMS.filter((n) => !n.adminOnly || session.user.role === "ADMIN");

  function flipTheme() {
    setThemeState(toggleTheme(theme));
  }

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
          {visibleNav.map((item) => (
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
          <button
            type="button"
            className="icon-btn theme-toggle"
            onClick={flipTheme}
            aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
            title={theme === "dark" ? "Tema claro" : "Tema oscuro"}
          >
            {theme === "dark" ? <IconSun size={17} /> : <IconMoon size={17} />}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onOpenBackups}
            aria-label="Respaldos de la base de datos"
            title="Respaldos de la base de datos"
          >
            <IconSave size={17} />
          </button>
          <UserChip
            session={session}
            onLoggedOut={onLoggedOut}
            onPasswordChanged={onPasswordChanged}
          />
          <span className="header-date">{today}</span>
        </header>
        <main className="content">{children}</main>
      </div>

      {/* ---------- Barra inferior (móvil) ---------- */}
      <nav className="bottom-nav" aria-label="Navegación principal">
        {visibleNav.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === active ? "active" : ""}
            onClick={() => onNavigate(item.id)}
            aria-current={item.id === active ? "page" : undefined}
          >
            <span className="nav-indicator" aria-hidden="true" />
            {item.icon}
            {/* Span explícito: permite elipsis en la etiqueta — sin él, el
               mínimo de contenido del botón (texto completo) puede superar
               1/5 del viewport con fuentes anchas y expandir el viewport del
               layout en móvil (scroll horizontal fantasma). */}
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
