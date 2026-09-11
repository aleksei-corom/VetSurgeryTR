// VetSurgeryTR — Cliente IPC tipado.
// Réplica de la forma de src/lib/api-client.ts del proyecto web (transporte
// HTTP → invoke de Tauri v2). Desempaqueta errores del backend Rust —que
// serializa AppError como { type, data }— a Errores con mensaje en español.
import { invoke } from "@tauri-apps/api/core";
import type {
  CreateFollowUpInput,
  CreateInventoryItemInput,
  CreateMovementInput,
  CreateOwnerInput,
  CreatePatientInput,
  CreateSurgeryInput,
  CreateVetInput,
  DashboardData,
  DbStatus,
  FollowUp,
  InventoryItem,
  InventoryItemDetail,
  InventoryMovement,
  MovementResult,
  Owner,
  Patient,
  PatientDetail,
  Surgery,
  SurgeryDetail,
  SurgeryMaterial,
  UpdateFollowUpInput,
  UpdateInventoryItemInput,
  UpdatePatientInput,
  UpdateSurgeryInput,
  UpsertMaterialInput,
  Vet,
} from "@/types";

/** Extrae el mensaje de un error del backend (AppError serializado o texto). */
export function getErrorMessage(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const err = e as { data?: unknown; message?: unknown };
    // AppError de Rust: { "type": "Validation", "data": "Stock insuficiente…" }
    if (typeof err.data === "string") return err.data;
    if (typeof err.message === "string") return err.message;
  }
  return "Ocurrió un error inesperado";
}

/** Llamada IPC base con normalización de errores. */
async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    throw new Error(getErrorMessage(e));
  }
}

// ============================== DB / Dashboard ==============================

export function getDbStatus(): Promise<DbStatus> {
  return call("db_status");
}

export function getDashboard(): Promise<DashboardData> {
  return call("get_dashboard");
}

// ================================ Propietarios ==============================

export function listOwners(search?: string): Promise<Owner[]> {
  return call("list_owners", { search: search ?? null });
}

export function createOwner(input: CreateOwnerInput): Promise<Owner> {
  return call("create_owner", { input });
}

// ================================ Veterinarios ==============================

export function listVets(): Promise<Vet[]> {
  return call("list_vets");
}

export function createVet(input: CreateVetInput): Promise<Vet> {
  return call("create_vet", { input });
}

// ================================== Pacientes ===============================

export interface PatientListParams {
  search?: string;
  species?: string;
  active?: boolean;
}

export function listPatients(params: PatientListParams = {}): Promise<Patient[]> {
  return call("list_patients", {
    search: params.search ?? null,
    species: params.species ?? null,
    active: params.active ?? null,
  });
}

export function getPatient(id: number): Promise<PatientDetail | null> {
  return call("get_patient", { id });
}

export function createPatient(input: CreatePatientInput): Promise<Patient> {
  return call("create_patient", { input });
}

export function updatePatient(id: number, input: UpdatePatientInput): Promise<Patient> {
  return call("update_patient", { id, input });
}

// ================================== Inventario ==============================

export interface InventoryListParams {
  search?: string;
  category?: string;
  lowStock?: boolean;
}

export function listInventoryItems(
  params: InventoryListParams = {},
): Promise<InventoryItem[]> {
  return call("list_inventory_items", {
    search: params.search ?? null,
    category: params.category ?? null,
    lowStock: params.lowStock ?? false,
  });
}

export function getInventoryItem(id: number): Promise<InventoryItemDetail | null> {
  return call("get_inventory_item", { id });
}

export function createInventoryItem(
  input: CreateInventoryItemInput,
): Promise<InventoryItem> {
  return call("create_inventory_item", { input });
}

export function updateInventoryItem(
  id: number,
  input: UpdateInventoryItemInput,
): Promise<InventoryItem> {
  return call("update_inventory_item", { id, input });
}

// ============================== Movimientos =================================

export function createMovement(
  itemId: number,
  input: CreateMovementInput,
): Promise<MovementResult> {
  return call("create_movement", { itemId, input });
}

// ================================== Cirugías ================================

export interface SurgeryListParams {
  status?: string;
  search?: string;
  patientId?: number;
}

export function listSurgeries(params: SurgeryListParams = {}): Promise<Surgery[]> {
  return call("list_surgeries", {
    status: params.status ?? null,
    search: params.search ?? null,
    patientId: params.patientId ?? null,
  });
}

export function getSurgery(id: number): Promise<SurgeryDetail | null> {
  return call("get_surgery", { id });
}

export function createSurgery(input: CreateSurgeryInput): Promise<SurgeryDetail> {
  return call("create_surgery", { input });
}

/**
 * Actualización dual del PATCH web:
 *  a) transición de estado (al COMPLETADA consume inventario transaccional);
 *  b) campos editables + sincronización de materials[].
 */
export function updateSurgery(id: number, input: UpdateSurgeryInput): Promise<SurgeryDetail> {
  return call("update_surgery", { id, input });
}

// ========================= Materiales por cirugía ===========================

export function upsertSurgeryMaterial(
  surgeryId: number,
  input: UpsertMaterialInput,
): Promise<SurgeryMaterial> {
  return call("upsert_surgery_material", { surgeryId, input });
}

export function removeSurgeryMaterial(surgeryId: number, materialId: number): Promise<void> {
  return call("remove_surgery_material", { surgeryId, materialId });
}

// ============================ Controles postoperatorios =====================

export function createFollowUp(
  surgeryId: number,
  input: CreateFollowUpInput,
): Promise<FollowUp> {
  return call("create_follow_up", { surgeryId, input });
}

export function updateFollowUp(
  surgeryId: number,
  followUpId: number,
  input: UpdateFollowUpInput,
): Promise<FollowUp> {
  return call("update_follow_up", { surgeryId, followUpId, input });
}

// Re-exportaciones de conveniencia para las vistas.
export type {
  CreateFollowUpInput,
  CreateInventoryItemInput,
  CreateMovementInput,
  CreateOwnerInput,
  CreatePatientInput,
  CreateSurgeryInput,
  CreateVetInput,
  DashboardData,
  DbStatus,
  FollowUp,
  InventoryItem,
  InventoryItemDetail,
  InventoryMovement,
  MovementResult,
  Patient,
  PatientDetail,
  Surgery,
  SurgeryDetail,
  SurgeryMaterial,
  UpdateFollowUpInput,
  UpdateInventoryItemInput,
  UpdatePatientInput,
  UpdateSurgeryInput,
  UpsertMaterialInput,
  Vet,
};
