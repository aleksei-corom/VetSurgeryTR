// POST /api/surgeries/[id]/materials — upsert sobre (surgeryId, itemId)
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError,
  errorResponse,
  materialInclude,
  parseBody,
  readJson,
  serializeSurgeryMaterial,
} from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

const materialUpsertSchema = z.object({
  itemId: z.string().min(1, 'el item es requerido'),
  qtyPlanned: z.number().positive('qtyPlanned debe ser mayor a 0'),
  qtyUsed: z.number().min(0).nullish(),
  notes: z.string().min(1).nullish(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = parseBody(materialUpsertSchema, await readJson(request));

    const surgery = await db.surgery.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!surgery) {
      return NextResponse.json({ error: 'Cirugía no encontrada' }, { status: 404 });
    }
    if (surgery.status === 'COMPLETADA') {
      throw new ApiError(
        400,
        'No se pueden modificar los materiales de una cirugía completada (el consumo ya fue registrado)',
      );
    }

    const item = await db.inventoryItem.findUnique({ where: { id: body.itemId } });
    if (!item) {
      throw new ApiError(400, 'Item de inventario no encontrado');
    }

    const material = await db.surgeryMaterial.upsert({
      where: { surgeryId_itemId: { surgeryId: id, itemId: body.itemId } },
      update: {
        qtyPlanned: body.qtyPlanned,
        qtyUsed: body.qtyUsed ?? null,
        notes: body.notes ?? null,
        unitCost: item.unitCost ?? undefined,
      },
      create: {
        surgeryId: id,
        itemId: body.itemId,
        qtyPlanned: body.qtyPlanned,
        qtyUsed: body.qtyUsed ?? null,
        notes: body.notes ?? null,
        unitCost: item.unitCost,
      },
      include: materialInclude,
    });

    return NextResponse.json({ data: serializeSurgeryMaterial(material) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
