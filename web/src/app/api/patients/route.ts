// GET /api/patients?q=&species=&active= · POST /api/patients
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError,
  dateSchema,
  errorResponse,
  nextPatientCode,
  parseBody,
  patientListInclude,
  readJson,
  serializePatient,
} from '@/lib/api-helpers';
import { DOCUMENT_TYPES } from '@/lib/api-types';

export const dynamic = 'force-dynamic';

const patientCreateSchema = z.object({
  owner: z.object({
    documentType: z.enum(DOCUMENT_TYPES),
    documentNumber: z.string().min(1, 'el número de documento es requerido'),
    fullName: z.string().min(1, 'el nombre del propietario es requerido'),
    phone: z.string().min(1).nullish(),
    email: z.email('email inválido').nullish(),
    address: z.string().min(1).nullish(),
    city: z.string().min(1).nullish(),
  }),
  name: z.string().min(1, 'el nombre del paciente es requerido'),
  species: z.string().min(1, 'la especie es requerida'),
  breed: z.string().min(1).nullish(),
  sex: z.enum(['M', 'F']),
  birthDate: dateSchema.nullish(),
  weight: z.number().positive('el peso debe ser mayor a 0').nullish(),
  neutered: z.boolean().nullish(),
  color: z.string().min(1).nullish(),
  microchip: z.string().min(1).nullish(),
  notes: z.string().min(1).nullish(),
});

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;
    const q = sp.get('q')?.trim() ?? '';
    const species = sp.get('species')?.trim() ?? '';
    const activeParam = sp.get('active')?.trim() ?? '';

    const where: Prisma.PatientWhereInput = {};
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { code: { contains: q } },
        { owner: { fullName: { contains: q } } },
        { microchip: { contains: q } },
      ];
    }
    if (species) where.species = species;
    if (['true', '1', 'false', '0'].includes(activeParam)) {
      where.active = activeParam === 'true' || activeParam === '1';
    }

    const patients = await db.patient.findMany({
      where,
      include: patientListInclude,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ data: patients.map(serializePatient) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const body = parseBody(patientCreateSchema, await readJson(request));

    const patient = await db.$transaction(async (tx) => {
      // Reutilizar propietario por documento único; crearlo si no existe.
      const owner = await tx.owner.upsert({
        where: {
          documentType_documentNumber: {
            documentType: body.owner.documentType,
            documentNumber: body.owner.documentNumber,
          },
        },
        update: {
          fullName: body.owner.fullName,
          ...(body.owner.phone !== undefined && { phone: body.owner.phone }),
          ...(body.owner.email !== undefined && { email: body.owner.email }),
          ...(body.owner.address !== undefined && { address: body.owner.address }),
          ...(body.owner.city !== undefined && { city: body.owner.city }),
        },
        create: {
          documentType: body.owner.documentType,
          documentNumber: body.owner.documentNumber,
          fullName: body.owner.fullName,
          phone: body.owner.phone ?? null,
          email: body.owner.email ?? null,
          address: body.owner.address ?? null,
          city: body.owner.city ?? null,
        },
      });

      const code = await nextPatientCode(tx);
      return tx.patient.create({
        data: {
          code,
          ownerId: owner.id,
          name: body.name,
          species: body.species,
          breed: body.breed ?? null,
          sex: body.sex,
          birthDate: body.birthDate ?? null,
          weight: body.weight ?? null,
          neutered: body.neutered ?? false,
          color: body.color ?? null,
          microchip: body.microchip ?? null,
          notes: body.notes ?? null,
        },
        include: { owner: true },
      });
    });

    return NextResponse.json({ data: serializePatient(patient) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
