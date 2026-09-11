"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import Image from "next/image";
import {
  Activity,
  PawPrint,
  Scissors,
  Package,
  Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore, type AppView } from "@/stores/app-store";

const NAV_ITEMS: {
  value: AppView;
  label: string;
  description: string;
  icon: typeof PawPrint;
}[] = [
  {
    value: "dashboard",
    label: "Panel",
    description: "Resumen general",
    icon: Activity,
  },
  {
    value: "pacientes",
    label: "Pacientes",
    description: "Fichas clínicas",
    icon: PawPrint,
  },
  {
    value: "cirugias",
    label: "Cirugías",
    description: "Agenda quirúrgica",
    icon: Scissors,
  },
  {
    value: "inventario",
    label: "Inventario",
    description: "Implantes e insumos",
    icon: Package,
  },
];

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="bg-primary text-primary-foreground shadow-sm flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl">
        <Image
          src="/icon-192.png"
          alt="Logo VetSurgeryTR"
          width={40}
          height={40}
          className="size-10 object-cover"
          priority
        />
      </div>
      <div className="min-w-0 leading-tight">
        <p className="truncate font-semibold tracking-tight">VetSurgeryTR</p>
        <p className="text-muted-foreground truncate text-xs">
          Cirugía ortopédica veterinaria
        </p>
      </div>
    </div>
  );
}

function NavList() {
  const activeView = useAppStore((s) => s.activeView);
  const setView = useAppStore((s) => s.setView);

  return (
    <nav aria-label="Navegación principal" className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const active = activeView === item.value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => {
              setView(item.value);
            }}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon
              className={cn(
                "size-4.5 shrink-0 transition-transform group-hover:scale-110",
                active ? "text-primary-foreground" : "text-muted-foreground",
              )}
              aria-hidden="true"
            />
            <span className="flex-1 truncate">{item.label}</span>
            <span
              className={cn(
                "hidden text-[10px] font-normal xl:block",
                active ? "text-primary-foreground/70" : "text-muted-foreground/60",
              )}
            >
              {item.description}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/**
 * Barra de navegación inferior tipo app nativa para celulares y tablets.
 * - `sticky bottom-0`: siempre visible al hacer scroll y asentada al final en
 *   pantallas cortas (empuja el footer de forma natural, sin superponerlo).
 * - Áreas táctiles ≥ 56 px y respeto del safe-area de iOS (notch / home bar).
 * - Visible solo por debajo de `lg`, donde la barra lateral está oculta.
 */
function BottomNav() {
  const activeView = useAppStore((s) => s.activeView);
  const setView = useAppStore((s) => s.setView);

  return (
    <nav
      aria-label="Navegación inferior"
      className="bg-card/95 supports-[backdrop-filter]:bg-card/85 sticky bottom-0 z-40 border-t backdrop-blur lg:hidden"
    >
      <div
        className="mx-auto grid max-w-md grid-cols-4"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {NAV_ITEMS.map((item) => {
          const active = activeView === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setView(item.value)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon
                className={cn("size-5 shrink-0", active && "text-primary")}
                aria-hidden="true"
              />
              <span className="truncate">{item.label}</span>
              <span
                aria-hidden="true"
                className={cn(
                  "h-1 w-6 rounded-full transition-colors",
                  active ? "bg-primary" : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const today = format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es });

  return (
    <div className="bg-background flex min-h-screen flex-col">
      {/* ================================ HEADER ============================== */}
      <header className="bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center overflow-hidden rounded-lg">
              <Image
                src="/icon-192.png"
                alt="Logo VetSurgeryTR"
                width={32}
                height={32}
                className="size-8 object-cover"
                priority
              />
            </div>
            <span className="font-semibold tracking-tight">VetSurgeryTR</span>
          </div>

          <div className="hidden items-center gap-2 lg:flex lg:ml-2">
            <Stethoscope className="text-primary size-4" aria-hidden="true" />
            <p className="text-muted-foreground text-sm capitalize">{today}</p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded-full border bg-card px-3 py-1 text-xs font-medium sm:inline-flex sm:items-center sm:gap-1.5">
              <span className="size-2 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
              Quirófano operativo
            </span>
          </div>
        </div>
      </header>

      {/* ================================ CUERPO ============================== */}
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6">
        <aside className="hidden w-60 shrink-0 lg:block" aria-label="Barra lateral">
          <div className="bg-card/60 sticky top-22 space-y-6 rounded-xl border p-4 shadow-sm">
            <BrandMark />
            <NavList />
            <div className="border-t pt-4">
              <p className="text-muted-foreground px-1 text-[11px] leading-relaxed">
                Sistema especializado en traumatología veterinaria: platinas,
                clavos, tornillos y controles postoperatorios.
              </p>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1" aria-label="Contenido principal">
          {children}
        </main>
      </div>

      {/* ================================ FOOTER ============================== */}
      <footer className="border-t bg-card/60 mt-auto">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-4 pb-3 text-xs sm:flex-row sm:px-6 sm:pb-4">
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">VetSurgeryTR</span> ·
            Gestión de cirugía ortopédica veterinaria
          </p>
          <p className="text-muted-foreground hidden sm:block">
            Pacientes · Cirugías · Inventario de implantes
          </p>
        </div>
      </footer>

      {/* ====================== NAV INFERIOR (MÓVIL/TABLET) =================== */}
      <BottomNav />
    </div>
  );
}
