"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  buildQuery,
  getErrorMessage,
  type CreateFollowUpInput,
  type CreateInventoryItemInput,
  type CreateMovementInput,
  type CreateOwnerInput,
  type CreatePatientInput,
  type CreateSurgeryInput,
  type UpdateSurgeryInput,
  type UpsertMaterialInput,
} from "@/lib/api-client";
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

export { getErrorMessage };

/** Claves de cache por módulo para invalidación cruzada. */
export const qk = {
  owners: (q?: string) => ["owners", q ?? ""] as const,
  patients: (params?: Record<string, unknown>) =>
    ["patients", params ?? {}] as const,
  patient: (id: string) => ["patient", id] as const,
  vets: ["vets"] as const,
  inventory: (params?: Record<string, unknown>) =>
    ["inventory", params ?? {}] as const,
  item: (id: string) => ["item", id] as const,
  surgeries: (params?: Record<string, unknown>) =>
    ["surgeries", params ?? {}] as const,
  surgery: (id: string) => ["surgery", id] as const,
  dashboard: ["dashboard"] as const,
};

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["patients"] });
    void qc.invalidateQueries({ queryKey: ["surgeries"] });
    void qc.invalidateQueries({ queryKey: ["inventory"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

// ============================== PROPIETARIOS ================================

export function useOwners(q?: string) {
  return useQuery({
    queryKey: qk.owners(q),
    queryFn: () => api<Owner[]>(`/api/owners${buildQuery({ q })}`),
  });
}

export function useCreateOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOwnerInput) =>
      api<Owner>("/api/owners", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["owners"] });
    },
  });
}

// ================================ PACIENTES =================================

export function usePatients(params?: {
  q?: string;
  species?: string;
  active?: boolean;
}) {
  return useQuery({
    queryKey: qk.patients(params),
    queryFn: () =>
      api<Patient[]>(`/api/patients${buildQuery({ ...params, active: params?.active })}`),
  });
}

export function usePatient(id: string | null) {
  return useQuery({
    queryKey: qk.patient(id ?? ""),
    queryFn: () => api<Patient>(`/api/patients/${id}`),
    enabled: !!id,
  });
}

export function useCreatePatient() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreatePatientInput) =>
      api<Patient>("/api/patients", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
}

export function useUpdatePatient() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: { id: string } & Partial<CreatePatientInput> & { active?: boolean }) =>
      api<Patient>(`/api/patients/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
}

// ============================== VETERINARIOS ================================

export function useVets() {
  return useQuery({
    queryKey: qk.vets,
    queryFn: () => api<Vet[]>("/api/vets"),
  });
}

export function useCreateVet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      fullName: string;
      license?: string;
      specialty?: string;
      phone?: string;
      email?: string;
    }) =>
      api<Vet>("/api/vets", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["vets"] }),
  });
}

// ================================ INVENTARIO ================================

export function useInventory(params?: {
  q?: string;
  category?: string;
  lowStock?: boolean;
}) {
  return useQuery({
    queryKey: qk.inventory(params),
    queryFn: () =>
      api<InventoryItem[]>(
        `/api/inventory${buildQuery({ ...params, lowStock: params?.lowStock ? 1 : undefined })}`,
      ),
  });
}

export function useInventoryItem(id: string | null) {
  return useQuery({
    queryKey: qk.item(id ?? ""),
    queryFn: () =>
      api<{ item: InventoryItem; movements: InventoryMovement[] }>(
        `/api/inventory/${id}`,
      ),
    enabled: !!id,
  });
}

export function useCreateInventoryItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateInventoryItemInput) =>
      api<InventoryItem>("/api/inventory", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
}

export function useUpdateInventoryItem() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: { id: string } & Partial<CreateInventoryItemInput> & {
      active?: boolean;
    }) =>
      api<InventoryItem>(`/api/inventory/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
}

export function useCreateMovement() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      itemId,
      ...input
    }: { itemId: string } & CreateMovementInput) =>
      api<{ movement: InventoryMovement; item: InventoryItem }>(
        `/api/inventory/${itemId}/movements`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: invalidate,
  });
}

// ================================= CIRUGÍAS =================================

export function useSurgeries(params?: {
  status?: string;
  q?: string;
  patientId?: string;
}) {
  return useQuery({
    queryKey: qk.surgeries(params),
    queryFn: () =>
      api<Surgery[]>(`/api/surgeries${buildQuery(params)}`),
  });
}

export function useSurgery(id: string | null) {
  return useQuery({
    queryKey: qk.surgery(id ?? ""),
    queryFn: () => api<SurgeryDetail>(`/api/surgeries/${id}`),
    enabled: !!id,
  });
}

export function useCreateSurgery() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateSurgeryInput) =>
      api<SurgeryDetail>("/api/surgeries", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
}

export function useUpdateSurgery() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateSurgeryInput) =>
      api<SurgeryDetail>(`/api/surgeries/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
}

export function useUpsertSurgeryMaterial() {
  const invalidate = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      surgeryId,
      ...input
    }: { surgeryId: string } & UpsertMaterialInput) =>
      api<SurgeryMaterial>(`/api/surgeries/${surgeryId}/materials`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: qk.surgery(vars.surgeryId) });
      invalidate();
    },
  });
}

export function useDeleteSurgeryMaterial() {
  const invalidate = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      surgeryId,
      materialId,
    }: {
      surgeryId: string;
      materialId: string;
    }) =>
      api<{ ok: boolean }>(
        `/api/surgeries/${surgeryId}/materials/${materialId}`,
        { method: "DELETE" },
      ),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: qk.surgery(vars.surgeryId) });
      invalidate();
    },
  });
}

export function useCreateFollowUp() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      surgeryId,
      ...input
    }: { surgeryId: string } & CreateFollowUpInput) =>
      api<FollowUp>(`/api/surgeries/${surgeryId}/follow-ups`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: qk.surgery(vars.surgeryId) });
      invalidate();
    },
  });
}

export function useUpdateFollowUp() {
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      surgeryId,
      followUpId,
      ...input
    }: {
      surgeryId: string;
      followUpId: string;
      status?: string;
      notes?: string;
    }) =>
      api<FollowUp>(
        `/api/surgeries/${surgeryId}/follow-ups/${followUpId}`,
        { method: "PATCH", body: JSON.stringify(input) },
      ),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: qk.surgery(vars.surgeryId) });
      invalidate();
    },
  });
}

// ================================ DASHBOARD =================================

export function useDashboard() {
  return useQuery({
    queryKey: qk.dashboard,
    queryFn: () => api<DashboardData>("/api/dashboard"),
  });
}
