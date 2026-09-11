// POST /api/surgeries/[id]/follow-ups
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  dateSchema,
  errorResponse,
  parseBody,
  readJson,
  serializeFollowUp,
} from '@/lib/api-helpers';
import { FOLLOW_UP_TYPES } from '@/lib/api-types';

export const dynamic = 'force-dynamic';

const followUpCreateSchema = z.object({
  scheduledDate: dateSchema,
  type: z.enum(FOLLOW_UP_TYPES),
  notes: z.string().min(1).nullish(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = parseBody(followUpCreateSchema, await readJson(request));

    const surgery = await db.surgery.findUnique({ where: { id }, select: { id: true } });
    if (!surgery) {
      return NextResponse.json({ error: 'Cirugía no encontrada' }, { status: 404 });
    }

    const followUp = await db.followUp.create({
      data: {
        surgeryId: id,
        scheduledDate: body.scheduledDate,
        type: body.type,
        notes: body.notes ?? null,
        status: 'PENDIENTE',
      },
    });

    return NextResponse.json({ data: serializeFollowUp(followUp) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
