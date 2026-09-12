// Fila reutilizable de impresiones por documento: chips «<documento>: N vez/
// veces» con la fecha de la última impresión en el tooltip. La usan el
// detalle de cirugía (código CIR-…) y la ficha del paciente (PAC-…).
// Solo lista los tipos con impresiones registradas; sin datos, no renderiza
// nada (cero ruido en entidades estrenas).
import type { DocumentPrintCount } from "@/types";

export default function PrintCountsRow({
  prints,
  loading,
}: {
  prints?: DocumentPrintCount[] | null;
  loading: boolean;
}) {
  if (loading && !prints) {
    return (
      <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
        Cargando impresiones…
      </div>
    );
  }
  if (!prints?.length) return null;
  return (
    <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
      <span className="muted" style={{ fontSize: 12, marginRight: 2 }}>
        Impresiones:
      </span>
      {prints.map((p) => (
        <span
          key={p.document}
          className="chip"
          title={`Última impresión: ${p.lastPrintedAt ?? "—"}`}
        >
          {p.document}: <b>{p.count}</b>
          {p.count === 1 ? " vez" : " veces"}
        </span>
      ))}
    </div>
  );
}
