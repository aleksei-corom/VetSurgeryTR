"use client";

import { isToday } from "date-fns";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bone,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  PawPrint,
  Scissors,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useDashboard } from "@/hooks/use-queries";
import { useAppStore } from "@/stores/app-store";
import {
  FOLLOW_UP_TYPE_LABEL,
  INVENTORY_CATEGORY_META,
} from "@/lib/api-types";
import { formatCOP, formatDate, formatTime, shortName } from "@/lib/format";
import { SurgeryStatusBadge } from "@/components/status-badges";
import { cn } from "@/lib/utils";

const BAR_COLOR = "var(--color-primary)";

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  icon: typeof Activity;
  label: string;
  value: number | string;
  hint?: string;
  tone: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "group bg-card relative flex items-center gap-3 overflow-hidden rounded-xl border p-4 text-left shadow-sm transition-all",
        onClick && "hover:-translate-y-0.5 hover:shadow-md",
      )}
    >
      <div
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-black/5 transition-transform group-hover:scale-105",
          tone,
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl leading-none font-bold tabular-nums">{value}</p>
        <p className="text-muted-foreground mt-1 truncate text-xs">{label}</p>
        {hint && (
          <p className="mt-0.5 truncate text-[11px] font-medium text-amber-600 dark:text-amber-400">
            {hint}
          </p>
        )}
      </div>
    </button>
  );
}

