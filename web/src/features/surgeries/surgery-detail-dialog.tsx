"use client";

import { useState } from "react";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Ban,
  Bone,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Package,
  PackagePlus,
  Pencil,
  PlayCircle,
  Plus,
  Scissors,
  Stethoscope,
  Trash2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  useInventory,
  useSurgery,
  useUpdateSurgery,
  useUpsertSurgeryMaterial,
  useDeleteSurgeryMaterial,
  useCreateFollowUp,
  useUpdateFollowUp,
  getErrorMessage,
} from "@/hooks/use-queries";
import {
  FOLLOW_UP_TYPES,
  FOLLOW_UP_TYPE_LABEL,
} from "@/lib/api-types";
import {
  formatCOP,
  formatDateTime,
  toDatetimeLocal,
  weightLabel,
} from "@/lib/format";
import {
  FollowUpStatusBadge,
  SurgeryStatusBadge,
} from "@/components/status-badges";
import { useAppStore } from "@/stores/app-store";

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

export function SurgeryDetailDialog({
  surgeryId,
  onClose,
}: {
  surgeryId: string | null;
  onClose: () => void;
}) {
  const { data: surgery, isLoading } = useSurgery(surgeryId);
  const { data: inventory } = useInventory({});
  const updateSurgery = useUpdateSurgery();
  const upsertMaterial = useUpsertSurgeryMaterial();
  const deleteMaterial = useDeleteSurgeryMaterial();
  const createFollowUp = useCreateFollowUp();
  const updateFollowUp = useUpdateFollowUp();
  const focusEntity = useAppStore((s) => s.focusEntity);

  // Formularios embebidos
  const [matItemId, setMatItemId] = useState("");
  const [matQty, setMatQty] = useState("1");
  const [fuType, setFuType] = useState<string>("CONTROL_RADIOGRAFICO");
  const [fuDate, setFuDate] = useState(
    toDatetimeLocal(addDays(new Date(), 7)),
  );
  const [fuNotes, setFuNotes] = useState("");

  if (!surgeryId) return null;

  const s = surgery;
  const editable = s?.status === "PROGRAMADA" || s?.status === "EN_CURSO";
  const materialsCost =
    s?.materials?.reduce(
      (acc, m) => acc + (m.qtyUsed ?? 0) * (m.unitCost ?? 0),
      0,
    ) ?? 0;

  const changeStatus = async (next: string, label: string) => {
    if (!s) return;
    try {
      await updateSurgery.mutateAsync({ id: s.id, status: next });
      toast.success(`Cirugía ${label.toLowerCase()}`, {
        description:
          next === "COMPLETADA"
            ? "El inventario se descontó según los materiales usados."
            : undefined,
      });
    } catch (e) {
      toast.error("No se pudo actualizar el estado", {
        description: getErrorMessage(e),
      });
    }
  };

  const addMaterial = async () => {
    if (!s || !matItemId || Number(matQty) <= 0) {
      toast.error("Selecciona un material y una cantidad válida");
      return;
    }
    try {
      await upsertMaterial.mutateAsync({
        surgeryId: s.id,
        itemId: matItemId,
        qtyPlanned: Number(matQty),
      });
      toast.success("Material asignado a la cirugía");
      setMatItemId("");
      setMatQty("1");
    } catch (e) {
      toast.error("No se pudo asignar el material", {
        description: getErrorMessage(e),
      });
    }
  };

  const removeMaterial = async (materialId: string) => {
    if (!s) return;
    try {
      await deleteMaterial.mutateAsync({
        surgeryId: s.id,
        materialId,
      });
      toast.success("Material retirado de la cirugía");
    } catch (e) {
      toast.error("No se pudo retirar el material", {
        description: getErrorMessage(e),
      });
    }
  };

  /** Registra la cantidad realmente usada de un material (se descuenta al completar). */
  const saveQtyUsed = async (
    itemId: string,
    qtyPlanned: number,
    raw: string,
  ) => {
    if (!s) return;
    const parsed = Number(raw);
    const qtyUsed = raw.trim() !== "" && !Number.isNaN(parsed) && parsed >= 0 ? parsed : undefined;
    try {
      await upsertMaterial.mutateAsync({
        surgeryId: s.id,
        itemId,
        qtyPlanned,
        qtyUsed,
      });
      toast.success("Cantidad usada registrada");
    } catch (e) {
      toast.error("No se pudo registrar la cantidad", {
        description: getErrorMessage(e),
      });
    }
  };

  const addFollowUp = async () => {
    if (!s || !fuDate) {
      toast.error("Indica la fecha del control");
      return;
    }
    try {
      await createFollowUp.mutateAsync({
        surgeryId: s.id,
        scheduledDate: new Date(fuDate).toISOString(),
        type: fuType,
        notes: fuNotes.trim() || undefined,
      });
      toast.success("Control postoperatorio agendado");
      setFuNotes("");
      setFuDate(toDatetimeLocal(addDays(new Date(), 7)));
    } catch (e) {
      toast.error("No se pudo agendar el control", {
        description: getErrorMessage(e),
      });
    }
  };

  const markFollowUp = async (
    followUpId: string,
    status: "CUMPLIDO" | "PERDIDO",
  ) => {
    if (!s) return;
    try {
      await updateFollowUp.mutateAsync({
        surgeryId: s.id,
        followUpId,
        status,
      });
      toast.success(
        status === "CUMPLIDO" ? "Control marcado como cumplido" : "Control marcado como perdido",
      );
    } catch (e) {
      toast.error("No se pudo actualizar el control", {
        description: getErrorMessage(e),
      });
    }
  };

  return (
    <Dialog open={!!surgeryId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        {/* Encabezado */}
        <DialogHeader className="bg-primary/5 shrink-0 border-b p-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="bg-primary text-primary-foreground flex size-11 shrink-0 items-center justify-center rounded-xl">
                <Scissors className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="truncate text-lg">
                  {s ? s.procedureType : "Cargando…"}
                </DialogTitle>
                <DialogDescription>
                  {s
                    ? `${s.code} · ${format(new Date(s.scheduledAt), "EEEE dd 'de' MMMM · HH:mm", { locale: es })}`
                    : "Cargando detalle de la cirugía…"}
                </DialogDescription>
              </div>
            </div>
            {s && <SurgeryStatusBadge status={s.status} />}
          </div>
          {s && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="secondary" className="font-normal">
                <Pencil className="size-3" /> {s.bodyRegion ?? "Región no especificada"}
                {s.laterality ? ` · ${s.laterality.toLowerCase()}` : ""}
              </Badge>
              {s.anesthesiaType && (
                <Badge variant="outline" className="font-normal">
                  {s.anesthesiaType}
                </Badge>
              )}
              {s.asaRisk && (
                <Badge variant="outline" className="font-normal">
                  ASA {["I", "II", "III", "IV", "V"][s.asaRisk - 1]}
                </Badge>
              )}
              {s.durationMin && (
                <Badge variant="outline" className="font-normal">
                  <Clock className="size-3" /> {s.durationMin} min
                </Badge>
              )}
            </div>
          )}
        </DialogHeader>

        {/* Cuerpo con scroll */}
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}

          {s && (
            <>
              {/* Paciente y equipo */}
              <section aria-label="Paciente y equipo quirúrgico">
                <div className="bg-card grid gap-4 rounded-lg border p-4 sm:grid-cols-2">
                  <div className="space-y-3">
                    <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                      <Stethoscope className="text-primary size-3.5" aria-hidden="true" />
                      Paciente
                    </h4>
                    <dl className="space-y-2.5">
                      <button
                        type="button"
                        className="block text-left"
                        onClick={() => {
                          onClose();
                          focusEntity({ kind: "patient", id: s.patientId });
                        }}
                      >
                        <InfoRow label="Nombre" value={
                          <span className="group-hover:text-primary underline-offset-2 hover:underline">
                            {s.patient?.name} · {s.patient?.species}
                          </span>
                        } />
                      </button>
                      <InfoRow label="Propietario" value={s.patient?.owner?.fullName} />
                      <div className="flex gap-4">
                        <InfoRow label="Peso" value={weightLabel(s.patient?.weight)} />
                        <InfoRow label="Teléfono" value={
                          s.patient?.owner?.phone ? (
                            <a
                              href={`https://wa.me/${s.patient.owner.phone.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-primary text-xs underline underline-offset-2"
                            >
                              {s.patient.owner.phone}
                            </a>
                          ) : "—"
                        } />
                      </div>
                    </dl>
                  </div>
                  <div className="space-y-3 sm:border-l sm:pl-4">
                    <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                      <User className="text-primary size-3.5" aria-hidden="true" />
                      Equipo
                    </h4>
                    <dl className="space-y-2.5">
                      <InfoRow label="Cirujano" value={s.vet?.fullName ?? "Sin asignar"} />
                      <InfoRow label="Especialidad" value={s.vet?.specialty} />
                      <InfoRow label="Costo estimado" value={formatCOP(s.estimatedCost)} />
                      <InfoRow label="Costo implantes" value={formatCOP(materialsCost)} />
                    </dl>
                  </div>
                </div>
                {s.description && (
                  <p className="bg-muted/40 mt-2 rounded-lg border p-3 text-sm leading-relaxed">
                    <span className="text-muted-foreground text-xs font-medium uppercase">
                      Diagnóstico:{" "}
                    </span>
                    {s.description}
                  </p>
                )}
              </section>

              {/* Notas pre/post */}
              {(s.preoperativeNotes || s.postoperativeNotes) && (
                <section
                  aria-label="Notas operatorias"
                  className="grid gap-3 sm:grid-cols-2"
                >
                  {s.preoperativeNotes && (
                    <div className="rounded-lg border border-teal-500/20 bg-teal-500/5 p-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                        Preoperatorio
                      </h4>
                      <p className="mt-1.5 text-xs leading-relaxed whitespace-pre-line">
                        {s.preoperativeNotes}
                      </p>
                    </div>
                  )}
                  {s.postoperativeNotes && (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                        Postoperatorio
                      </h4>
                      <p className="mt-1.5 text-xs leading-relaxed whitespace-pre-line">
                        {s.postoperativeNotes}
                      </p>
                    </div>
                  )}
                </section>
              )}

              <Separator />

              {/* Materiales / implantes */}
              <section aria-label="Materiales e implantes">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Package className="text-primary size-4" aria-hidden="true" />
                  Implantes y materiales
                  <Badge variant="secondary" className="ml-auto font-normal">
                    {s.materials.length} asignado{s.materials.length === 1 ? "" : "s"}
                  </Badge>
                </h3>

                {s.materials.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-muted-foreground text-left text-[11px] uppercase">
                        <tr>
                          <th className="px-3 py-2 font-medium">Material</th>
                          <th className="px-3 py-2 text-center font-medium">
                            Plan.
                          </th>
                          <th className="px-3 py-2 text-center font-medium">
                            Usado{s.status !== "COMPLETADA" && s.status !== "CANCELADA" ? " ✎" : ""}
                          </th>
                          <th className="px-3 py-2 text-right font-medium">
                            Subtotal
                          </th>
                          {editable && <th className="w-10" />}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {s.materials.map((m) => (
                          <tr key={m.id} className="group">
                            <td className="max-w-56 px-3 py-2">
                              <button
                                type="button"
                                className="hover:text-primary truncate text-left font-medium transition-colors"
                                onClick={() => {
                                  onClose();
                                  focusEntity({ kind: "inventory", id: m.itemId });
                                }}
                                title={m.item.name}
                              >
                                {m.item.name}
                              </button>
                              <span className="text-muted-foreground block text-xs">
                                {m.item.code}
                                {m.item.size ? ` · ${m.item.size}` : ""}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center tabular-nums">
                              {m.qtyPlanned}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {editable ? (
                                <Input
                                  type="number"
                                  min={0}
                                  step={1}
                                  defaultValue={m.qtyUsed ?? ""}
                                  placeholder="—"
                                  aria-label={`Cantidad usada de ${m.item.name}`}
                                  className="h-8 w-16 text-center tabular-nums"
                                  onBlur={(e) => {
                                    if (
                                      (e.target.value ?? "") !==
                                      String(m.qtyUsed ?? "")
                                    ) {
                                      void saveQtyUsed(
                                        m.itemId,
                                        m.qtyPlanned,
                                        e.target.value,
                                      );
                                    }
                                  }}
                                />
                              ) : (
                                <span className="tabular-nums">
                                  {m.qtyUsed ?? "—"}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums">
                              {formatCOP((m.qtyUsed ?? m.qtyPlanned) * (m.unitCost ?? 0))}
                            </td>
                            {editable && (
                              <td className="px-2 py-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                                  onClick={() => removeMaterial(m.id)}
                                  aria-label={`Retirar ${m.item.name}`}
                                  disabled={deleteMaterial.isPending}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      {materialsCost > 0 && (
                        <tfoot className="bg-muted/50 border-t">
                          <tr>
                            <td colSpan={3} className="text-muted-foreground px-3 py-2 text-xs">
                              Valor de implantes consumidos
                            </td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums">
                              {formatCOP(materialsCost)}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                ) : (
                  <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
                    Aún no se han asignado implantes a esta cirugía.
                  </p>
                )}

                {editable && (
                  <div className="mt-3 flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row">
                    <div className="min-w-0 flex-1">
                      <Select value={matItemId} onValueChange={setMatItemId}>
                        <SelectTrigger className="w-full" aria-label="Seleccionar material">
                          <SelectValue placeholder="Selecciona platina, tornillo, clavo…" />
                        </SelectTrigger>
                        <SelectContent>
                          {(inventory ?? []).map((i) => (
                            <SelectItem key={i.id} value={i.id}>
                              {i.name} ({i.stockQty} {i.unit} disp.)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={matQty}
                      onChange={(e) => setMatQty(e.target.value)}
                      className="w-full sm:w-24"
                      aria-label="Cantidad"
                      placeholder="Cant."
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={addMaterial}
                      disabled={upsertMaterial.isPending}
                      className="shrink-0"
                    >
                      {upsertMaterial.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <PackagePlus className="size-4" />
                      )}
                      Asignar
                    </Button>
                  </div>
                )}
                {s.status === "COMPLETADA" && (
                  <p className="text-muted-foreground mt-2 text-xs">
                    <Bone className="mr-1 inline size-3" aria-hidden="true" />
                    Cirugía completada: el consumo ya fue descontado del
                    inventario.
                  </p>
                )}
                {(s.status === "PROGRAMADA" || s.status === "EN_CURSO") && (
                  <p className="text-muted-foreground mt-2 text-xs">
                    ✎ Registra la cantidad <strong>usada</strong> de cada material
                    antes de completar: al completar la cirugía se descuenta del
                    inventario.
                  </p>
                )}
              </section>

              <Separator />

              {/* Controles postoperatorios */}
              <section aria-label="Controles postoperatorios">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <CheckCircle2 className="text-primary size-4" aria-hidden="true" />
                  Controles postoperatorios
                </h3>

                {s.followUps.length > 0 ? (
                  <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {s.followUps.map((f) => (
                      <li
                        key={f.id}
                        className="bg-card flex flex-wrap items-center gap-2 rounded-lg border p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {FOLLOW_UP_TYPE_LABEL[f.type] ?? f.type}
                            <span className="text-muted-foreground ml-2 text-xs font-normal">
                              {formatDateTime(f.scheduledDate)}
                            </span>
                          </p>
                          {f.notes && (
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              {f.notes}
                            </p>
                          )}
                        </div>
                        <FollowUpStatusBadge status={f.status} />
                        {f.status === "PENDIENTE" && (
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => markFollowUp(f.id, "CUMPLIDO")}
                              disabled={updateFollowUp.isPending}
                              className="h-8 text-emerald-700 dark:text-emerald-400"
                            >
                              <Check className="size-3.5" />
                              Cumplido
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markFollowUp(f.id, "PERDIDO")}
                              disabled={updateFollowUp.isPending}
                              className="h-8 text-destructive"
                            >
                              Perdido
                            </Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
                    Sin controles agendados para el postoperatorio.
                  </p>
                )}

                <div className="mt-3 grid gap-2 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[1fr_auto]">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Select value={fuType} onValueChange={setFuType}>
                      <SelectTrigger className="w-full" aria-label="Tipo de control">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FOLLOW_UP_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {FOLLOW_UP_TYPE_LABEL[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="datetime-local"
                      value={fuDate}
                      onChange={(e) => setFuDate(e.target.value)}
                      aria-label="Fecha del control"
                    />
                  </div>
                  <Textarea
                    value={fuNotes}
                    onChange={(e) => setFuNotes(e.target.value)}
                    placeholder="Notas del control (opcional)…"
                    className="min-h-10 text-xs sm:col-span-1"
                    rows={1}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={addFollowUp}
                    disabled={createFollowUp.isPending}
                    className="shrink-0 sm:col-start-2 sm:row-start-1"
                  >
                    {createFollowUp.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                    Agendar control
                  </Button>
                </div>
              </section>
            </>
          )}
        </div>

        {/* Pie con acciones de estado */}
        {s && editable && (
          <div className="bg-card flex shrink-0 flex-wrap justify-end gap-2 border-t p-4">
            {s.status === "PROGRAMADA" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => changeStatus("EN_CURSO", "En curso")}
                disabled={updateSurgery.isPending}
              >
                <PlayCircle className="size-4" />
                Iniciar cirugía
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => changeStatus("COMPLETADA", "Completada")}
              disabled={updateSurgery.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {updateSurgery.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Completar y descontar inventario
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => changeStatus("CANCELADA", "Cancelada")}
              disabled={updateSurgery.isPending}
              className="text-destructive hover:text-destructive"
            >
              <Ban className="size-4" />
              Cancelar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
