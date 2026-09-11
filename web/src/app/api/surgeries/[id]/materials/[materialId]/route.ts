// DELETE /api/surgeries/[id]/materials/[materialId]
import { NextResponse } from 'next/server';
import { ApiError, errorResponse } from '@/lib/api-helpers';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; materialId: string }> },
) {
  try {
    const { id, materialId } = await params;

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
        'No se pueden eliminar materiales de una cirugía completada (el consumo ya fue registrado)',
      );
    }

    const material = await db.surgeryMaterial.findUnique({ where: { id: materialId } });
    if (!material || material.surgeryId !== id) {
      return NextResponse.json(
        { error: 'Material no encontrado en esta cirugía' },
        { status: 404 },
      );
    }

    await db.surgeryMaterial.delete({ where: { id: materialId } });
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    return errorResponse(e);
  }
}
