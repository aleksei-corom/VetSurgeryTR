"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Bone,
  Calendar,
  Cake,
  Mail,
  MapPin,
  MessageCircle,
  Microchip,
  PawPrint,
  Phone,
  Scissors,
  User,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { usePatient } from "@/hooks/use-queries";
import {
  ageLabel,
  formatDate,
  formatDateTime,
  monthsSince,
  sexLabel,
  weightLabel,
} from "@/lib/format";
import { SurgeryStatusBadge, SexBadge } from "@/components/status-badges";
import { useAppStore } from "@/stores/app-store";

interface SurgeriesOnPatient {
  id: string;
  code: string;
  procedureType: string;
  bodyRegion: string | null;
  laterality: string | null;
  scheduledAt: string;
  status: string;
  vet?: { fullName: string } | null;
}

export function PatientDetailSheet({
  patientId,
  onClose,
}: {
  patientId: string | null;
  onClose: () => void;
}) {
  const { data: patient, isLoading } = usePatient(patientId);
  const focusEntity = useAppStore((s) => s.focusEntity);

  const surgeries = ((patient as { surgeries?: SurgeriesOnPatient[] })?.surgeries ?? []) as SurgeriesOnPatient[];

  return (
    <Sheet open={!!patientId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {isLoading && (
          <>
            <SheetTitle className="sr-only">Cargando ficha del paciente</SheetTitle>
            <SheetDescription className="sr-only">
              Consultando la información clínica del paciente
            </SheetDescription>
            <div className="space-y-3 p-6">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
          </>
        )}

        {patient && (
          <>
            <SheetHeader className="border-b bg-primary/5 p-5">
              <div className="flex items-center gap-3">
                <div className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-xl">
                  <PawPrint className="size-6" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <SheetTitle className="text-lg">{patient.name}</SheetTitle>
                  <SheetDescription>
                    {patient.code} · {patient.species}
                    {patient.breed ? ` · ${patient.breed}` : ""}
                  </SheetDescription>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <SexBadge sex={patient.sex} />
                <Badge variant="outline" className="font-normal">
                  <Cake className="size-3" /> {ageLabel(patient.ageMonths ?? monthsSince(patient.birthDate))}
                </Badge>
                <Badge variant="outline" className="font-normal">
                  {weightLabel(patient.weight)}
                </Badge>
                {patient.neutered && (
                  <Badge variant="secondary" className="font-normal">Esterilizado</Badge>
                )}
                {!patient.active && <Badge variant="destructive">Inactivo</Badge>}
              </div>
            </SheetHeader>

            <div className="space-y-6 p-5">
              {/* Propietario */}
              <section aria-label="Datos del propietario">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <User className="text-primary size-4" aria-hidden="true" />
                  Propietario
                </h3>
                <div className="bg-card space-y-2.5 rounded-lg border p-4 text-sm">
                  <p className="font-medium">{patient.owner?.fullName}</p>
                  <p className="text-muted-foreground text-xs">
                    {patient.owner?.documentType} · {patient.owner?.documentNumber}
                  </p>
                  <div className="space-y-1.5 pt-1">
                    {patient.owner?.phone && (
                      <a
                        href={`https://wa.me/${patient.owner.phone.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary flex items-center gap-2 text-xs transition-colors"
                      >
                        <MessageCircle className="size-3.5" aria-hidden="true" />
                        {patient.owner.phone}
                      </a>
                    )}
                    {patient.owner?.email && (
                      <p className="text-muted-foreground flex items-center gap-2 text-xs">
                        <Mail className="size-3.5" aria-hidden="true" />
                        {patient.owner.email}
                      </p>
                    )}
                    {patient.owner?.city && (
                      <p className="text-muted-foreground flex items-center gap-2 text-xs">
                        <MapPin className="size-3.5" aria-hidden="true" />
                        {patient.owner.city}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* Datos clínicos */}
              <section aria-label="Datos clínicos">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Bone className="text-primary size-4" aria-hidden="true" />
                  Datos clínicos
                </h3>
                <dl className="bg-card grid grid-cols-2 gap-3 rounded-lg border p-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground text-xs">Nacimiento</dt>
                    <dd className="font-medium">
                      {patient.birthDate
                        ? format(new Date(patient.birthDate), "dd MMM yyyy", { locale: es })
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Peso actual</dt>
                    <dd className="font-medium">{weightLabel(patient.weight)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Color</dt>
                    <dd className="font-medium">{patient.color ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Sexo</dt>
                    <dd className="font-medium">{sexLabel(patient.sex)}</dd>
                  </div>
                  {patient.microchip && (
                    <div className="col-span-2 flex items-center gap-2">
                      <Microchip className="text-muted-foreground size-3.5" aria-hidden="true" />
                      <dd className="font-mono text-xs">{patient.microchip}</dd>
                    </div>
                  )}
                </dl>
                {patient.notes && (
                  <p className="bg-muted/40 mt-2 rounded-lg border p-3 text-xs leading-relaxed whitespace-pre-line">
                    {patient.notes}
                  </p>
                )}
              </section>

              {/* Historial quirúrgico */}
              <section aria-label="Historial quirúrgico">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Scissors className="text-primary size-4" aria-hidden="true" />
                  Historial quirúrgico
                  <Badge variant="secondary" className="ml-auto font-normal">
                    {surgeries.length} cirugía{surgeries.length === 1 ? "" : "s"}
                  </Badge>
                </h3>
                {surgeries.length === 0 ? (
                  <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
                    Sin cirugías registradas para este paciente.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {surgeries.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            focusEntity({ kind: "surgery", id: s.id });
                          }}
                          className="bg-card hover:border-primary/40 w-full rounded-lg border p-3 text-left transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {s.procedureType}
                              </p>
                              <p className="text-muted-foreground mt-0.5 text-xs">
                                {s.code} · {formatDateTime(s.scheduledAt)}
                              </p>
                              <p className="text-muted-foreground mt-1 text-xs">
                                {s.bodyRegion ?? "—"}
                                {s.laterality ? ` (${s.laterality.toLowerCase()})` : ""}
                                {s.vet ? ` · ${s.vet.fullName}` : ""}
                              </p>
                            </div>
                            <SurgeryStatusBadge status={s.status} />
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <p className="text-muted-foreground flex items-center gap-2 text-[11px]">
                <Calendar className="size-3" aria-hidden="true" />
                Paciente registrado el {formatDate(patient.createdAt)}
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
