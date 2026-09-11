"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, PawPrint, Plus, Search } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { usePatients, getErrorMessage } from "@/hooks/use-queries";
import { SPECIES_OPTIONS } from "@/lib/api-types";
import {
  ageLabel,
  formatDate,
  monthsSince,
  sexLabel,
  weightLabel,
} from "@/lib/format";
import { SexBadge } from "@/components/status-badges";
import { useAppStore } from "@/stores/app-store";
import { PatientFormDialog } from "./patient-form-dialog";
import { PatientDetailSheet } from "./patient-detail-sheet";

export function PatientsView() {
  const [search, setSearch] = useState("");
  const [species, setSpecies] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [localDetailId, setLocalDetailId] = useState<string | null>(null);

  const { data: patients, isLoading } = usePatients({
    q: search,
    species: species === "all" ? undefined : species,
    active: showInactive ? undefined : true,
  });

  // Enfoque desde otras vistas (dashboard): estado derivado sin efectos.
  const entityRequest = useAppStore((s) => s.entityRequest);
  const consumeEntityRequest = useAppStore((s) => s.consumeEntityRequest);
  const detailId =
    entityRequest?.kind === "patient" ? entityRequest.id : localDetailId;
  const closeDetail = () => {
    setLocalDetailId(null);
    if (entityRequest?.kind === "patient") consumeEntityRequest();
  };

  const rows = useMemo(() => patients ?? [], [patients]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <PawPrint className="text-primary size-5" aria-hidden="true" />
            Pacientes
          </h2>
          <p className="text-muted-foreground text-sm">
            Fichas clínicas de pacientes ortopédicos con su historia
            quirúrgica.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Nuevo paciente
        </Button>
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
            placeholder="Buscar por nombre, código, dueño…"
            className="pl-9"
            aria-label="Buscar pacientes"
          />
        </div>
        <Select value={species} onValueChange={setSpecies}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Filtrar por especie">
            <SelectValue placeholder="Especie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las especies</SelectItem>
            {SPECIES_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={showInactive ? "default" : "outline"}
          size="sm"
          onClick={() => setShowInactive((v) => !v)}
          className="sm:ml-auto"
        >
          {showInactive ? "Mostrando inactivos" : "Ver inactivos"}
        </Button>
      </div>

      <Card className="gap-0 p-0">
        <CardHeader className="border-b">
          <CardTitle className="text-base">Listado de pacientes</CardTitle>
          <CardDescription>
            {isLoading
              ? "Cargando…"
              : `${rows.length} paciente${rows.length === 1 ? "" : "s"}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Paciente</TableHead>
                  <TableHead className="hidden md:table-cell">Propietario</TableHead>
                  <TableHead className="hidden sm:table-cell">Edad</TableHead>
                  <TableHead>Peso</TableHead>
                  <TableHead className="hidden lg:table-cell">Sexo</TableHead>
                  <TableHead className="text-center">Cirugías</TableHead>
                  <TableHead className="hidden xl:table-cell">Última cirugía</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: 5 }).map((_, i) => (
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
                      {search || species !== "all"
                        ? "Ningún paciente coincide con los filtros."
                        : 'Aún no hay pacientes. Crea el primero con "Nuevo paciente".'}
                    </TableCell>
                  </TableRow>
                )}

                {rows.map((p) => (
                  <TableRow key={p.id} className="group">
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setLocalDetailId(p.id)}
                        className="text-left"
                      >
                        <span className="group-hover:text-primary font-medium transition-colors">
                          {p.name}
                        </span>
                        <span className="text-muted-foreground block text-xs">
                          {p.code} · {p.species}
                          {p.breed ? ` · ${p.breed}` : ""}
                          {!p.active && " · inactivo"}
                        </span>
                      </button>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm">{p.ownerName ?? p.owner?.fullName}</span>
                      <span className="text-muted-foreground block text-xs">
                        {p.ownerPhone ?? p.owner?.phone ?? "Sin teléfono"}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-sm sm:table-cell">
                      {ageLabel(p.ageMonths ?? monthsSince(p.birthDate))}
                    </TableCell>
                    <TableCell className="text-sm font-medium tabular-nums">
                      {weightLabel(p.weight)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <SexBadge sex={p.sex} />
                    </TableCell>
                    <TableCell className="text-center text-sm tabular-nums">
                      {p.surgeryCount ?? 0}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-xs xl:table-cell">
                      {p.lastSurgeryAt ? formatDate(p.lastSurgeryAt) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setLocalDetailId(p.id)}
                      >
                        Ver ficha
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <PatientFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <PatientDetailSheet
        patientId={detailId}
        onClose={closeDetail}
      />
    </div>
  );
}
