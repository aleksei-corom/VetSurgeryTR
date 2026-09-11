// GET /api/patients/[id] · PATCH /api/patients/[id]
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  dateSchema,
  errorResponse,
  parseBody,
  readJson,
  serializePatient,
} from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

const patientPatchSchema = z.object({
  name: z.string().min(1).optional(),
  species: z.string().min(1).optional(),
  breed: z.string().min(1).nullish(),
  sex: z.enum(['M', 'F']).optional(),
  birthDate: dateSchema.nullish(),
  weight: z.number().positive('el peso debe ser mayor a 0').nullish(),
  neutered: z.boolean().optional(),
  color: z.string().min(1).nullish(),
  microchip: z.string().min(1).nullish(),
  active: z.boolean().optional(),
  notes: z.string().min(1).nullish(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const patient = await db.patient.findUnique({
      where: { id },
      include: {
        owner: true,
        surgeries: {
          orderBy: { scheduledAt: 'desc' },
          include: { vet: { select: { id: true, fullName: true } } },
        },
      },
    });
    if (!patient) {
      return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
    }

    const surgeries = patient.surgeries.map((s) => ({
      id: s.id,
      code: s.code,
      procedureType: s.procedureType,
      scheduledAt: s.scheduledAt.toISOString(),
      status: s.status,
      bodyRegion: s.bodyRegion,
      laterality: s.laterality,
      vet: s.vet ? { id: s.vet.id, fullName: s.vet.fullName } : null,
    }));

    return NextResponse.json({ data: { ...serializePatient(patient), surgeries } });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = parseBody(patientPatchSchema, await readJson(request));

    const existing = await db.patient.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
    }

    const data: Prisma.PatientUncheckedUpdateInput = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.species !== undefined) data.species = body.species;
    if (body.breed !== undefined) data.breed = body.breed;
    if (body.sex !== undefined) data.sex = body.sex;
    if (body.birthDate !== undefined) data.birthDate = body.birthDate ?? null;
    if (body.weight !== undefined) data.weight = body.weight ?? null;
    if (body.neutered !== undefined) data.neutered = body.neutered;
    if (body.color !== undefined) data.color = body.color;
    if (body.microchip !== undefined) data.microchip = body.microchip ?? null;
    if (body.active !== undefined) data.active = body.active;
    if (body.notes !== undefined) data.notes = body.notes ?? null;

    const patient = await db.patient.update({
      where: { id },
      data,
      include: { owner: true },
    });
    return NextResponse.json({ data: serializePatient(patient) });
  } catch (e) {
    return errorResponse(e);
  }
}
