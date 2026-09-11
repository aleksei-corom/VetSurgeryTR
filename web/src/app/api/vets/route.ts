// GET /api/vets · POST /api/vets
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { errorResponse, parseBody, readJson, serializeVet } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

const vetCreateSchema = z.object({
  fullName: z.string().min(1, 'el nombre completo es requerido'),
  license: z.string().min(1).nullish(),
  specialty: z.string().min(1).nullish(),
  phone: z.string().min(1).nullish(),
  email: z.email('email inválido').nullish(),
});

export async function GET() {
  try {
    const vets = await db.vet.findMany({
      where: { active: true },
      orderBy: { fullName: 'asc' },
    });
    return NextResponse.json({ data: vets.map(serializeVet) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: Request) {
  try {
    const body = parseBody(vetCreateSchema, await readJson(request));
    const vet = await db.vet.create({
      data: {
        fullName: body.fullName,
        license: body.license ?? null,
        specialty: body.specialty ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
      },
    });
    return NextResponse.json({ data: serializeVet(vet) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
