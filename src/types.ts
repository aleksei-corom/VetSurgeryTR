// VetSurgeryTR (escritorio) — Contrato de tipos compartido con el backend Rust.
// Copia ADAPTADA de src/lib/api-types.ts del proyecto web:
//   * Los ids son `number` (INTEGER de Firebird con GENERATOR, en la web eran
//     cuid de string).
//   * Las fechas viajan como string "YYYY-MM-DD" o "YYYY-MM-DD HH:MM:SS"
//     (formato que produce LEFT(CAST(... AS VARCHAR)) en Firebird; en la web
//     eran ISO con zona).
// Los catálogos son IDÉNTICOS a los de la web.

// =============================== CATÁLOGOS ==================================

export const SURGERY_STATUSES = [
  "PROGRAMADA",
  "EN_CURSO",
  "COMPLETADA",
  "CANCELADA",
] as const;
export type SurgeryStatus = (typeof SURGERY_STATUSES)[number];

export const ANESTHESIA_TYPES = [
  "General inhalatoria",
  "General inyectable",
  "Local / regional",
  "Sedación + local",
  "Sin anestesia",
] as const;

export const LATERALITIES = [
  "Izquierda",
  "Derecha",
  "Bilateral",
  "No aplica",
] as const;

export const FOLLOW_UP_TYPES = [
  "CONTROL_RADIOGRAFICO",
  "CURACION",
  "RETIRO_PUNTOS",
  "EVALUACION",
  "RETIRO_IMPLANTES",
] as const;
export type FollowUpType = (typeof FOLLOW_UP_TYPES)[number];

