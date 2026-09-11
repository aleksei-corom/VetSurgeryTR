// GET /api/dashboard — métricas agregadas para la vista principal.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  errorResponse,
  serializeFollowUp,
  serializeInventoryItem,
  serializeSurgery,
  surgeryInclude,
} from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      patientsActive,
      surgeriesScheduled,
      surgeriesInProgress,
      surgeriesCompletedMonth,
      followUpsDue,
      activeItems,
      upcomingRaw,
      followUpsRaw,
      recentSurgeries,
      categoryGroups,
    ] = await Promise.all([
      db.patient.count({ where: { active: true } }),
      db.surgery.count({ where: { status: 'PROGRAMADA' } }),
      db.surgery.count({ where: { status: 'EN_CURSO' } }),
      db.surgery.count({
        where: { status: 'COMPLETADA', completedAt: { gte: startOfMonth, lte: endOfMonth } },
      }),
      db.followUp.count({
        where: { status: 'PENDIENTE', scheduledDate: { lte: endOfToday } },
      }),
      db.inventoryItem.findMany({ where: { active: true } }),
      db.surgery.findMany({
        where: { status: { in: ['PROGRAMADA', 'EN_CURSO'] }, scheduledAt: { gte: startOfToday } },
        include: surgeryInclude,
        orderBy: { scheduledAt: 'asc' },
        take: 6,
      }),
      db.followUp.findMany({
        where: { status: 'PENDIENTE', scheduledDate: { lte: endOfToday } },
        orderBy: { scheduledDate: 'asc' },
        take: 6,
        include: {
          surgery: {
            select: {
              code: true,
              procedureType: true,
              patient: { select: { name: true, species: true } },
            },
          },
        },
      }),
      db.surgery.findMany({
        where: { createdAt: { gte: sixMonthsAgo } },
        select: { createdAt: true },
      }),
      db.inventoryItem.groupBy({
        by: ['category'],
        where: { active: true },
        _count: { _all: true },
      }),
    ]);

    // Stock bajo y valor del inventario (comparación columna-a-columna en memoria).
    const lowStock = activeItems.filter((i) => i.stockQty <= i.minStock);
    const lowStockItems = [...lowStock]
      .sort((a, b) => a.stockQty - a.minStock - (b.stockQty - b.minStock))
      .slice(0, 8)
      .map(serializeInventoryItem);
    const inventoryValue = activeItems.reduce(
      (acc, i) => acc + i.stockQty * (i.unitCost ?? 0),
      0,
    );

    // Cirugías por mes (últimos 6 meses, incluido el actual).
    const monthlySurgeries: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlySurgeries.push({
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        count: 0,
      });
    }
    for (const s of recentSurgeries) {
      const key = `${s.createdAt.getFullYear()}-${String(s.createdAt.getMonth() + 1).padStart(2, '0')}`;
      const entry = monthlySurgeries.find((m) => m.month === key);
      if (entry) entry.count += 1;
    }

    return NextResponse.json({
      data: {
        stats: {
          patientsActive,
          surgeriesScheduled,
          surgeriesInProgress,
          surgeriesCompletedMonth,
          lowStockCount: lowStock.length,
          followUpsDue,
          inventoryValue,
        },
        upcomingSurgeries: upcomingRaw.map(serializeSurgery),
        lowStockItems,
        followUpsDueList: followUpsRaw.map((f) => ({
          ...serializeFollowUp(f),
          surgery: {
            code: f.surgery.code,
            procedureType: f.surgery.procedureType,
            patient: { name: f.surgery.patient.name, species: f.surgery.patient.species },
          },
        })),
        monthlySurgeries,
        categoryDistribution: categoryGroups
          .map((g) => ({ category: g.category, count: g._count._all }))
          .sort((a, b) => b.count - a.count),
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
