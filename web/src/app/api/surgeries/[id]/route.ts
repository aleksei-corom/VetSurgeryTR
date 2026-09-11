// GET /api/surgeries/[id] · PATCH /api/surgeries/[id]
//
// PATCH tiene dos usos:
//  a) Cambio de estado (body.status): valida transiciones válidas y, al pasar a
//     COMPLETADA, consume el inventario de los materiales con qtyUsed (SALIDA).
//  b) Actualización de campos editables + sincronización opcional de materials.
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ALLOWED_SURGERY_TRANSITIONS,
  anesthesiaSchema,
  ApiError,
  dateSchema,
  errorResponse,
  lateralitySchema,
  parseBody,
  readJson,
  serializeSurgeryDetail,
  surgeryInclude,
} from '@/lib/api-helpers';
import { SURGERY_STATUSES } from '@/lib/api-types';

export const dynamic = 'force-dynamic';

const surgeryPatchSchema = z.object({
  status: z.enum(SURGERY_STATUSES).optional(),
  procedureType: z.string().min(1).optional(),
  bodyRegion: z.string().min(1).nullish(),
  laterality: lateralitySchema.nullish(),
  description: z.string().min(1).nullish(),
  scheduledAt: dateSchema.optional(),
  durationMin: z.number().int().positive().max(1440).nullish(),
  anesthesiaType: anesthesiaSchema.nullish(),
  asaRisk: z.number().int().min(1).max(5).nullish(),
  preoperativeNotes: z.string().min(1).nullish(),
  postoperativeNotes: z.string().min(1).nullish(),
  estimatedCost: z.number().min(0).nullish(),
  vetId: z.string().min(1).nullish(),
  materials: z
    .array(
      z.object({
        itemId: z.string().min(1),
        qtyPlanned: z.number().positive('qtyPlanned debe ser mayor a 0'),
        qtyUsed: z.number().min(0).nullish(),
        notes: z.string().min(1).nullish(),
      }),
    )
    .optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const surgery = await db.surgery.findUnique({ where: { id }, include: surgeryInclude });
    if (!surgery) {
      return NextResponse.json({ error: 'Cirugía no encontrada' }, { status: 404 });
    }
    return NextResponse.json({ data: serializeSurgeryDetail(surgery) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = parseBody(surgeryPatchSchema, await readJson(request));

    const current = await db.surgery.findUnique({ where: { id }, select: { id: true, code: true, status: true } });
    if (!current) {
      return NextResponse.json({ error: 'Cirugía no encontrada' }, { status: 404 });
    }

    const changingStatus = body.status !== undefined && body.status !== current.status;
    const newStatus = changingStatus ? body.status : undefined;
    if (changingStatus && newStatus === undefined) {
      throw new ApiError(400, 'Estado inválido');
    }
    if (changingStatus) {
      const allowed = ALLOWED_SURGERY_TRANSITIONS[current.status] ?? [];
      if (!newStatus || !allowed.includes(newStatus)) {
        throw new ApiError(400, `Transición no permitida: ${current.status} → ${body.status}`);
      }
    }

    if (body.materials !== undefined && current.status === 'COMPLETADA') {
      throw new ApiError(
        400,
        'No se pueden modificar los materiales de una cirugía completada (el consumo ya fue registrado)',
      );
    }

    if (body.vetId) {
      const vet = await db.vet.findUnique({ where: { id: body.vetId }, select: { id: true } });
      if (!vet) {
        throw new ApiError(400, 'Veterinario no encontrado');
      }
    }

    const updated = await db.$transaction(async (tx) => {
      // 1) Sincronizar materiales (upsert/delete sobre la clave surgeryId+itemId).
      if (body.materials !== undefined) {
        const keepItemIds = body.materials.map((m) => m.itemId);
        await tx.surgeryMaterial.deleteMany({
          where: { surgeryId: id, itemId: { notIn: keepItemIds } },
        });
        for (const m of body.materials) {
          const item = await tx.inventoryItem.findUnique({
            where: { id: m.itemId },
            select: { id: true, unitCost: true },
          });
          if (!item) {
            throw new ApiError(400, `Item de inventario no encontrado: ${m.itemId}`);
          }
          await tx.surgeryMaterial.upsert({
            where: { surgeryId_itemId: { surgeryId: id, itemId: m.itemId } },
            update: {
              qtyPlanned: m.qtyPlanned,
              qtyUsed: m.qtyUsed ?? null,
              notes: m.notes ?? null,
              unitCost: item.unitCost ?? undefined,
            },
            create: {
              surgeryId: id,
              itemId: m.itemId,
              qtyPlanned: m.qtyPlanned,
              qtyUsed: m.qtyUsed ?? null,
              notes: m.notes ?? null,
              unitCost: item.unitCost,
            },
          });
        }
      }

      // 2) Actualizar campos editables + estado.
      const data: Prisma.SurgeryUncheckedUpdateInput = {};
      if (body.procedureType !== undefined) data.procedureType = body.procedureType;
      if (body.bodyRegion !== undefined) data.bodyRegion = body.bodyRegion ?? null;
      if (body.laterality !== undefined) data.laterality = body.laterality ?? null;
      if (body.description !== undefined) data.description = body.description ?? null;
      if (body.scheduledAt !== undefined) data.scheduledAt = body.scheduledAt;
      if (body.durationMin !== undefined) data.durationMin = body.durationMin ?? null;
      if (body.anesthesiaType !== undefined) data.anesthesiaType = body.anesthesiaType ?? null;
      if (body.asaRisk !== undefined) data.asaRisk = body.asaRisk ?? null;
      if (body.preoperativeNotes !== undefined) data.preoperativeNotes = body.preoperativeNotes ?? null;
      if (body.postoperativeNotes !== undefined) data.postoperativeNotes = body.postoperativeNotes ?? null;
      if (body.estimatedCost !== undefined) data.estimatedCost = body.estimatedCost ?? null;
      if (body.vetId !== undefined) data.vetId = body.vetId;
      if (changingStatus && newStatus !== undefined) {
        data.status = newStatus;
        if (newStatus === 'EN_CURSO') data.startedAt = new Date();
        if (newStatus === 'COMPLETADA') data.completedAt = new Date();
      }
      await tx.surgery.update({ where: { id }, data });

      // 3) Consumo de inventario al completar (se ejecuta una sola vez:
      //    solo se llega aquí desde PROGRAMADA/EN_CURSO, nunca desde COMPLETADA).
      if (changingStatus && newStatus === 'COMPLETADA') {
        const materials = await tx.surgeryMaterial.findMany({
          where: { surgeryId: id },
          include: { item: true },
        });
        for (const m of materials) {
          if (m.qtyUsed == null) continue;
          const newStock = m.item.stockQty - m.qtyUsed;
          if (newStock < 0) {
            throw new ApiError(
              400,
              `Stock insuficiente para ${m.item.name}: disponible ${m.item.stockQty}, requerido ${m.qtyUsed}`,
            );
          }
          await tx.inventoryItem.update({
            where: { id: m.itemId },
            data: { stockQty: newStock },
          });
          await tx.inventoryMovement.create({
            data: {
              itemId: m.itemId,
              type: 'SALIDA',
              qty: m.qtyUsed,
              stockAfter: newStock,
              surgeryId: id,
              reason: `Consumo cirugía ${current.code}`,
            },
          });
        }
      }

      return tx.surgery.findUniqueOrThrow({ where: { id }, include: surgeryInclude });
    });

    return NextResponse.json({ data: serializeSurgeryDetail(updated) });
  } catch (e) {
    return errorResponse(e);
  }
}
