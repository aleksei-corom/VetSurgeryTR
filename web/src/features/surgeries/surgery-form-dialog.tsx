"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Scissors, Search } from "lucide-react";
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
  useCreateSurgery,
  usePatients,
  useVets,
  getErrorMessage,
} from "@/hooks/use-queries";
import {
  ANESTHESIA_TYPES,
  LATERALITIES,
  PROCEDURE_TYPES,
} from "@/lib/api-types";
import { toDatetimeLocal } from "@/lib/format";

const schema = z.object({
  patientId: z.string().min(1, "Selecciona el paciente"),
  vetId: z.string().optional(),
  procedureType: z.string().min(3, "Describe el procedimiento"),
  bodyRegion: z.string().optional(),
  laterality: z.string().optional(),
  description: z.string().optional(),
  scheduledAt: z.string().min(1, "Fecha y hora requeridas"),
  durationMin: z.coerce.number().int().min(15).max(600).optional(),
  anesthesiaType: z.string().optional(),
  asaRisk: z.coerce.number().int().min(1).max(5).optional(),
  estimatedCost: z.coerce.number().min(0).optional(),
  preoperativeNotes: z.string().optional(),
  postoperativeNotes: z.string().optional(),
});

type FormValues = z.input<typeof schema>;
type Values = z.output<typeof schema>;

export function SurgeryFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createSurgery = useCreateSurgery();
  const [search, setSearch] = useState("");

  const { data: patients, isLoading: loadingPatients } = usePatients({
    q: search,
    active: true,
  });
  const { data: vets } = useVets();

  const form = useForm<FormValues, unknown, Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      patientId: "",
      vetId: "",
      procedureType: "",
      bodyRegion: "",
      laterality: "",
      description: "",
      scheduledAt: toDatetimeLocal(
        (() => {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          d.setHours(8, 0, 0, 0);
          return d;
        })(),
      ),
      durationMin: 120,
      anesthesiaType: "",
      asaRisk: undefined,
      estimatedCost: undefined,
      preoperativeNotes: "",
      postoperativeNotes: "",
    },
  });

  const onSubmit = async (values: Values) => {
    try {
      const surgery = await createSurgery.mutateAsync({
        patientId: values.patientId,
        vetId: values.vetId || undefined,
        procedureType: values.procedureType.trim(),
        bodyRegion: values.bodyRegion?.trim() || undefined,
        laterality: values.laterality || undefined,
        description: values.description?.trim() || undefined,
        scheduledAt: new Date(values.scheduledAt).toISOString(),
        durationMin: values.durationMin ?? undefined,
        anesthesiaType: values.anesthesiaType || undefined,
        asaRisk: values.asaRisk ?? undefined,
        estimatedCost: values.estimatedCost ?? undefined,
        preoperativeNotes: values.preoperativeNotes?.trim() || undefined,
        postoperativeNotes: values.postoperativeNotes?.trim() || undefined,
      });
      toast.success("Cirugía programada", {
        description: `${surgery.code} · ${surgery.procedureType}`,
        icon: <Scissors className="size-4" />,
      });
      onOpenChange(false);
      form.reset();
      setSearch("");
    } catch (e) {
      toast.error("No se pudo programar la cirugía", {
        description: getErrorMessage(e),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Programar cirugía</DialogTitle>
          <DialogDescription>
            Programa la intervención ortopédica. Los implantes se asignan desde
            el detalle de la cirugía.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="patientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Paciente *</FormLabel>
                    <div className="relative">
                      <Search
                        className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
                        aria-hidden="true"
                      />
                      <Input
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          field.onChange("");
                        }}
                        placeholder="Buscar paciente…"
                        className="pl-9"
                      />
                    </div>
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
                        {(patients ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} · {p.species} ·{" "}
                            {p.ownerName ?? p.owner?.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {loadingPatients && (
                      <Skeleton className="h-4 w-24" aria-hidden="true" />
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vetId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Veterinario responsable</FormLabel>
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
                        {(vets ?? []).map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="procedureType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Procedimiento ortopédico *</FormLabel>
                  <FormControl>
                    <Input
                      list="procedure-types"
                      placeholder="TPLO, reparación de fractura, artrodesis…"
                      {...field}
                    />
                  </FormControl>
                  <datalist id="procedure-types">
                    {PROCEDURE_TYPES.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="bodyRegion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Región anatómica</FormLabel>
                    <FormControl>
                      <Input placeholder="Tibia proximal, fémur distal…" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="laterality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lateralidad</FormLabel>
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
                        {LATERALITIES.map((l) => (
                          <SelectItem key={l} value={l}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Diagnóstico / descripción</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Fractura conminuta grado II, ruptura de LCC…"
                      className="min-h-20"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="scheduledAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha y hora *</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="durationMin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duración (min)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={15}
                        max={600}
                        step="any"
                        {...field}
                        value={(field.value as string | number | undefined) ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="asaRisk"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Riesgo ASA</FormLabel>
                    <Select
                      value={field.value?.toString()}
                      onValueChange={(v) =>
                        field.onChange(v ? Number(v) : undefined)
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="I–V" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((a) => (
                          <SelectItem key={a} value={String(a)}>
                            ASA {["I", "II", "III", "IV", "V"][a - 1]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="anesthesiaType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Anestesia</FormLabel>
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
                        {ANESTHESIA_TYPES.map((a) => (
                          <SelectItem key={a} value={a}>
                            {a}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estimatedCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Costo estimado (COP)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        placeholder="3500000"
                        {...field}
                        value={(field.value as string | number | undefined) ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="preoperativeNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas preoperatorias</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ayuno 8h, radiografías ortostáticas, perfil preanestésico…"
                        className="min-h-20"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="postoperativeNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Protocolo postoperatorio</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Analgesia multimodal, reposo 30 días, curación cada 3 días…"
                        className="min-h-20"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createSurgery.isPending}>
                {createSurgery.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Programar cirugía
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
