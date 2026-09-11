// VetSurgeryTR — Contrato de tipos compartido entre frontend y backend.
// Este archivo define la forma EXACTA de los datos que viajan por la API.
// Los enums y catálogos se derivan del dominio ISALAB-TR + módulo ortopédico.

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

export const INVENTORY_CATEGORY_META: Record<
  string,
  { label: string; icon: string }
> = {
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
  id: string;
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
  id: string;
  code: string;
  ownerId: string;
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
  owner?: Owner;
  ownerName?: string;
  ownerPhone?: string | null;
  /** Edad calculada en meses (solo lectura, calculada en API). */
  ageMonths?: number | null;
  surgeryCount?: number;
  lastSurgeryAt?: string | null;
}

export interface Vet {
  id: string;
  fullName: string;
  license: string | null;
  specialty: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
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
  id: string;
  itemId: string;
  type: MovementType;
  qty: number;
  stockAfter: number;
  unitCost: number | null;
  reason: string | null;
  surgeryId: string | null;
  surgeryCode?: string | null;
  patientName?: string | null;
  createdAt: string;
  item?: { id: string; code: string; name: string; unit: string };
}

export interface SurgeryMaterial {
  id: string;
  surgeryId: string;
  itemId: string;
  qtyPlanned: number;
  qtyUsed: number | null;
  unitCost: number | null;
  notes: string | null;
  item: {
    id: string;
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
  id: string;
  surgeryId: string;
  scheduledDate: string;
  type: FollowUpType;
  notes: string | null;
  status: FollowUpStatus;
  doneAt: string | null;
  createdAt: string;
}

export interface Surgery {
  id: string;
  code: string;
  patientId: string;
  vetId: string | null;
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
  patient?: {
    id: string;
    code: string;
    name: string;
    species: string;
    breed: string | null;
    sex: string;
    weight: number | null;
    birthDate: string | null;
    ageMonths?: number | null;
    owner: { id: string; fullName: string; phone: string | null; city: string | null };
  };
  vet?: { id: string; fullName: string; specialty: string | null } | null;
  materialsCount?: number;
  materialsCost?: number;
}

export interface SurgeryDetail extends Surgery {
  materials: SurgeryMaterial[];
  followUps: FollowUp[];
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
