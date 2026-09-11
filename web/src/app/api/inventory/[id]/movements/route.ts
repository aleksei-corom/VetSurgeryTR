// POST /api/inventory/[id]/movements
// ENTRADA suma stock · SALIDA resta (valida stock) · AJUSTE fija stock absoluto.
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError,
  errorResponse,
  parseBody,
  readJson,
  serializeInventoryItem,
  serializeMovement,
} from '@/lib/api-helpers';
import { MOVEMENT_TYPES } from '@/lib/api-types';

export const dynamic = 'force-dynamic';

const movementCreateSchema = z.object({
  type: z.enum(MOVEMENT_TYPES),
  qty: z.number().positive('la cantidad debe ser mayor a 0'),
  unitCost: z.number().min(0).nullish(),
  reason: z.string().min(1).nullish(),
  surgeryId: z.string().min(1).nullish(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = parseBody(movementCreateSchema, await readJson(request));

    const result = await db.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { id } });
      if (!item) {
        throw new ApiError(404, 'Item de inventario no encontrado');
      }

      if (body.surgeryId) {
        const surgery = await tx.surgery.findUnique({
          where: { id: body.surgeryId },
          select: { id: true },
        });
        if (!surgery) {
          throw new ApiError(400, 'Cirugía no encontrada');
        }
      }

      let newStock: number;
      if (body.type === 'ENTRADA') {
        newStock = item.stockQty + body.qty;
      } else if (body.type === 'SALIDA') {
        if (item.stockQty - body.qty < 0) {
          throw new ApiError(400, `Stock insuficiente: disponible ${item.stockQty}`);
        }
        newStock = item.stockQty - body.qty;
      } else {
        // AJUSTE: qty es el stock físico contado (valor final).
        newStock = body.qty;
      }

      const updated = await tx.inventoryItem.update({
        where: { id },
        data: { stockQty: newStock },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          itemId: id,
          type: body.type,
          qty: body.qty,
          stockAfter: newStock,
          unitCost: body.unitCost ?? null,
          reason: body.reason ?? null,
          surgeryId: body.surgeryId ?? null,
        },
        include: {
          item: { select: { id: true, code: true, name: true, unit: true } },
          surgery: { select: { code: true, patient: { select: { name: true } } } },
        },
      });

      return { movement, item: updated };
    });

    return NextResponse.json(
      {
        data: {
          movement: serializeMovement(result.movement),
          item: serializeInventoryItem(result.item),
        },
      },
      { status: 201 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