export const FOLLOW_UP_STATUSES = ["PENDIENTE", "CUMPLIDO", "PERDIDO"] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export const MOVEMENT_TYPES = ["ENTRADA", "SALIDA", "AJUSTE"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const INVENTORY_CATEGORIES = [
  "PLACAS",
  "TORNILLOS",
  "PINES",
  "ALAMBRES",
  "FIJADORES",
  "INJERTOS",
  "INSTRUMENTAL",
  "SUTURAS",
  "MEDICAMENTOS",
  "INSUMOS",
] as const;
export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

export const DOCUMENT_TYPES = ["CC", "TI", "CE", "NIT", "PA"] as const;

export const SPECIES_OPTIONS = [
  "Canino",
  "Felino",
  "Equino",
  "Bovino",
  "Porcino",
  "Ovino",
  "Caprino",
  "Ave",
  "Exótico",
] as const;

/** Procedimientos ortopédicos sugeridos (el campo es texto libre). */
export const PROCEDURE_TYPES = [
  "TPLO (Nivelación de la cresta tibial)",
  "TTA (Avance de la tuberosidad tibial)",
  "Reparación de fractura (ORIF)",
  "Reparación de fractura (Fijador externo)",
  "Osteotomía correctiva",
  "Artrodesis (Fusión articular)",
  "Reparación de luxación de codo/cadera",
  "Estabilización de rodilla (extraarticular)",
  "Retiro de implantes",
  "Artrotomía exploratoria",
  "Reconstrucción de ligamento cruzado",
  "Otra",
] as const;

/** Etiquetas legibles de estado para la UI. */
export const SURGERY_STATUS_META: Record<
  SurgeryStatus,
  { label: string; badge: "secondary" | "warning" | "success" | "destructive" }
> = {
  PROGRAMADA: { label: "Programada", badge: "secondary" },
  EN_CURSO: { label: "En curso", badge: "warning" },
  COMPLETADA: { label: "Completada", badge: "success" },
  CANCELADA: { label: "Cancelada", badge: "destructive" },
};

export const FOLLOW_UP_TYPE_LABEL: Record<string, string> = {
  CONTROL_RADIOGRAFICO: "Control radiográfico",
  CURACION: "Curación de herida",
  RETIRO_PUNTOS: "Retiro de puntos",
  EVALUACION: "Evaluación clínica",
  RETIRO_IMPLANTES: "Retiro de implantes",
};

export const MOVEMENT_TYPE_LABEL: Record<string, string> = {
  ENTRADA: "Entrada",
  SALIDA: "Salida",
  AJUSTE: "Ajuste de inventario",
};

export const INVENTORY_CATEGORY_META: Record<string, { label: string; icon: string }> = {
  PLACAS: { label: "Platinas", icon: "layers" },
  TORNILLOS: { label: "Tornillos", icon: "rotate" },
  PINES: { label: "Clavos y pinos", icon: "pin" },
  ALAMBRES: { label: "Alambres y cerclaje", icon: "cable" },
  FIJADORES: { label: "Fijadores externos", icon: "frame" },
  INJERTOS: { label: "Injertos óseos", icon: "bone" },
  INSTRUMENTAL: { label: "Instrumental", icon: "drill" },
  SUTURAS: { label: "Suturas", icon: "needle" },
  MEDICAMENTOS: { label: "Medicamentos", icon: "pill" },
  INSUMOS: { label: "Insumos varios", icon: "package" },
};

// ================================ ENTIDADES =================================

export interface Owner {
  id: number;
  documentType: string;
  documentNumber: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  createdAt: string;
}

export interface Patient {
  id: number;
  code: string;
  ownerId: number;
  name: string;
  species: string;
  breed: string | null;
  sex: "M" | "F";
  birthDate: string | null;
  weight: number | null;
  neutered: boolean;
  color: string | null;
  microchip: string | null;
  active: boolean;
  notes: string | null;
  createdAt: string;
  ownerName: string;
  ownerPhone: string | null;
  /** Edad calculada en meses (solo lectura, calculada en SQL). */
  ageMonths: number | null;
  surgeryCount: number;
  lastSurgeryAt: string | null;
}

/** Cirugía resumida del historial del paciente. */
export interface PatientSurgerySummary {
  id: number;
  code: string;
  procedureType: string;
  scheduledAt: string;
  status: SurgeryStatus;
  bodyRegion: string | null;
  laterality: string | null;
  vet: { id: number; fullName: string } | null;
}

export interface PatientDetail extends Patient {
  surgeries: PatientSurgerySummary[];
}

export interface Vet {
  id: number;
  fullName: string;
  license: string | null;
  specialty: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  createdAt: string;
}

export interface InventoryItem {
  id: number;
  code: string;
  name: string;
  category: string;
  subType: string | null;
  material: string | null;
  size: string | null;
  unit: string;
  stockQty: number;
  minStock: number;
  unitCost: number | null;
  supplier: string | null;
  lotNumber: string | null;
  expiresAt: string | null;
  location: string | null;
  active: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovement {
  id: number;
  itemId: number;
  type: MovementType;
  qty: number;
  stockAfter: number;
  unitCost: number | null;
  reason: string | null;
  surgeryId: number | null;
  surgeryCode?: string | null;
  patientName?: string | null;
  createdAt: string;
  item?: { id: number; code: string; name: string; unit: string } | null;
}

export interface SurgeryMaterial {
  id: number;
  surgeryId: number;
  itemId: number;
  qtyPlanned: number;
  qtyUsed: number | null;
  unitCost: number | null;
  notes: string | null;
  item: {
    id: number;
    code: string;
    name: string;
    category: string;
    size: string | null;
    unit: string;
    stockQty: number;
    minStock: number;
  };
}

export interface FollowUp {
  id: number;
  surgeryId: number;
  scheduledDate: string;
  type: FollowUpType;
  notes: string | null;
  status: FollowUpStatus;
  doneAt: string | null;
  createdAt: string;
}

export interface Surgery {
  id: number;
  code: string;
  patientId: number;
  vetId: number | null;
  procedureType: string;
  bodyRegion: string | null;
  laterality: string | null;
  description: string | null;
  scheduledAt: string;
  durationMin: number | null;
  anesthesiaType: string | null;
  asaRisk: number | null;
  preoperativeNotes: string | null;
  postoperativeNotes: string | null;
  estimatedCost: number | null;
  status: SurgeryStatus;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  patient: {
    id: number;
    code: string;
    name: string;
    species: string;
    breed: string | null;
    sex: string;
    weight: number | null;
    birthDate: string | null;
    ageMonths: number | null;
    owner: { id: number; fullName: string; phone: string | null; city: string | null };
  };
  vet: { id: number; fullName: string; specialty: string | null } | null;
  materialsCount: number;
  materialsCost: number;
}

export interface SurgeryDetail extends Surgery {
  materials: SurgeryMaterial[];
  /** OJO: clave `follow_ups` (snake_case) — SurgeryDetail en Rust no lleva
   *  rename_all y el campo serializa tal cual. */
  follow_ups: FollowUp[];
}

// ============================== DASHBOARD ===================================

export interface DashboardData {
  stats: {
    patientsActive: number;
    surgeriesScheduled: number;
    surgeriesInProgress: number;
    surgeriesCompletedMonth: number;
    lowStockCount: number;
    followUpsDue: number;
    inventoryValue: number;
  };
  upcomingSurgeries: Surgery[];
  lowStockItems: InventoryItem[];
  followUpsDueList: (FollowUp & {
    surgery: { code: string; procedureType: string; patient: { name: string; species: string } };
  })[];
  monthlySurgeries: { month: string; count: number }[];
  categoryDistribution: { category: string; count: number }[];
}

/** Estado de arranque de Firebird (banner de configuración). */
export interface DbStatus {
  ok: boolean;
  initError: string | null;
  dbPath: string;
  fbclientPath: string;
  schemaVersion: number;
}

// ========================== TIPOS COMPUESTOS IPC ============================

/** Rust devuelve { movement, item } — igual que el POST de la web. */
export interface MovementResult {
  movement: InventoryMovement;
  item: InventoryItem;
}

/** Detalle de un ítem con su historial de movimientos (máx. 50). */
export interface InventoryItemDetail {
  item: InventoryItem;
  movements: InventoryMovement[];
}

// ============================ TIPOS DE ENTRADA ==============================

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

export interface UpdatePatientInput {
  name?: string;
  species?: string;
  breed?: string;
  sex?: "M" | "F";
  birthDate?: string;
  weight?: number;
  neutered?: boolean;
  color?: string;
  microchip?: string;
  active?: boolean;
  notes?: string;
}

export interface CreateVetInput {
  fullName: string;
  license?: string;
  specialty?: string;
  phone?: string;
  email?: string;
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

/** Actualización parcial de ítem (None = no tocar). El stock solo cambia
 *  por movimientos ENTRADA/SALIDA/AJUSTE, nunca por edición directa. */
export interface UpdateInventoryItemInput {
  name?: string;
  category?: string;
  subType?: string;
  material?: string;
  size?: string;
  unit?: string;
  minStock?: number;
  unitCost?: number;
  supplier?: string;
  lotNumber?: string;
  expiresAt?: string;
  location?: string;
  active?: boolean;
  notes?: string;
}

export interface CreateMovementInput {
  /** ENTRADA suma · SALIDA resta (valida stock) · AJUSTE fija el absoluto.
   *  Serde renombra movement_type → "type" en el backend. */
  type: "ENTRADA" | "SALIDA" | "AJUSTE";
  qty: number;
  unitCost?: number;
  reason?: string;
  surgeryId?: number;
}

export interface CreateSurgeryInput {
  patientId: number;
  vetId?: number;
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

export interface UpsertMaterialInput {
  itemId: number;
  qtyPlanned: number;
  qtyUsed?: number;
  notes?: string;
}

export interface UpdateSurgeryInput {
  status?: string;
  procedureType?: string;
  bodyRegion?: string;
  laterality?: string;
  description?: string;
  scheduledAt?: string;
  durationMin?: number;
  anesthesiaType?: string;
  asaRisk?: number;
  preoperativeNotes?: string;
  postoperativeNotes?: string;
  estimatedCost?: number;
  vetId?: number;
  materials?: UpsertMaterialInput[];
}

export interface CreateFollowUpInput {
  scheduledDate: string;
  type: string;
  notes?: string;
}

export interface UpdateFollowUpInput {
  status: string;
  notes?: string;
}
