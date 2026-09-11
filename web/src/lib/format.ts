import { differenceInCalendarMonths, format } from "date-fns";
import { es } from "date-fns/locale";

/** Formato de moneda colombiana: $1.850.000 */
export function formatCOP(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Fecha corta: 15 ene 2026 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return format(new Date(iso), "dd MMM yyyy", { locale: es });
}

/** Fecha y hora: 15 ene 2026 · 09:30 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return format(new Date(iso), "dd MMM yyyy · HH:mm", { locale: es });
}

/** Solo hora: 09:30 */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return format(new Date(iso), "HH:mm", { locale: es });
}

/** Etiqueta de edad legible a partir de meses. */
export function ageLabel(
  ageMonths: number | null | undefined,
): string {
  if (ageMonths == null) return "—";
  if (ageMonths < 1) return "Recién nacido";
  if (ageMonths < 12) return `${ageMonths} ${ageMonths === 1 ? "mes" : "meses"}`;
  const years = Math.floor(ageMonths / 12);
  const months = ageMonths % 12;
  const y = `${years} ${years === 1 ? "año" : "años"}`;
  return months > 0 ? `${y} ${months} m` : y;
}

/** Edad en meses desde fecha de nacimiento ISO. */
export function monthsSince(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  return differenceInCalendarMonths(new Date(), new Date(birthDate));
}

export function sexLabel(sex: string): string {
  return sex === "M" ? "Macho" : "Hembra";
}

export function weightLabel(weight: number | null | undefined): string {
  if (weight == null) return "—";
  return `${weight % 1 === 0 ? weight : weight.toFixed(1)} kg`;
}

/** Nombre corto: "Dr. Carlos Mendoza" → "Dr. Mendoza" */
export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 2) return fullName;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

/** Valor de fecha para input datetime-local (YYYY-MM-DDTHH:mm). */
export function toDatetimeLocal(date: Date): string {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
