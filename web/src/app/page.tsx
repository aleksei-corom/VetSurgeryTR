"use client";

import { AppShell } from "@/components/app-shell";
import { useAppStore } from "@/stores/app-store";
import { DashboardView } from "@/features/dashboard/dashboard-view";
import { PatientsView } from "@/features/patients/patients-view";
import { SurgeriesView } from "@/features/surgeries/surgeries-view";
import { InventoryView } from "@/features/inventory/inventory-view";

export default function Home() {
  const activeView = useAppStore((s) => s.activeView);

  return (
    <AppShell>
      <div
        role="tabpanel"
        aria-label={
          activeView === "dashboard"
            ? "Panel general"
            : activeView === "pacientes"
              ? "Pacientes"
              : activeView === "cirugias"
                ? "Cirugías"
                : "Inventario"
        }
      >
        {activeView === "dashboard" && <DashboardView />}
        {activeView === "pacientes" && <PatientsView />}
        {activeView === "cirugias" && <SurgeriesView />}
        {activeView === "inventario" && <InventoryView />}
      </div>
    </AppShell>
  );
}
