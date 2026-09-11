"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, Loader2, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCreateMovement,
  useInventory,
  useInventoryItem,
  getErrorMessage,
} from "@/hooks/use-queries";
import { MOVEMENT_TYPES } from "@/lib/api-types";
import { formatCOP } from "@/lib/format";
import { cn } from "@/lib/utils";

const schema = z.object({
  itemId: z.string().min(1, "Selecciona el material"),
  type: z.enum(["ENTRADA", "SALIDA", "AJUSTE"]),
  qty: z.coerce.number().positive("Cantidad > 0"),
  unitCost: z.coerce.number().min(0).optional(),
  reason: z.string().optional(),
});

type FormValues = z.input<typeof schema>;
type Values = z.output<typeof schema>;

const TYPE_META: Record<
  string,
  { label: string; hint: string; icon: typeof ArrowUpRight }
> = {
  ENTRADA: {
    label: "Entrada",
    hint: "Suma la cantidad al stock actual",
    icon: ArrowUpRight,
  },
  SALIDA: {
    label: "Salida",
    hint: "Resta la cantidad al stock actual",
    icon: ArrowDownRight,
  },
  AJUSTE: {
    label: "Ajuste",
    hint: "Fija el stock al valor contado físicamente",
    icon: Scale,
  },
};

export function MovementDialog({
  open,
  itemId,
  onClose,
}: {
  open: boolean;
  itemId: string | null;
  onClose: () => void;
}) {
  const createMovement = useCreateMovement();
  const { data: items } = useInventory({});
  const { data: detail, isLoading: loadingItem } = useInventoryItem(
    open ? itemId : null,
  );

  const item = detail?.item;
  const fixedItem = !!itemId;
  const selectedItemFromList = (items ?? []).find((i) => i.id === itemId);
  const headerItem = item ?? selectedItemFromList;

  const form = useForm<FormValues, unknown, Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      itemId: itemId ?? "",
      type: "ENTRADA",
      qty: 1,
      unitCost: undefined,
      reason: "",
    },
  });

  useEffect(() => {
    if (open) form.reset({ itemId: itemId ?? "", type: "ENTRADA", qty: 1, reason: "" });
  }, [open, itemId, form]);

  useEffect(() => {
    if (item?.unitCost) form.setValue("unitCost", item.unitCost);
  }, [item?.unitCost, form]);

  const watchedType = form.watch("type") as string;
  const watchedQty = Number(form.watch("qty")) || 0;
  const watchedItemId = form.watch("itemId") as string;
  const selectedItem =
    (items ?? []).find((i) => i.id === watchedItemId) ?? item;

  const projected =
    selectedItem && watchedQty > 0
      ? watchedType === "ENTRADA"
        ? selectedItem.stockQty + watchedQty
        : watchedType === "SALIDA"
          ? selectedItem.stockQty - watchedQty
          : watchedQty
      : null;

  const onSubmit = async (values: Values) => {
    try {
      const result = await createMovement.mutateAsync({
        itemId: values.itemId,
        type: values.type,
        qty: values.qty,
        unitCost: values.unitCost ?? undefined,
        reason: values.reason?.trim() || undefined,
      });
      toast.success(
        `${TYPE_META[values.type].label} registrada`,
        {
          description: `${result.item.name}: quedan ${result.item.stockQty} ${result.item.unit} en stock.`,
        },
      );
      onClose();
      form.reset({ itemId: itemId ?? "", type: "ENTRADA", qty: 1 });
    } catch (e) {
      toast.error("No se pudo registrar el movimiento", {
        description: getErrorMessage(e),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageIcon />
            Movimiento de inventario
          </DialogTitle>
          <DialogDescription>
            {headerItem
              ? `${headerItem.name} — stock actual: ${headerItem.stockQty} ${headerItem.unit}`
              : "Registra entradas, salidas o ajustes de existencias."}
          </DialogDescription>
        </DialogHeader>

        {fixedItem && loadingItem && <Skeleton className="h-8 w-full" />}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {!fixedItem && (
              <FormField
                control={form.control}
                name="itemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Material *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecciona…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(items ?? []).map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.name} ({i.stockQty} {i.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de movimiento *</FormLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {MOVEMENT_TYPES.map((t) => {
                      const meta = TYPE_META[t];
                      const active = field.value === t;
                      const Icon = meta.icon;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => field.onChange(t)}
                          className={cn(
                            "flex flex-col items-center gap-1 rounded-lg border p-3 text-xs font-medium transition-colors",
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-accent",
                          )}
                          aria-pressed={active}
                        >
                          <Icon className="size-4" aria-hidden="true" />
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {TYPE_META[field.value].hint}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="qty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {form.watch("type") === "AJUSTE"
                        ? "Stock contado *"
                        : "Cantidad *"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0.1}
                        step="any"
                        {...field}
                        value={(field.value as string | number | undefined) ?? ""}
                      />
                    </FormControl>
                    {projected != null && selectedItem && (
                      <p className="text-xs">
                        Stock resultante:{" "}
                        <span
                          className={cn(
                            "font-semibold tabular-nums",
                            projected < 0
                              ? "text-destructive"
                              : projected <= selectedItem.minStock
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-emerald-600 dark:text-emerald-400",
                          )}
                        >
                          {projected} {selectedItem.unit}
                        </span>
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unitCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Costo unitario (COP)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        placeholder="95000"
                        {...field}
                        value={(field.value as string | number | undefined) ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Compra a proveedor, consumo en consulta, inventario físico…"
                      className="min-h-16"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedItem?.unitCost ? (
              <p className="text-muted-foreground text-xs">
                Costo de referencia actual: {formatCOP(selectedItem.unitCost)}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createMovement.isPending}>
                {createMovement.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Registrar movimiento
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function PackageIcon() {
  return <Scale className="text-primary size-4" aria-hidden="true" />;
}
