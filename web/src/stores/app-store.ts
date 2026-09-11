"use client";

import { create } from "zustand";

export type AppView = "dashboard" | "pacientes" | "cirugias" | "inventario";

/** Solicitud de enfoque de entidad cruzando vistas (dashboard → módulo). */
type EntityRequest =
  | { kind: "patient"; id: string }
  | { kind: "surgery"; id: string }
  | { kind: "inventory"; id: string }
  | null;

interface AppState {
  activeView: AppView;
  entityRequest: EntityRequest;
  setView: (view: AppView) => void;
  focusEntity: (request: NonNullable<EntityRequest>) => void;
  consumeEntityRequest: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeView: "dashboard",
  entityRequest: null,
  setView: (view) => set({ activeView: view }),
  focusEntity: (request) =>
    set({
      activeView:
        request.kind === "patient"
          ? "pacientes"
          : request.kind === "surgery"
            ? "cirugias"
            : "inventario",
      entityRequest: request,
    }),
  consumeEntityRequest: () => set({ entityRequest: null }),
}));
