// VetSurgeryTR — utilidades compartidas por los API routes.
// Convención de respuesta: éxito → { data: <payload> } · error → { error: "<mensaje>" }.
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type {
  FollowUp,
  InventoryItem,
  InventoryMovement,
  Owner,
  Patient,
  Surgery,
  SurgeryDetail,
  SurgeryMaterial,
} from './api-types';
import { ANESTHESIA_TYPES, LATERALITIES } from './api-types';

// ============================== ERRORES =====================================

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function errorResponse(e: unknown): NextResponse {
  if (e instanceof ApiError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      const target = Array.isArray(e.meta?.target) ? String(e.meta?.target) : '';
      const message = target.includes('microchip')
        ? 'Ya existe un paciente con ese microchip'
        : target.includes('code')
          ? 'Ya existe un registro con ese código'
          : 'Ya existe un registro con esos datos únicos';
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (e.code === 'P2025') {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
    }
  }
  console.error('[api] Error inesperado:', e);
  return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, 'Cuerpo JSON inválido');
  }
}

export function parseBody<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.length > 0 ? i.path.join('.') : 'body'}: ${i.message}`)
      .join('; ');
    throw new ApiError(400, `Datos inválidos — ${issues}`);
  }
  return result.data;
}

/** Fecha ISO (string) → Date, con validación. */
export const dateSchema = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'fecha ISO inválida' })
  .transform((v) => new Date(v));

/** Tipos de anestesia válidos (catálogo compartido). */
export const anesthesiaSchema = z.enum(ANESTHESIA_TYPES);

/** Lateralidades válidas (catálogo compartido). */
export const lateralitySchema = z.enum(LATERALITIES);

// ============================== HELPERS =====================================

export function calcAgeMonths(birth: Date | null): number | null {
  if (!birth) return null;
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, months);
}

const iso = (d: Date): string => d.toISOString();
const isoOrNull = (d: Date | null): string | null => (d ? d.toISOString() : null);

// ============================ SERIALIZERS ===================================

export function serializeOwner(o: Prisma.OwnerGetPayload<object>): Owner {
  return {
    id: o.id,
    documentType: o.documentType,
    documentNumber: o.documentNumber,
    fullName: o.fullName,
    phone: o.phone,
    email: o.email,
    address: o.address,
    city: o.city,
    notes: o.notes,
    createdAt: iso(o.createdAt),
  };
}

export const patientListInclude = {
  owner: true,
  surgeries: { orderBy: { scheduledAt: 'desc' }, take: 1, select: { scheduledAt: true } },
  _count: { select: { surgeries: true } },
} satisfies Prisma.PatientInclude;

type PatientWithOwner = Prisma.PatientGetPayload<{ include: { owner: true } }>;

export function serializePatient(
  p: PatientWithOwner & {
    surgeries?: { scheduledAt: Date }[];
    _count?: { surgeries: number };
  },
): Patient {
  return {
    id: p.id,
    code: p.code,
    ownerId: p.ownerId,
    name: p.name,
    species: p.species,
    breed: p.breed,
    sex: p.sex === 'F' ? 'F' : 'M',
    birthDate: isoOrNull(p.birthDate),
    weight: p.weight,
    neutered: p.neutered,
    color: p.color,
    microchip: p.microchip,
    active: p.active,
    notes: p.notes,
    createdAt: iso(p.createdAt),
    owner: serializeOwner(p.owner),
    ownerName: p.owner.fullName,
    ownerPhone: p.owner.phone,
    ageMonths: calcAgeMonths(p.birthDate),
    surgeryCount: p._count?.surgeries ?? 0,
    lastSurgeryAt: isoOrNull(p.surgeries?.[0]?.scheduledAt ?? null),
  };
}

export function serializeVet(v: Prisma.VetGetPayload<object>) {
  return {
    id: v.id,
    fullName: v.fullName,
    license: v.license,
    specialty: v.specialty,
    phone: v.phone,
    email: v.email,
    active: v.active,
    createdAt: iso(v.createdAt),
  };
}

export function serializeInventoryItem(i: Prisma.InventoryItemGetPayload<object>): InventoryItem {
  return {
    id: i.id,
    code: i.code,
    name: i.name,
    category: i.category,
    subType: i.subType,
    material: i.material,
    size: i.size,
    unit: i.unit,
    stockQty: i.stockQty,
    minStock: i.minStock,
    unitCost: i.unitCost,
    supplier: i.supplier,
    lotNumber: i.lotNumber,
    expiresAt: isoOrNull(i.expiresAt),
    location: i.location,
    active: i.active,
    notes: i.notes,
    createdAt: iso(i.createdAt),
    updatedAt: iso(i.updatedAt),
  };
}

export const movementInclude = {
  item: { select: { id: true, code: true, name: true, unit: true } },
  surgery: { select: { code: true, patient: { select: { name: true } } } },
} satisfies Prisma.InventoryMovementInclude;

export type MovementRow = Prisma.InventoryMovementGetPayload<{ include: typeof movementInclude }>;

export function serializeMovement(m: MovementRow): InventoryMovement {
  return {
    id: m.id,
    itemId: m.itemId,
    type: m.type as InventoryMovement['type'],
    qty: m.qty,
    stockAfter: m.stockAfter,
    unitCost: m.unitCost,
    reason: m.reason,
    surgeryId: m.surgeryId,
    surgeryCode: m.surgery?.code ?? null,
    patientName: m.surgery?.patient.name ?? null,
    createdAt: iso(m.createdAt),
    item: m.item
      ? { id: m.item.id, code: m.item.code, name: m.item.name, unit: m.item.unit }
      : undefined,
  };
}

export const surgeryInclude = {
  patient: {
    include: {
      owner: { select: { id: true, fullName: true, phone: true, city: true } },
    },
  },
  vet: { select: { id: true, fullName: true, specialty: true } },
  materials: {
    include: {
      item: {
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          size: true,
          unit: true,
          stockQty: true,
          minStock: true,
        },
      },
    },
  },
  followUps: { orderBy: { scheduledDate: 'asc' } },
} satisfies Prisma.SurgeryInclude;

export type SurgeryRow = Prisma.SurgeryGetPayload<{ include: typeof surgeryInclude }>;

const materialItemSelect = {
  id: true,
  code: true,
  name: true,
  category: true,
  size: true,
  unit: true,
  stockQty: true,
  minStock: true,
} as const;

export const materialInclude = { item: { select: materialItemSelect } } satisfies Prisma.SurgeryMaterialInclude;

export type MaterialRow = Prisma.SurgeryMaterialGetPayload<{ include: typeof materialInclude }>;

export function serializeSurgeryMaterial(m: MaterialRow): SurgeryMaterial {
  return {
    id: m.id,
    surgeryId: m.surgeryId,
    itemId: m.itemId,
    qtyPlanned: m.qtyPlanned,
    qtyUsed: m.qtyUsed,
    unitCost: m.unitCost,
    notes: m.notes,
    item: {
      id: m.item.id,
      code: m.item.code,
      name: m.item.name,
      category: m.item.category,
      size: m.item.size,
      unit: m.item.unit,
      stockQty: m.item.stockQty,
      minStock: m.item.minStock,
    },
  };
}

export function serializeFollowUp(f: Prisma.FollowUpGetPayload<object>): FollowUp {
  return {
    id: f.id,
    surgeryId: f.surgeryId,
    scheduledDate: iso(f.scheduledDate),
    type: f.type as FollowUp['type'],
    notes: f.notes,
    status: f.status as FollowUp['status'],
    doneAt: isoOrNull(f.doneAt),
    createdAt: iso(f.createdAt),
  };
}

export function serializeSurgery(s: SurgeryRow): Surgery {
  const materialsCost = s.materials.reduce(
    (acc, m) => acc + (m.qtyUsed ?? 0) * (m.unitCost ?? 0),
    0,
  );
  return {
    id: s.id,
    code: s.code,
    patientId: s.patientId,
    vetId: s.vetId,
    procedureType: s.procedureType,
    bodyRegion: s.bodyRegion,
    laterality: s.laterality,
    description: s.description,
    scheduledAt: iso(s.scheduledAt),
    durationMin: s.durationMin,
    anesthesiaType: s.anesthesiaType,
    asaRisk: s.asaRisk,
    preoperativeNotes: s.preoperativeNotes,
    postoperativeNotes: s.postoperativeNotes,
    estimatedCost: s.estimatedCost,
    status: s.status as Surgery['status'],
    startedAt: isoOrNull(s.startedAt),
    completedAt: isoOrNull(s.completedAt),
    createdAt: iso(s.createdAt),
    updatedAt: iso(s.updatedAt),
    patient: {
      id: s.patient.id,
      code: s.patient.code,
      name: s.patient.name,
      species: s.patient.species,
      breed: s.patient.breed,
      sex: s.patient.sex,
      weight: s.patient.weight,
      birthDate: isoOrNull(s.patient.birthDate),
      ageMonths: calcAgeMonths(s.patient.birthDate),
      owner: {
        id: s.patient.owner.id,
        fullName: s.patient.owner.fullName,
        phone: s.patient.owner.phone,
        city: s.patient.owner.city,
      },
    },
    vet: s.vet ? { id: s.vet.id, fullName: s.vet.fullName, specialty: s.vet.specialty } : null,
    materialsCount: s.materials.length,
    materialsCost,
  };
}

export function serializeSurgeryDetail(s: SurgeryRow): SurgeryDetail {
  return {
    ...serializeSurgery(s),
    materials: s.materials.map(serializeSurgeryMaterial),
    followUps: s.followUps.map(serializeFollowUp),
  };
}

// ========================= GENERADORES DE CÓDIGO ============================

/** PAC-<año>-<NNNN> — máximo código del año + 1 (debe ejecutarse en transacción). */
export async function nextPatientCode(tx: Prisma.TransactionClient): Promise<string> {
  const prefix = `PAC-${new Date().getFullYear()}-`;
  const last = await tx.patient.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });
  const n = (last ? Number.parseInt(last.code.slice(prefix.length), 10) || 0 : 0) + 1;
  return `${prefix}${String(n).padStart(4, '0')}`;
}

/** INV-<NNNN> — máximo código global + 1 (debe ejecutarse en transacción). */
export async function nextInventoryCode(tx: Prisma.TransactionClient): Promise<string> {
  const prefix = 'INV-';
  const last = await tx.inventoryItem.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });
  const n = (last ? Number.parseInt(last.code.slice(prefix.length), 10) || 0 : 0) + 1;
  return `${prefix}${String(n).padStart(4, '0')}`;
}

/** CIR-<año>-<NNNN> — máximo código del año + 1 (debe ejecutarse en transacción). */
export async function nextSurgeryCode(tx: Prisma.TransactionClient): Promise<string> {
  const prefix = `CIR-${new Date().getFullYear()}-`;
  const last = await tx.surgery.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });
  const n = (last ? Number.parseInt(last.code.slice(prefix.length), 10) || 0 : 0) + 1;
  return `${prefix}${String(n).padStart(4, '0')}`;
}

// ====================== TRANSICIONES DE ESTADO ==============================

export const ALLOWED_SURGERY_TRANSITIONS: Record<string, string[]> = {
  PROGRAMADA: ['EN_CURSO', 'COMPLETADA', 'CANCELADA'],
  EN_CURSO: ['COMPLETADA', 'CANCELADA'],
  COMPLETADA: [],
  CANCELADA: [],
};