export function DashboardView() {
  const { data, isLoading } = useDashboard();
  const setView = useAppStore((s) => s.setView);
  const focusEntity = useAppStore((s) => s.focusEntity);

  const stats = data?.stats;
  const monthly = (data?.monthlySurgeries ?? []).map((m) => ({
    ...m,
    month: m.month.slice(5) + "/" + m.month.slice(2, 4),
  }));

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Activity className="text-primary size-5" aria-hidden="true" />
            Panel del quirófano
          </h2>
          <p className="text-muted-foreground text-sm">
            Resumen de la actividad ortopédica: agenda, inventario y
            postoperatorios.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setView("cirugias")}>
          Ver agenda quirúrgica
          <ArrowRight className="size-4" />
        </Button>
      </div>

      {/* KPIs */}
      <section aria-label="Indicadores generales" className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {isLoading &&
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[84px] rounded-xl" />
          ))}
        {stats && (
          <>
            <StatCard
              icon={PawPrint}
              label="Pacientes activos"
              value={stats.patientsActive}
              tone="bg-primary/10 text-primary"
              onClick={() => setView("pacientes")}
            />
            <StatCard
              icon={CalendarClock}
              label="Cirugías programadas"
              value={stats.surgeriesScheduled}
              hint={stats.surgeriesInProgress > 0 ? `${stats.surgeriesInProgress} en curso ahora` : undefined}
              tone="bg-teal-500/10 text-teal-700 dark:text-teal-300"
              onClick={() => setView("cirugias")}
            />
            <StatCard
              icon={CheckCircle2}
              label="Completadas este mes"
              value={stats.surgeriesCompletedMonth}
              tone="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              onClick={() => setView("cirugias")}
            />
            <StatCard
              icon={AlertTriangle}
              label="Materiales en alerta"
              value={stats.lowStockCount}
              hint={stats.lowStockCount > 0 ? "Stock en o bajo el mínimo" : "Todo en niveles OK"}
              tone="bg-amber-500/10 text-amber-600 dark:text-amber-400"
              onClick={() => setView("inventario")}
            />
            <StatCard
              icon={ClipboardList}
              label="Controles por cumplir"
              value={stats.followUpsDue}
              hint={stats.followUpsDue > 0 ? "Incluye vencidos" : undefined}
              tone="bg-orange-500/10 text-orange-600 dark:text-orange-400"
              onClick={() => setView("cirugias")}
            />
            <StatCard
              icon={Wallet}
              label="Valor del inventario"
              value={formatCOP(stats.inventoryValue)}
              tone="bg-rose-500/10 text-rose-600 dark:text-rose-400"
              onClick={() => setView("inventario")}
            />
          </>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Próximas cirugías */}
        <Card className="gap-0 p-0 lg:col-span-2">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-base">
              <Scissors className="text-primary size-4" aria-hidden="true" />
              Próximas cirugías
            </CardTitle>
            <CardDescription>Agenda quirúrgica programada</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading && (
              <div className="space-y-2 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            )}
            {data && data.upcomingSurgeries.length === 0 && (
              <p className="text-muted-foreground p-8 text-center text-sm">
                No hay cirugías programadas. Agenda una desde el módulo de
                cirugías.
              </p>
            )}
            {data && data.upcomingSurgeries.length > 0 && (
              <ul className="divide-y">
                {data.upcomingSurgeries.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => focusEntity({ kind: "surgery", id: s.id })}
                      className="hover:bg-accent/50 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
                    >
                      <div
                        className={cn(
                          "flex size-11 shrink-0 flex-col items-center justify-center rounded-lg border text-center leading-none",
                          isToday(new Date(s.scheduledAt))
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "bg-muted/60 text-muted-foreground",
                        )}
                      >
                        <span className="text-[10px] font-semibold uppercase">
                          {formatDate(s.scheduledAt).split(" ")[1]}
                        </span>
                        <span className="text-sm font-bold">
                          {formatDate(s.scheduledAt).split(" ")[0]}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {s.patient?.name}{" "}
                          <span className="text-muted-foreground font-normal">
                            · {s.patient?.species}
                          </span>
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {s.procedureType}
                          {s.bodyRegion ? ` · ${s.bodyRegion}` : ""}
                        </p>
                      </div>
                      <div className="hidden text-right sm:block">
                        <p className="text-xs font-medium">
                          {formatTime(s.scheduledAt)}
                        </p>
                        <p className="text-muted-foreground text-[11px]">
                          {s.vet ? shortName(s.vet.fullName) : "Sin asignar"}
                        </p>
                      </div>
                      <SurgeryStatusBadge status={s.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Alertas de stock */}
          <Card className="gap-0 p-0">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="size-4 text-amber-500" aria-hidden="true" />
                Alertas de inventario
              </CardTitle>
              <CardDescription>Implantes e insumos críticos</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading && (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              )}
              {data && data.lowStockItems.length === 0 && (
                <p className="text-muted-foreground p-6 text-center text-sm">
                  Todo el inventario está en niveles adecuados.
                </p>
              )}
              {data && data.lowStockItems.length > 0 && (
                <ul className="max-h-64 divide-y overflow-y-auto">
                  {data.lowStockItems.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => focusEntity({ kind: "inventory", id: item.id })}
                        className="hover:bg-accent/50 flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors"
                      >
                        <Bone className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {item.name}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 text-xs font-semibold tabular-nums",
                            item.stockQty <= 0
                              ? "text-destructive"
                              : "text-amber-600 dark:text-amber-400",
                          )}
                        >
                          {item.stockQty}/{item.minStock} {item.unit}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Controles postoperatorios */}
          <Card className="gap-0 p-0">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="text-primary size-4" aria-hidden="true" />
                Controles postoperatorios
              </CardTitle>
              <CardDescription>Revisiones pendientes o vencidas</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading && (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              )}
              {data && data.followUpsDueList.length === 0 && (
                <p className="text-muted-foreground p-6 text-center text-sm">
                  Sin controles pendientes. Buen postoperatorio.
                </p>
              )}
              {data && data.followUpsDueList.length > 0 && (
                <ul className="max-h-56 divide-y overflow-y-auto">
                  {data.followUpsDueList.map((f) => {
                    const overdue = new Date(f.scheduledDate) < new Date();
                    return (
                      <li
                        key={f.id}
                        className="hover:bg-accent/50 flex items-center gap-2 px-4 py-2.5 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {f.surgery.patient.name}
                          </p>
                          <p className="text-muted-foreground truncate text-[11px]">
                            {FOLLOW_UP_TYPE_LABEL[f.type] ?? f.type} ·{" "}
                            {f.surgery.code}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-xs font-medium tabular-nums",
                            overdue && "text-destructive",
                          )}
                        >
                          {formatDate(f.scheduledDate)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Gráficas */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="text-primary size-4" aria-hidden="true" />
              Cirugías por mes
            </CardTitle>
            <CardDescription>Últimos 6 meses de actividad</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--accent)" }}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" name="Cirugías" fill={BAR_COLOR} radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bone className="text-primary size-4" aria-hidden="true" />
              Inventario por categoría
            </CardTitle>
            <CardDescription>Referencias activas de implantes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={(data?.categoryDistribution ?? []).map((c) => ({
                    name: INVENTORY_CATEGORY_META[c.category]?.label ?? c.category,
                    count: c.count,
                  }))}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 30, bottom: 0 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--accent)" }}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius)",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" name="Referencias" radius={[0, 6, 6, 0]} maxBarSize={18}>
                    {(data?.categoryDistribution ?? []).map((entry, index) => (
                      <Cell
                        key={index}
                        fill={index % 2 === 0 ? "var(--color-primary)" : "var(--color-chart-3)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
