"use client";

import type {
  DashboardData,
  FollowUp,
  InventoryItem,
  InventoryMovement,
  Owner,
  Patient,
  Surgery,
  SurgeryDetail,
  SurgeryMaterial,
  Vet,
} from "@/lib/api-types";

/** Cliente REST tipado: desempaqueta { data } y normaliza errores. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = (await res.json().catch(() => null)) as
    | { data?: T; error?: string }
    | null;
  if (!res.ok) {
    throw new Error(body?.error ?? `Error ${res.status} en ${path}`);
  }
  return (body?.data ?? (body as T)) as T;
}

export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Ocurrió un error inesperado";
}

// ============================ Tipos de entrada ==============================

export interface CreateOwnerInput {
  documentType: string;
  documentNumber: string;
  fullName: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  notes?: string;
}

export interface CreatePatientInput {
  owner: {
    documentType: string;
    documentNumber: string;
    fullName: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
  };
  name: string;
  species: string;
  breed?: string;
  sex: "M" | "F";
  birthDate?: string;
  weight?: number;
  neutered?: boolean;
  color?: string;
  microchip?: string;
  notes?: string;
}

export interface CreateInventoryItemInput {
  name: string;
  category: string;
  subType?: string;
  material?: string;
  size?: string;
  unit: string;
  stockQty?: number;
  minStock?: number;
  unitCost?: number;
  supplier?: string;
  lotNumber?: string;
  expiresAt?: string;
  location?: string;
  notes?: string;
}

export interface CreateMovementInput {
  type: "ENTRADA" | "SALIDA" | "AJUSTE";
  qty: number;
  unitCost?: number;
  reason?: string;
  surgeryId?: string;
}

export interface CreateSurgeryInput {
  patientId: string;
  vetId?: string;
  procedureType: string;
  bodyRegion?: string;
  laterality?: string;
  description?: string;
  scheduledAt: string;
  durationMin?: number;
  anesthesiaType?: string;
  asaRisk?: number;
  preoperativeNotes?: string;
  postoperativeNotes?: string;
  estimatedCost?: number;
}

export interface UpdateSurgeryInput extends Partial<CreateSurgeryInput> {
  status?: string;
}

export interface UpsertMaterialInput {
  itemId: string;
  qtyPlanned: number;
  qtyUsed?: number;
  notes?: string;
}

export interface CreateFollowUpInput {
  scheduledDate: string;
  type: string;
  notes?: string;
}

// ============================ Query params ==================================

export function buildQuery(
  params?: Record<string, string | number | boolean | undefined>,
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== "" && v !== false) sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

// Re-exportaciones de conveniencia para los hooks.
export type {
  DashboardData,
  FollowUp,
  InventoryItem,
  InventoryMovement,
  Owner,
  Patient,
  Surgery,
  SurgeryDetail,
  SurgeryMaterial,
  Vet,
};
