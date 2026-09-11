// GET /api/owners?q= · POST /api/owners
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import {
  ApiError,
  errorResponse,
  parseBody,
  readJson,
  serializeOwner,
} from '@/lib/api-helpers';
import { DOCUMENT_TYPES } from '@/lib/api-types';

export const dynamic = 'force-dynamic';

const ownerCreateSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPES),
  documentNumber: z.string().min(1, 'el número de documento es requerido'),
  fullName: z.string().min(1, 'el nombre completo es requerido'),
  phone: z.string().min(1).nullish(),
  email: z.email('email inválido').nullish(),
  address: z.string().min(1).nullish(),
  city: z.string().min(1).nullish(),
  notes: z.string().min(1).nullish(),
});

export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
    const owners = await db.owner.findMany({
      where: q
        ? {
            OR: [
              { fullName: { contains: q } },
              { documentNumber: { contains: q } },
              { phone: { contains: q } },
            ],
          }
        : undefined,
      orderBy: { fullName: 'asc' },
    });
    return NextResponse.json({ data: owners.map(serializeOwner) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const body = parseBody(ownerCreateSchema, await readJson(request));

    const existing = await db.owner.findUnique({
      where: {
        documentType_documentNumber: {
          documentType: body.documentType,
          documentNumber: body.documentNumber,
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new ApiError(400, 'Ya existe un propietario con ese documento');
    }

    const owner = await db.owner.create({
      data: {
        documentType: body.documentType,
        documentNumber: body.documentNumber,
        fullName: body.fullName,
        phone: body.phone ?? null,
        email: body.email ?? null,
        address: body.address ?? null,
        city: body.city ?? null,
        notes: body.notes ?? null,
      },
    });
    return NextResponse.json({ data: serializeOwner(owner) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
