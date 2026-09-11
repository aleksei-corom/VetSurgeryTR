"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, PawPrint } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  useCreatePatient,
  useOwners,
  getErrorMessage,
} from "@/hooks/use-queries";
import {
  DOCUMENT_TYPES,
  SPECIES_OPTIONS,
} from "@/lib/api-types";

const ownerSchema = z.object({
  documentType: z.string().min(1, "Tipo de documento"),
  documentNumber: z.string().min(3, "Número requerido"),
  fullName: z.string().min(3, "Nombre del propietario"),
  phone: z.string().optional(),
  email: z.string().email("Correo inválido").optional().or(z.literal("")),
  city: z.string().optional(),
});

const patientSchema = z.object({
  owner: ownerSchema,
  name: z.string().min(2, "Nombre del paciente"),
  species: z.string().min(1, "Selecciona la especie"),
  breed: z.string().optional(),
  sex: z.enum(["M", "F"]),
  birthDate: z.string().optional(),
  weight: z.coerce.number().positive("Peso > 0").optional(),
  neutered: z.boolean().default(false),
  color: z.string().optional(),
  microchip: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.input<typeof patientSchema>;
type Values = z.output<typeof patientSchema>;

export function PatientFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createPatient = useCreatePatient();
  const [docSearch, setDocSearch] = useState("");

  const form = useForm<FormValues, unknown, Values>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      owner: {
        documentType: "CC",
        documentNumber: "",
        fullName: "",
        phone: "",
        email: "",
        city: "",
      },
      name: "",
      species: "Canino",
      breed: "",
      sex: "M",
      birthDate: "",
      weight: undefined,
      neutered: false,
      color: "",
      microchip: "",
      notes: "",
    },
  });

  // Autocompletar propietario si ya existe el documento
  const { data: existingOwners } = useOwners(docSearch.length >= 4 ? docSearch : undefined);
  const docNumber = form.watch("owner.documentNumber");
  const docType = form.watch("owner.documentType");

  const matchedOwner = (existingOwners ?? []).find(
    (o) =>
      o.documentNumber === docNumber.trim() && o.documentType === docType,
  );

  const onFillOwner = () => {
    if (!matchedOwner) return;
    form.setValue("owner.fullName", matchedOwner.fullName);
    form.setValue("owner.phone", matchedOwner.phone ?? "");
    form.setValue("owner.city", matchedOwner.city ?? "");
    toast.info("Propietario encontrado", {
      description: `Se completaron los datos de ${matchedOwner.fullName}.`,
    });
  };

  const onSubmit = async (values: Values) => {
    try {
      const patient = await createPatient.mutateAsync({
        owner: {
          documentType: values.owner.documentType,
          documentNumber: values.owner.documentNumber.trim(),
          fullName: values.owner.fullName.trim(),
          phone: values.owner.phone?.trim() || undefined,
          email: values.owner.email?.trim() || undefined,
          city: values.owner.city?.trim() || undefined,
        },
        name: values.name.trim(),
        species: values.species,
        breed: values.breed?.trim() || undefined,
        sex: values.sex,
        birthDate: values.birthDate || undefined,
        weight: values.weight ?? undefined,
        neutered: values.neutered,
        color: values.color?.trim() || undefined,
        microchip: values.microchip?.trim() || undefined,
        notes: values.notes?.trim() || undefined,
      });
      toast.success("Paciente creado", {
        description: `${patient.name} · ${patient.code}`,
        icon: <PawPrint className="size-4" />,
      });
      onOpenChange(false);
      form.reset();
      setDocSearch("");
    } catch (e) {
      toast.error("No se pudo crear el paciente", {
        description: getErrorMessage(e),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuevo paciente</DialogTitle>
          <DialogDescription>
            Registra al propietario y la ficha clínica del paciente. El código
            se asigna automáticamente.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <section aria-label="Datos del propietario" className="space-y-3">
              <h4 className="text-sm font-semibold">Propietario</h4>
              <div className="grid gap-3 sm:grid-cols-[130px_1fr]">
                <FormField
                  control={form.control}
                  name="owner.documentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Doc.</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DOCUMENT_TYPES.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
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
                  name="owner.documentNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de documento</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input
                            placeholder="1020304050"
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              setDocSearch(e.target.value);
                            }}
                          />
                        </FormControl>
                        {matchedOwner && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onFillOwner}
                          >
                            Autocompletar
                          </Button>
                        )}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="owner.fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre completo</FormLabel>
                      <FormControl>
                        <Input placeholder="María Fernanda Gómez" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="owner.phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono / WhatsApp</FormLabel>
                      <FormControl>
                        <Input placeholder="+57 300 123 4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="owner.city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ciudad</FormLabel>
                      <FormControl>
                        <Input placeholder="Bogotá" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="owner.email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo (opcional)</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="correo@ejemplo.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <Separator />

            <section aria-label="Datos del paciente" className="space-y-3">
              <h4 className="text-sm font-semibold">Paciente</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del paciente *</FormLabel>
                      <FormControl>
                        <Input placeholder="Rocco" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="species"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Especie *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SPECIES_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
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
                  name="breed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Raza</FormLabel>
                      <FormControl>
                        <Input placeholder="Labrador Retriever" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sex"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sexo *</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="flex gap-4 pt-2"
                        >
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="M" id="sex-m" />
                            <label htmlFor="sex-m" className="cursor-pointer text-sm">
                              Macho
                            </label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="F" id="sex-f" />
                            <label htmlFor="sex-f" className="cursor-pointer text-sm">
                              Hembra
                            </label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="birthDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de nacimiento</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Peso (kg) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          min="0.1"
                          placeholder="34"
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
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                        <Input placeholder="Dorado" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <FormField
                  control={form.control}
                  name="microchip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Microchip</FormLabel>
                      <FormControl>
                        <Input placeholder="985141002341234" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="neutered"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-3 pt-1 sm:pt-6">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          aria-label="Esterilizado"
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Esterilizado</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas clínicas</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Antecedentes ortopédicos, alergias, medicación actual…"
                        className="min-h-20"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createPatient.isPending}>
                {createPatient.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Crear paciente
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
