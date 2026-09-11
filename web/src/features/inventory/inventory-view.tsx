"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bone,
  Package,
  PackagePlus,
  Plus,
  Search,
  SlidersHorizontal,
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
import { useInventory } from "@/hooks/use-queries";
import {
  INVENTORY_CATEGORIES,
  INVENTORY_CATEGORY_META,
} from "@/lib/api-types";
import { formatCOP, formatDate } from "@/lib/format";
import { CategoryBadge, StockBadge } from "@/components/status-badges";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { ItemFormDialog } from "./item-form-dialog";
import { MovementDialog } from "./movement-dialog";
import { ItemDetailDialog } from "./item-detail-dialog";

export function InventoryView() {
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [localMovementTarget, setLocalMovementTarget] = useState<
    string | "new" | null
  >(null);
  const [localDetailId, setLocalDetailId] = useState<string | null>(null);

  const { data: items, isLoading } = useInventory({
    q: search,
    category: category === "all" ? undefined : category,
    lowStock: lowOnly,
  });
  const { data: allItems } = useInventory({});

  // Enfoque desde otras vistas (dashboard / detalle de cirugía): estado derivado.
  const entityRequest = useAppStore((s) => s.entityRequest);
  const consumeEntityRequest = useAppStore((s) => s.consumeEntityRequest);
  const detailId =
    entityRequest?.kind === "inventory" ? entityRequest.id : localDetailId;
  const movementId =
    localMovementTarget === "new" ? null : localMovementTarget;
  const movementOpen = localMovementTarget !== null;
  const closeDetail = () => {
    setLocalDetailId(null);
    if (entityRequest?.kind === "inventory") consumeEntityRequest();
  };
  const closeMovement = () => setLocalMovementTarget(null);

  const catCounts = useMemo(() => {
    const c: Record<string, number> = {};
    let total = 0;
    for (const i of allItems ?? []) {
      total += 1;
      c[i.category] = (c[i.category] ?? 0) + 1;
    }
    c.all = total;
    return c;
  }, [allItems]);

  const rows = items ?? [];
  const totalValue = rows.reduce(
    (acc, i) => acc + (i.unitCost ?? 0) * i.stockQty,
    0,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Package className="text-primary size-5" aria-hidden="true" />
            Inventario ortopédico
          </h2>
          <p className="text-muted-foreground text-sm">
            Platinas, tornillos, clavos, fijadores e insumos con existencias en
            tiempo real.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setLocalMovementTarget("new")}>
            <ArrowUpRight className="size-4" aria-hidden="true" />
            Registrar movimiento
          </Button>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Nuevo material
          </Button>
        </div>
      </div>

      {/* Categorías */}
      <div className="bg-card flex flex-wrap gap-1 rounded-lg border p-1" role="tablist" aria-label="Filtrar por categoría">
        <button
          type="button"
          role="tab"
          aria-selected={category === "all"}
          onClick={() => setCategory("all")}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            category === "all"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          Todas
          <span className="ml-1.5 text-xs tabular-nums opacity-80">
            {catCounts.all ?? 0}
          </span>
        </button>
        {INVENTORY_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={category === c}
            onClick={() => setCategory(c)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              category === c
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {INVENTORY_CATEGORY_META[c].label}
            <span className="ml-1.5 text-xs tabular-nums opacity-80">
              {catCounts[c] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search
            className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, código, tamaño…"
            className="pl-9"
            aria-label="Buscar en inventario"
          />
        </div>
        <Button
          variant={lowOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setLowOnly((v) => !v)}
        >
          <AlertTriangle className="size-4" aria-hidden="true" />
          {lowOnly ? "Solo alertas" : "Ver alertas de stock"}
        </Button>
        <p className="text-muted-foreground sm:ml-auto sm:text-right text-xs">
          {rows.length} referencia{rows.length === 1 ? "" : "s"} ·{" "}
          <span className="font-medium text-foreground">
            {formatCOP(totalValue)}
          </span>{" "}
          en existencias
        </p>
      </div>

      <Card className="gap-0 p-0">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bone className="text-primary size-4" aria-hidden="true" />
            Existencias
          </CardTitle>
          <CardDescription>
            {isLoading ? "Cargando…" : `${rows.length} material${rows.length === 1 ? "" : "es"}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Material</TableHead>
                  <TableHead className="hidden md:table-cell">Categoría</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead className="hidden sm:table-cell text-center">Mínimo</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Costo unit.</TableHead>
                  <TableHead className="hidden xl:table-cell">Lote / Vence</TableHead>
                  <TableHead className="hidden xl:table-cell">Ubicación</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8} className="h-12">
                        <Skeleton className="h-8 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}

                {!isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-muted-foreground h-24 text-center"
                    >
                      {search || category !== "all" || lowOnly
                        ? "Ningún material coincide con los filtros."
                        : 'El inventario está vacío. Crea el primer material con "Nuevo material".'}
                    </TableCell>
                  </TableRow>
                )}

                {rows.map((item) => (
                  <TableRow key={item.id} className="group">
                    <TableCell className="max-w-56">
                      <button
                        type="button"
                        onClick={() => setLocalDetailId(item.id)}
                        className="text-left"
                      >
                        <span className="group-hover:text-primary text-sm font-medium transition-colors">
                          {item.name}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {item.code}
                          {item.size ? ` · ${item.size}` : ""}
                          {item.material ? ` · ${item.material}` : ""}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <CategoryBadge category={item.category} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-sm font-semibold tabular-nums">
                          {item.stockQty % 1 === 0
                            ? item.stockQty
                            : item.stockQty.toFixed(1)}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {item.unit}
                        </span>
                        <StockBadge item={item} />
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-center text-sm tabular-nums sm:table-cell">
                      {item.minStock}
                    </TableCell>
                    <TableCell className="hidden text-right text-sm tabular-nums lg:table-cell">
                      {formatCOP(item.unitCost)}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-xs xl:table-cell">
                      {item.lotNumber ?? "—"}
                      {item.expiresAt ? ` · ${formatDate(item.expiresAt)}` : ""}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-xs xl:table-cell">
                      {item.location ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocalMovementTarget(item.id)}
                        >
                          <SlidersHorizontal className="size-3.5" />
                          Movimiento
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLocalDetailId(item.id)}
                        >
                          Detalle
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ItemFormDialog open={formOpen} onOpenChange={setFormOpen} />
      <MovementDialog
        open={movementOpen}
        itemId={movementId}
        onClose={closeMovement}
      />
      <ItemDetailDialog
        itemId={detailId}
        onClose={closeDetail}
        onMovement={(id) => {
          setLocalDetailId(null);
          setLocalMovementTarget(id);
        }}
      />
    </div>
  );
}
