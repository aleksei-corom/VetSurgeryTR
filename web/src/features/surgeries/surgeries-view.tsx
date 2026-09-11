"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Ban,
  Bone,
  CheckCircle2,
  Package,
  PlayCircle,
  Plus,
  Scissors,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useSurgeries,
  useUpdateSurgery,
  getErrorMessage,
} from "@/hooks/use-queries";
import { SURGERY_STATUSES, type SurgeryStatus } from "@/lib/api-types";
import { formatCOP, formatDateTime, shortName } from "@/lib/format";
import { SurgeryStatusBadge } from "@/components/status-badges";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { SurgeryFormDialog } from "./surgery-form-dialog";
import { SurgeryDetailDialog } from "./surgery-detail-dialog";

const STATUS_TABS: { value: string | null; label: string }[] = [
  { value: null, label: "Todas" },
  { value: "PROGRAMADA", label: "Programadas" },
  { value: "EN_CURSO", label: "En curso" },
  { value: "COMPLETADA", label: "Completadas" },
  { value: "CANCELADA", label: "Canceladas" },
];

export function SurgeriesView() {
  const [status, setStatus] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [localDetailId, setLocalDetailId] = useState<string | null>(null);

  const { data: surgeries, isLoading } = useSurgeries({
    status: status ?? undefined,
    q: search,
  });
  const { data: all } = useSurgeries({});
  const updateSurgery = useUpdateSurgery();

  // Enfoque desde otras vistas (dashboard / ficha de paciente): estado derivado.
  const entityRequest = useAppStore((s) => s.entityRequest);
  const consumeEntityRequest = useAppStore((s) => s.consumeEntityRequest);
  const detailId =
    entityRequest?.kind === "surgery" ? entityRequest.id : localDetailId;
  const closeDetail = () => {
    setLocalDetailId(null);
    if (entityRequest?.kind === "surgery") consumeEntityRequest();
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { TOTAL: 0 };
    for (const s of all ?? []) {
      c.TOTAL += 1;
      c[s.status] = (c[s.status] ?? 0) + 1;
    }
    return c;
  }, [all]);

  const changeStatus = async (id: number | string, next: string, label: string) => {
    try {
      await updateSurgery.mutateAsync({ id: String(id), status: next });
      toast.success(`Cirugía ${label.toLowerCase()}`);
    } catch (e) {
      toast.error("No se pudo actualizar el estado", {
        description: getErrorMessage(e),
      });
    }
  };

  const rows = surgeries ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Scissors className="text-primary size-5" aria-hidden="true" />
            Cirugías
          </h2>
          <p className="text-muted-foreground text-sm">
            Agenda quirúrgica ortopédica: procedimientos, implantes y
            postoperatorio.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Programar cirugía
        </Button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div
          className="bg-card flex flex-wrap gap-1 rounded-lg border p-1"
          role="tablist"
          aria-label="Filtrar por estado"
        >
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value ?? "all"}
              type="button"
              role="tab"
              aria-selected={status === tab.value}
              onClick={() => setStatus(tab.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                status === tab.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {tab.label}
              <span className="ml-1.5 text-xs opacity-80 tabular-nums">
                {tab.value ? (counts[tab.value] ?? 0) : (counts.TOTAL ?? 0)}
              </span>
            </button>
          ))}
        </div>

        <div className="relative lg:ml-auto lg:w-72">
          <Search
            className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar paciente, dueño o procedimiento…"
            className="pl-9"
            aria-label="Buscar cirugías"
          />
        </div>
      </div>

      <Card className="gap-0 p-0">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bone className="text-primary size-4" aria-hidden="true" />
            Agenda quirúrgica
          </CardTitle>
          <CardDescription>
            {isLoading
              ? "Cargando…"
              : `${rows.length} cirugía${rows.length === 1 ? "" : "s"}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Paciente</TableHead>
                  <TableHead>Procedimiento</TableHead>
                  <TableHead>Fecha programada</TableHead>
                  <TableHead className="hidden md:table-cell">Veterinario</TableHead>
                  <TableHead className="hidden xl:table-cell">Implantes</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7} className="h-12">
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}

                {!isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-muted-foreground h-24 text-center"
                    >
                      {search || status
                        ? "Ninguna cirugía coincide con los filtros."
                        : 'Sin cirugías. Usa "Programar cirugía".'}
                    </TableCell>
                  </TableRow>
                )}

                {rows.map((s) => {
                  const busy = updateSurgery.isPending;
                  return (
                    <TableRow
                      key={s.id}
                      data-surgery-id={s.id}
                      className="group transition-colors"
                    >
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => setLocalDetailId(s.id)}
                          className="text-left"
                        >
                          <span className="group-hover:text-primary font-medium transition-colors">
                            {s.patient?.name}
                          </span>
                          <span className="text-muted-foreground block text-xs">
                            {s.patient?.species} ·{" "}
                            {s.patient?.owner?.fullName ?? ""}
                          </span>
                        </button>
                      </TableCell>
                      <TableCell className="max-w-52">
                        <span className="block truncate text-sm font-medium">
                          {s.procedureType}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {s.bodyRegion ?? "—"}
                          {s.laterality ? ` · ${s.laterality}` : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDateTime(s.scheduledAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden text-xs md:table-cell">
                        {s.vet ? shortName(s.vet.fullName) : "Sin asignar"}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {s.materialsCount && s.materialsCount > 0 ? (
                          <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                            <Package className="size-3.5" aria-hidden="true" />
                            {s.materialsCount} materiales
                            {s.materialsCost ? (
                              <span className="text-foreground font-medium">
                                · {formatCOP(s.materialsCost)}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <SurgeryStatusBadge status={s.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setLocalDetailId(s.id)}
                          >
                            Detalle
                          </Button>
                          {s.status === "PROGRAMADA" && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                changeStatus(s.id, "EN_CURSO", "En curso")
                              }
                            >
                              <PlayCircle className="size-3.5" />
                              Iniciar
                            </Button>
                          )}
                          {s.status === "EN_CURSO" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-emerald-700 hover:text-emerald-700 dark:text-emerald-400"
                              disabled={busy}
                              onClick={() =>
                                changeStatus(s.id, "COMPLETADA", "Completada")
                              }
                            >
                              <CheckCircle2 className="size-3.5" />
                              Completar
                            </Button>
                          )}
                          {(s.status === "PROGRAMADA" ||
                            s.status === "EN_CURSO") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={busy}
                              onClick={() =>
                                changeStatus(s.id, "CANCELADA", "Cancelada")
                              }
                            >
                              <Ban className="size-3.5" />
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <SurgeryFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <SurgeryDetailDialog
        surgeryId={detailId}
        onClose={closeDetail}
      />
    </div>
  );
}
