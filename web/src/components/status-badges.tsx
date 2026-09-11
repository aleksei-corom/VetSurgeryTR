"use client";

import { Badge } from "@/components/ui/badge";
import {
  INVENTORY_CATEGORY_META,
  SURGERY_STATUS_META,
  type SurgeryStatus,
  type InventoryItem,
} from "@/lib/api-types";
import { AlertTriangle, CheckCircle2, CircleDashed } from "lucide-react";

export function SurgeryStatusBadge({ status }: { status: string }) {
  const meta = SURGERY_STATUS_META[status as SurgeryStatus] ?? {
    label: status,
    badge: "secondary" as const,
  };
  return <Badge variant={meta.badge}>{meta.label}</Badge>;
}

export function SexBadge({ sex }: { sex: string }) {
  return (
    <Badge variant="outline" className="font-normal">
      {sex === "M" ? "♂ Macho" : "♀ Hembra"}
    </Badge>
  );
}

/** Semáforo de existencias: crítico / bajo / normal. */
export function StockBadge({
  item,
}: {
  item: Pick<InventoryItem, "stockQty" | "minStock" | "unit">;
}) {
  const critical = item.stockQty <= 0;
  const low = !critical && item.stockQty <= item.minStock;
  if (critical) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="size-3" /> Agotado
      </Badge>
    );
  }
  if (low) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      >
        <AlertTriangle className="size-3" /> Bajo
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-emerald-700 dark:text-emerald-400">
      <CheckCircle2 className="size-3" /> OK
    </Badge>
  );
}

export function FollowUpStatusBadge({ status }: { status: string }) {
  if (status === "CUMPLIDO") return <Badge variant="success">Cumplido</Badge>;
  if (status === "PERDIDO") return <Badge variant="destructive">Perdido</Badge>;
  return (
    <Badge variant="secondary" className="gap-1">
      <CircleDashed className="size-3" /> Pendiente
    </Badge>
  );
}

/** Chip compacto para categoría de inventario. */
export function CategoryBadge({ category }: { category: string }) {
  const meta = INVENTORY_CATEGORY_META[category];
  return (
    <Badge variant="secondary" className="font-normal">
      {meta?.label ?? category}
    </Badge>
  );
}
