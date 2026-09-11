// GET /api/surgeries?status=&q=&patientId= · POST /api/surgeries
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError,
  anesthesiaSchema,
  dateSchema,
  errorResponse,
  lateralitySchema,
  nextSurgeryCode,
  parseBody,
  readJson,
  serializeSurgery,
  serializeSurgeryDetail,
  surgeryInclude,
} from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

const surgeryCreateSchema = z.object({
  patientId: z.string().min(1, 'el paciente es requerido'),
  vetId: z.string().min(1).nullish(),
  procedureType: z.string().min(1, 'el tipo de procedimiento es requerido'),
  bodyRegion: z.string().min(1).nullish(),
  laterality: lateralitySchema.nullish(),
  description: z.string().min(1).nullish(),
  scheduledAt: dateSchema,
  durationMin: z.number().int().positive().max(1440).nullish(),
  anesthesiaType: anesthesiaSchema.nullish(),
  asaRisk: z.number().int().min(1).max(5).nullish(),
  preoperativeNotes: z.string().min(1).nullish(),
  postoperativeNotes: z.string().min(1).nullish(),
  estimatedCost: z.number().min(0).nullish(),
});

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;
    const q = sp.get('q')?.trim() ?? '';
    const status = sp.get('status')?.trim() ?? '';
    const patientId = sp.get('patientId')?.trim() ?? '';

    const where: Prisma.SurgeryWhereInput = {};
    if (status) where.status = status;
    if (patientId) where.patientId = patientId;
    if (q) {
      where.OR = [
        { patient: { name: { contains: q } } },
        { patient: { code: { contains: q } } },
        { patient: { owner: { fullName: { contains: q } } } },
        { procedureType: { contains: q } },
        { code: { contains: q } },
      ];
    }

    const surgeries = await db.surgery.findMany({
      where,
      include: surgeryInclude,
      orderBy: { scheduledAt: 'desc' },
    });
    return NextResponse.json({ data: surgeries.map(serializeSurgery) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const body = parseBody(surgeryCreateSchema, await readJson(request));

    const patient = await db.patient.findUnique({
      where: { id: body.patientId },
      select: { id: true },
    });
    if (!patient) {
      throw new ApiError(400, 'Paciente no encontrado');
    }
    if (body.vetId) {
      const vet = await db.vet.findUnique({ where: { id: body.vetId }, select: { id: true } });
      if (!vet) {
        throw new ApiError(400, 'Veterinario no encontrado');
      }
    }

    const surgery = await db.$transaction(async (tx) => {
      const code = await nextSurgeryCode(tx);
      return tx.surgery.create({
        data: {
          code,
          patientId: body.patientId,
          vetId: body.vetId ?? null,
          procedureType: body.procedureType,
          bodyRegion: body.bodyRegion ?? null,
          laterality: body.laterality ?? null,
          description: body.description ?? null,
          scheduledAt: body.scheduledAt,
          durationMin: body.durationMin ?? null,
          anesthesiaType: body.anesthesiaType ?? null,
          asaRisk: body.asaRisk ?? null,
          preoperativeNotes: body.preoperativeNotes ?? null,
          postoperativeNotes: body.postoperativeNotes ?? null,
          estimatedCost: body.estimatedCost ?? null,
          status: 'PROGRAMADA',
        },
        include: surgeryInclude,
      });
    });

    return NextResponse.json({ data: serializeSurgeryDetail(surgery) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
