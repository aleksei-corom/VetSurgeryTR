// VetSurgeryTR — Cliente IPC tipado.
// Réplica de la forma de src/lib/api-client.ts del proyecto web (transporte
// HTTP → invoke de Tauri v2). Desempaqueta errores del backend Rust —que
// serializa AppError como { type, data }— a Errores con mensaje en español.
import { invoke } from "@tauri-apps/api/core";
import type {
  AuditEntry,
  ClinicSettings,
  CreateFollowUpInput,
  CreateInventoryItemInput,
  CreateMovementInput,
  CreateOwnerInput,
  CreatePatientInput,
  CreateSurgeryInput,
  DocumentPrintCount,
  CreateVetInput,
  DashboardData,
  DbStatus,
  EntityPrintTotal,
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
  UpdateUserInput,
  UpdateVetInput,
  UpdateClinicSettingsInput,
  Session,
  UpsertMaterialInput,
  User,
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

// ================================ Respaldos =================================

export interface BackupFile {
  fileName: string;
  fullPath: string;
  sizeBytes: number;
  modifiedAt: string;
  schemaVersion: number;
}

export interface CreateBackupResult {
  backup: BackupFile;
  totalBackups: number;
}

/** Crea un respaldo puntual (copia del .fdb en reposo) y lo devuelve. */
export function createBackup(): Promise<CreateBackupResult> {
  return call("create_backup");
}

/** Respaldos existentes, más recientes primero (máx. 100). */
export function listBackups(): Promise<BackupFile[]> {
  return call("list_backups");
}

// ===================== Configuración de la clínica ==========================

export function getClinicSettings(): Promise<ClinicSettings> {
  return call("get_clinic_settings");
}

export function updateClinicSettings(
  input: UpdateClinicSettingsInput,
): Promise<ClinicSettings> {
  return call("update_clinic_settings", { input });
}

// ============================ Exportaciones CSV ==============================

/**
 * Abre el selector nativo de carpetas y devuelve la ruta elegida
 * (null si el usuario cancela). Requiere tauri-plugin-dialog.
 */
async function pickFolder(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const dir = await open({ directory: true, title: "Carpeta donde guardar el CSV" });
  return typeof dir === "string" ? dir : null;
}

/**
 * Exporta el inventario completo a CSV (separador ";", BOM UTF-8, apto para
 * doble clic en Excel es-CO). Devuelve la ruta del archivo generado o null
 * si el usuario canceló el selector de carpeta.
 */
export async function exportInventoryCsv(): Promise<string | null> {
  const dir = await pickFolder();
  if (!dir) return null;
  return call("export_inventory_csv", { dir });
}

/** Igual que exportInventoryCsv pero para el kardex global (hasta 5.000). */
export async function exportKardexCsv(): Promise<string | null> {
  const dir = await pickFolder();
  if (!dir) return null;
  return call("export_kardex_csv", { dir });
}

/** Igual que las anteriores pero para la bitácora de auditoría completa
 *  (hasta 5.000 entradas, incluidas las impresiones de documentos). */
export async function exportAuditCsv(): Promise<string | null> {
  const dir = await pickFolder();
  if (!dir) return null;
  return call("export_audit_csv", { dir });
}

// ========================== Bitácora de auditoría ===========================

export interface AuditListParams {
  entityType?: string;
  action?: string;
  search?: string;
  /** Default 200, tope 1000 (validado en el backend). */
  limit?: number;
}

/** Bitácora de auditoría (más recientes primero). */
export function listAuditLog(params: AuditListParams = {}): Promise<AuditEntry[]> {
  return call("list_audit_log", {
    entityType: params.entityType ?? null,
    action: params.action ?? null,
    search: params.search ?? null,
    limit: params.limit ?? null,
  });
}

/** Registra en la bitácora la impresión de un documento clínico
 *  (entidad DOCUMENTO, acción IMPRIMIR) a nombre del usuario en sesión. */
export function logDocumentPrint(input: {
  document: string;
  entityCode: string;
  entityId?: number | null;
}): Promise<void> {
  return call("log_document_print", {
    input: {
      document: input.document,
      entityCode: input.entityCode,
      entityId: input.entityId ?? null,
    },
  });
}

/** Impresiones por tipo de documento de una entidad (CIR-…/PAC-…):
 *  conteo y fecha de la última — alimenta la fila de impresiones del
 *  detalle de cirugía. */
export function getDocumentPrints(entityCode: string): Promise<DocumentPrintCount[]> {
  return call("get_document_prints", { entityCode });
}

/** Total de impresiones por código de entidad con un prefijo («PAC-»
 *  pacientes, «CIR-» cirugías): una consulta para toda la página — alimenta
 *  la columna «Impresiones» del listado. Solo devuelve códigos con
 *  impresiones registradas. */
export function getPrintTotals(prefix: string): Promise<EntityPrintTotal[]> {
  return call("get_print_totals", { prefix });
}

// ============================ Sesión local (login) ==========================

/** Inicia sesión local. La sesión vive en memoria del backend. */
export function login(username: string, password: string): Promise<Session> {
  return call("login", { input: { username, password } });
}

/** Usuario de la sesión actual (o null si nadie ha entrado aún). */
export function getSession(): Promise<Session | null> {
  return call("get_session");
}

/** Cierra la sesión (vuelve a la pantalla de login). */
export function logout(): Promise<void> {
  return call("logout");
}

/** Cambia la contraseña del usuario autenticado (verifica la actual). */
export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return call("change_password", {
    input: { currentPassword, newPassword },
  });
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

/** Todos los veterinarios, incluidos inactivos (gestión de admins). */
export function listAllVets(): Promise<Vet[]> {
  return call("list_all_vets");
}

export function createVet(input: CreateVetInput): Promise<Vet> {
  return call("create_vet", { input });
}

/** Edita los datos de un veterinario (solo admins). `undefined` = no tocar;
 *  string vacío = quitar el dato. */
export function updateVet(vetId: number, input: UpdateVetInput): Promise<Vet> {
  return call("update_vet", { vetId, input });
}

/** Activa/desactiva un veterinario (soft-delete con historial intacto). */
export function setVetActive(vetId: number, active: boolean): Promise<Vet> {
  return call("set_vet_active", { vetId, active });
}

// ============================ Usuarios (solo admin) =========================

export function listUsers(): Promise<User[]> {
  return call("list_users");
}

export function createUser(input: {
  username: string;
  displayName: string;
  password: string;
  role: "ADMIN" | "VET";
}): Promise<User> {
  return call("create_user", { input });
}

export function setUserActive(userId: number, active: boolean): Promise<User> {
  return call("set_user_active", { userId, active });
}

/** Edita nombre visible y/o rol de un usuario (solo admins). */
export function updateUser(userId: number, input: UpdateUserInput): Promise<User> {
  return call("update_user", { userId, input });
}

/** Restablecimiento por admin (para olvidos): no pide la contraseña actual. */
export function resetUserPassword(userId: number, newPassword: string): Promise<void> {
  return call("reset_user_password", { userId, newPassword });
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

export interface MovementListParams {
  itemId?: number;
  /** ENTRADA | SALIDA | AJUSTE */
  type?: string;
  search?: string;
  /** Default 100, tope 500 (validado en el backend). */
  limit?: number;
}

/** Kardex global de movimientos (más recientes primero). */
export function listMovements(params: MovementListParams = {}): Promise<InventoryMovement[]> {
  return call("list_movements", {
    itemId: params.itemId ?? null,
    movementType: params.type ?? null,
    search: params.search ?? null,
    limit: params.limit ?? null,
  });
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
  AuditEntry,
  CreateFollowUpInput,
  CreateInventoryItemInput,
  CreateMovementInput,
  CreateOwnerInput,
  DocumentPrintCount,
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
  Session,
  Surgery,
  SurgeryDetail,
  SurgeryMaterial,
  UpdateFollowUpInput,
  UpdateInventoryItemInput,
  UpdatePatientInput,
  UpdateSurgeryInput,
  UpdateUserInput,
  UpdateVetInput,
  UpdateClinicSettingsInput,
  UpsertMaterialInput,
  Vet,
  ClinicSettings,
};
