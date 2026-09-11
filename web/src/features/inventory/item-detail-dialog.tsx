"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  Bone,
  Boxes,
  Building2,
  Hash,
  MapPin,
  Package,
  Scale,
  Scissors,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useInventoryItem } from "@/hooks/use-queries";
import { formatCOP, formatDate, formatDateTime } from "@/lib/format";
import { CategoryBadge, StockBadge } from "@/components/status-badges";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";

const MOVEMENT_ICON: Record<string, typeof ArrowUpRight> = {
  ENTRADA: ArrowUpRight,
  SALIDA: ArrowDownRight,
  AJUSTE: Scale,
};

const MOVEMENT_TONE: Record<string, string> = {
  ENTRADA: "text-emerald-600 dark:text-emerald-400",
  SALIDA: "text-rose-600 dark:text-rose-400",
  AJUSTE: "text-amber-600 dark:text-amber-400",
};

export function ItemDetailDialog({
  itemId,
  onClose,
  onMovement,
}: {
  itemId: string | null;
  onClose: () => void;
  onMovement: (itemId: string) => void;
}) {
  const { data, isLoading } = useInventoryItem(itemId);
  const focusEntity = useAppStore((s) => s.focusEntity);

  const item = data?.item;
  const movements = data?.movements ?? [];

  return (
    <Dialog open={!!itemId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="bg-primary/5 shrink-0 border-b p-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="bg-primary text-primary-foreground flex size-11 shrink-0 items-center justify-center rounded-xl">
                <Bone className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="truncate text-lg leading-tight">
                  {item?.name ?? "Cargando…"}
                </DialogTitle>
                <DialogDescription>
                  {item ? `${item.code} · ${item.subType ?? ""}` : "Cargando detalle del material…"}
                </DialogDescription>
              </div>
            </div>
            {item && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onMovement(item.id)}
              >
                <Package className="size-3.5" />
                Movimiento
              </Button>
            )}
          </div>
          {item && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <CategoryBadge category={item.category} />
              <StockBadge item={item} />
              <Badge variant="outline" className="gap-1 font-normal tabular-nums">
                <Boxes className="size-3" />
                {item.stockQty} {item.unit} · mín. {item.minStock}
              </Badge>
              {item.unitCost != null && (
                <Badge variant="outline" className="font-normal tabular-nums">
                  {formatCOP(item.unitCost)} / {item.unit}
                </Badge>
              )}
            </div>
          )}
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          )}

          {item && (
            <>
              <section aria-label="Ficha del material">
                <dl className="bg-card grid grid-cols-2 gap-4 rounded-lg border p-4 sm:grid-cols-4">
                  <div>
                    <dt className="text-muted-foreground text-[11px] font-medium uppercase">
                      Material
                    </dt>
                    <dd className="mt-0.5 truncate text-sm font-medium">
                      {item.material ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-[11px] font-medium uppercase">
                      Tamaño
                    </dt>
                    <dd className="mt-0.5 truncate text-sm font-medium">
                      {item.size ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-[11px] font-medium uppercase">
                      <Building2 className="mr-1 inline size-3" aria-hidden="true" />
                      Proveedor
                    </dt>
                    <dd className="mt-0.5 truncate text-sm font-medium">
                      {item.supplier ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-[11px] font-medium uppercase">
                      <MapPin className="mr-1 inline size-3" aria-hidden="true" />
                      Ubicación
                    </dt>
                    <dd className="mt-0.5 truncate text-sm font-medium">
                      {item.location ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-[11px] font-medium uppercase">
                      <Hash className="mr-1 inline size-3" aria-hidden="true" />
                      Lote
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium">
                      {item.lotNumber ?? "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-[11px] font-medium uppercase">
                      Vencimiento
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium">
                      {item.expiresAt ? formatDate(item.expiresAt) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-[11px] font-medium uppercase">
                      Valor en stock
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium tabular-nums">
                      {formatCOP(item.stockQty * (item.unitCost ?? 0))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-[11px] font-medium uppercase">
                      Estado
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium">
                      {item.active ? "Activo" : "Inactivo"}
                    </dd>
                  </div>
                </dl>
                {item.notes && (
                  <p className="bg-muted/40 mt-2 rounded-lg border p-3 text-xs leading-relaxed">
                    {item.notes}
                  </p>
                )}
              </section>

              <Separator />

              <section aria-label="Historial de movimientos">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Scale className="text-primary size-4" aria-hidden="true" />
                  Historial de movimientos
                  <Badge variant="secondary" className="ml-auto font-normal">
                    {movements.length} registro{movements.length === 1 ? "" : "s"}
                  </Badge>
                </h3>
                {movements.length === 0 ? (
                  <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
                    Sin movimientos registrados.
                  </p>
                ) : (
                  <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
                    {movements.map((m) => {
                      const Icon =
                        MOVEMENT_ICON[m.type] ?? Scale;
                      return (
                        <li
                          key={m.id}
                          className="bg-card flex items-center gap-3 rounded-lg border p-3"
                        >
                          <div
                            className={cn(
                              "flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted",
                              MOVEMENT_TONE[m.type],
                            )}
                          >
                            <Icon className="size-4" aria-hidden="true" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm">
                              <span className={cn("font-semibold", MOVEMENT_TONE[m.type])}>
                                {m.type === "ENTRADA"
                                  ? "+"
                                  : m.type === "SALIDA"
                                    ? "−"
                                    : "="}
                                {m.qty}
                              </span>{" "}
                              <span className="text-muted-foreground text-xs">
                                {m.type === "AJUSTE" ? "(conteo físico)" : item.unit}
                              </span>
                              {m.reason && (
                                <span className="text-muted-foreground block truncate text-xs">
                                  {m.reason}
                                </span>
                              )}
                              {m.surgeryCode && (
                                <button
                                  type="button"
                                  className="text-primary mt-0.5 flex items-center gap-1 text-xs underline underline-offset-2"
                                  onClick={() => {
                                    if (m.surgeryId) {
                                      onClose();
                                      focusEntity({
                                        kind: "surgery",
                                        id: m.surgeryId,
                                      });
                                    }
                                  }}
                                >
                                  <Scissors className="size-3" aria-hidden="true" />
                                  {m.surgeryCode}
                                  {m.patientName ? ` · ${m.patientName}` : ""}
                                </button>
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-muted-foreground text-[11px] tabular-nums">
                              {formatDateTime(m.createdAt)}
                            </p>
                            <p className="text-xs font-semibold tabular-nums">
                              → {m.stockAfter} {item.unit}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
