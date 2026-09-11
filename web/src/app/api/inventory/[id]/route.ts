// GET /api/inventory/[id] · PATCH /api/inventory/[id]
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  dateSchema,
  errorResponse,
  movementInclude,
  parseBody,
  readJson,
  serializeInventoryItem,
  serializeMovement,
} from '@/lib/api-helpers';
import { INVENTORY_CATEGORIES } from '@/lib/api-types';

export const dynamic = 'force-dynamic';

const inventoryPatchSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.enum(INVENTORY_CATEGORIES).optional(),
  subType: z.string().min(1).nullish(),
  material: z.string().min(1).nullish(),
  size: z.string().min(1).nullish(),
  unit: z.string().min(1).optional(),
  stockQty: z.number().min(0).nullish(),
  minStock: z.number().min(0).nullish(),
  unitCost: z.number().min(0).nullish(),
  supplier: z.string().min(1).nullish(),
  lotNumber: z.string().min(1).nullish(),
  expiresAt: dateSchema.nullish(),
  location: z.string().min(1).nullish(),
  active: z.boolean().optional(),
  notes: z.string().min(1).nullish(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const item = await db.inventoryItem.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ error: 'Item de inventario no encontrado' }, { status: 404 });
    }
    const movements = await db.inventoryMovement.findMany({
      where: { itemId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: movementInclude,
    });
    return NextResponse.json({
      data: {
        item: serializeInventoryItem(item),
        movements: movements.map(serializeMovement),
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = parseBody(inventoryPatchSchema, await readJson(request));

    const existing = await db.inventoryItem.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: 'Item de inventario no encontrado' }, { status: 404 });
    }

    const data: Prisma.InventoryItemUncheckedUpdateInput = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.category !== undefined) data.category = body.category;
    if (body.subType !== undefined) data.subType = body.subType ?? null;
    if (body.material !== undefined) data.material = body.material ?? null;
    if (body.size !== undefined) data.size = body.size ?? null;
    if (body.unit !== undefined) data.unit = body.unit;
    if (body.stockQty !== undefined) data.stockQty = body.stockQty ?? 0;
    if (body.minStock !== undefined) data.minStock = body.minStock ?? 0;
    if (body.unitCost !== undefined) data.unitCost = body.unitCost ?? null;
    if (body.supplier !== undefined) data.supplier = body.supplier ?? null;
    if (body.lotNumber !== undefined) data.lotNumber = body.lotNumber ?? null;
    if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ?? null;
    if (body.location !== undefined) data.location = body.location ?? null;
    if (body.active !== undefined) data.active = body.active;
    if (body.notes !== undefined) data.notes = body.notes ?? null;

    const item = await db.inventoryItem.update({ where: { id }, data });
    return NextResponse.json({ data: serializeInventoryItem(item) });
  } catch (e) {
    return errorResponse(e);
  }
}
