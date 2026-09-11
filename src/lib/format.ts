// VetSurgeryTR — utilidades de formato (fechas estilo Firebird, COP, edad).

/** "YYYY-MM-DD[ HH:MM:SS]" → Date (el separador se normaliza a "T"). */
export function parseDbDate(v: string): Date {
  return new Date(v.replace(" ", "T"));
}

const MONTHS_SHORT = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** "15 ene 2026" */
export function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  const d = parseDbDate(v.slice(0, 10));
  if (Number.isNaN(d.getTime())) return v;
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** "15 ene 2026 · 08:30" */
export function fmtDateTime(v: string | null | undefined): string {
  if (!v) return "—";
  if (v.length <= 10) return fmtDate(v);
  const d = parseDbDate(v);
  if (Number.isNaN(d.getTime())) return v;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${fmtDate(v)} · ${hh}:${mm}`;
}

const copFmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

/** COP sin decimales: "$ 3.200.000" */
export function fmtCOP(v: number | null | undefined): string {
  if (v == null) return "—";
  return copFmt.format(v);
}

/** Número sin decimales colgantes: 6.0 → "6", 4.2 → "4.2". */
export function fmtQty(v: number | null | undefined): string {
  if (v == null) return "—";
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

/** Edad en meses → "4 a 2 m" / "7 m" / "—" */
export function fmtAge(months: number | null | undefined): string {
  if (months == null) return "—";
  if (months < 1) return "recién nacido";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years <= 0) return `${rest} m`;
  if (rest === 0) return `${years} a`;
  return `${years} a ${rest} m`;
}

/** Etiqueta "M"/"F" → "♂"/"♀". */
export function fmtSex(sex: string): string {
  return sex === "F" ? "♀" : "♂";
}
