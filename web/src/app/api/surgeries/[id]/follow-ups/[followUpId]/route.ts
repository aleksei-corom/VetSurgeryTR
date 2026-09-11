// PATCH /api/surgeries/[id]/follow-ups/[followUpId]
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from '@/lib/db';
import { errorResponse, parseBody, readJson, serializeFollowUp } from '@/lib/api-helpers';
import { FOLLOW_UP_STATUSES } from '@/lib/api-types';

export const dynamic = 'force-dynamic';

const followUpPatchSchema = z.object({
  status: z.enum(FOLLOW_UP_STATUSES),
  notes: z.string().min(1).nullish(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; followUpId: string }> },
) {
  try {
    const { id, followUpId } = await params;
    const body = parseBody(followUpPatchSchema, await readJson(request));

    const surgery = await db.surgery.findUnique({ where: { id }, select: { id: true } });
    if (!surgery) {
      return NextResponse.json({ error: 'Cirugía no encontrada' }, { status: 404 });
    }

    const existing = await db.followUp.findUnique({ where: { id: followUpId } });
    if (!existing || existing.surgeryId !== id) {
      return NextResponse.json(
        { error: 'Control postoperatorio no encontrado en esta cirugía' },
        { status: 404 },
      );
    }

    const data: Prisma.FollowUpUncheckedUpdateInput = {
      status: body.status,
    };
    if (body.notes !== undefined) data.notes = body.notes ?? null;
    if (body.status === 'CUMPLIDO') data.doneAt = new Date();

    const followUp = await db.followUp.update({ where: { id: followUpId }, data });
    return NextResponse.json({ data: serializeFollowUp(followUp) });
  } catch (e) {
    return errorResponse(e);
  }
}
