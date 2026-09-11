// GET /api/inventory?q=&category=&lowStock=1 · POST /api/inventory
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  dateSchema,
  errorResponse,
  nextInventoryCode,
  parseBody,
  readJson,
  serializeInventoryItem,
} from '@/lib/api-helpers';
import { INVENTORY_CATEGORIES } from '@/lib/api-types';

export const dynamic = 'force-dynamic';

const inventoryCreateSchema = z.object({
  name: z.string().min(1, 'el nombre es requerido'),
  category: z.enum(INVENTORY_CATEGORIES),
  subType: z.string().min(1).nullish(),
  material: z.string().min(1).nullish(),
  size: z.string().min(1).nullish(),
  unit: z.string().min(1, 'la unidad es requerida'),
  stockQty: z.number().min(0).nullish().transform((v) => v ?? 0),
  minStock: z.number().min(0).nullish().transform((v) => v ?? 0),
  unitCost: z.number().min(0).nullish(),
  supplier: z.string().min(1).nullish(),
  lotNumber: z.string().min(1).nullish(),
  expiresAt: dateSchema.nullish(),
  location: z.string().min(1).nullish(),
  notes: z.string().min(1).nullish(),
});

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;
    const q = sp.get('q')?.trim() ?? '';
    const category = sp.get('category')?.trim() ?? '';
    const lowStock = sp.get('lowStock') === '1';

    const where: Prisma.InventoryItemWhereInput = {};
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
        { subType: { contains: q } },
        { size: { contains: q } },
        { supplier: { contains: q } },
      ];
    }
    if (category) where.category = category;
    if (lowStock) where.active = true;

    let items = await db.inventoryItem.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    // stockQty <= minStock es comparación columna-a-columna: se filtra en memoria.
    if (lowStock) {
      items = items.filter((i) => i.stockQty <= i.minStock);
    }
    return NextResponse.json({ data: items.map(serializeInventoryItem) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const body = parseBody(inventoryCreateSchema, await readJson(request));

    const item = await db.$transaction(async (tx) => {
      const code = await nextInventoryCode(tx);
      const created = await tx.inventoryItem.create({
        data: {
          code,
          name: body.name,
          category: body.category,
          subType: body.subType ?? null,
          material: body.material ?? null,
          size: body.size ?? null,
          unit: body.unit,
          stockQty: body.stockQty,
          minStock: body.minStock,
          unitCost: body.unitCost ?? null,
          supplier: body.supplier ?? null,
          lotNumber: body.lotNumber ?? null,
          expiresAt: body.expiresAt ?? null,
          location: body.location ?? null,
          notes: body.notes ?? null,
        },
      });
      // Registrar entrada inicial para que existencias y movimientos cuadren.
      if (created.stockQty > 0) {
        await tx.inventoryMovement.create({
          data: {
            itemId: created.id,
            type: 'ENTRADA',
            qty: created.stockQty,
            stockAfter: created.stockQty,
            unitCost: created.unitCost,
            reason: 'Inventario inicial',
          },
        });
      }
      return created;
    });

    return NextResponse.json({ data: serializeInventoryItem(item) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
