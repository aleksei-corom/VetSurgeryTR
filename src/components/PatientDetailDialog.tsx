// Ficha del paciente: datos del propietario, clínicos e historial quirúrgico
// (get_patient → PatientDetail). Acción: editar.
import { SURGERY_STATUS_META, type PatientDetail, type SurgeryStatus } from "@/types";
import { fmtAge, fmtDate, fmtQty, fmtSex } from "@/lib/format";
import { buildHistoriaPaciente } from "@/lib/clinical-docs";
import { usePrintPreview } from "@/lib/use-print-preview";
import PrintPreviewDialog from "./PrintPreviewDialog";
import { Modal } from "./ui";
import { IconDownload, IconEdit } from "./icons";

interface Props {
  detail: PatientDetail | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onEdit: (p: PatientDetail) => void;
}

export default function PatientDetailDialog({ detail, loading, error, onClose, onEdit }: Props) {
  // PatientDetail es plano (serde flatten): los campos del paciente cuelgan
  // directamente del objeto, junto a `surgeries`.
  const p = detail;
  const preview = usePrintPreview();

  return (
    <Modal
      title={p ? `${fmtSex(p.sex)} ${p.name}` : "Ficha del paciente"}
      subtitle={p ? `${p.code} · ${p.species}${p.breed ? ` · ${p.breed}` : ""}` : undefined}
      onClose={onClose}
      width={680}
      footer={
        p ? (
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-outline"
              disabled={!detail}
              onClick={() => detail && preview.open(() => buildHistoriaPaciente(detail))}
              title="Vista previa de la historia clínica completa del paciente antes de imprimir"
            >
              <IconDownload size={16} /> Historia clínica
            </button>
            <button type="button" className="btn btn-primary" onClick={() => onEdit(detail!)}>
              <IconEdit size={16} /> Editar paciente
            </button>
          </div>
        ) : null
      }
    >
      <div className="modal-body">
        {error ? (
          <p className="field-error">{error}</p>
        ) : loading || !p ? (
          <div>
            <div className="skeleton" style={{ height: 80, marginBottom: 14 }} />
            <div className="skeleton skeleton-text" style={{ width: "65%" }} />
            <div className="skeleton skeleton-text" style={{ width: "40%" }} />
          </div>
        ) : (
          <>
            <dl className="detail-grid">
              <div>
                <dt>Propietario</dt>
                <dd>{p.ownerName}</dd>
              </div>
              <div>
                <dt>Teléfono</dt>
                <dd>{p.ownerPhone ?? "—"}</dd>
              </div>
              <div>
                <dt>Edad</dt>
                <dd>{p.birthDate ? fmtAge(p.ageMonths) : "—"}</dd>
              </div>
              <div>
                <dt>Nacimiento</dt>
                <dd>{p.birthDate ? fmtDate(p.birthDate) : "—"}</dd>
              </div>
              <div>
                <dt>Peso</dt>
                <dd>{p.weight != null ? `${fmtQty(p.weight)} kg` : "—"}</dd>
              </div>
              <div>
                <dt>Esterilizado</dt>
                <dd>{p.neutered ? "Sí" : "No"}</dd>
              </div>
              <div>
                <dt>Color</dt>
                <dd>{p.color ?? "—"}</dd>
              </div>
              <div>
                <dt>Microchip</dt>
                <dd>{p.microchip ?? "—"}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{p.active ? "Activo" : "Inactivo"}</dd>
              </div>
              <div>
                <dt>Cirugías</dt>
                <dd>{p.surgeryCount}</dd>
              </div>
            </dl>

            {p.notes ? <p className="field-hint mt-2">{p.notes}</p> : null}

            <h3 style={{ fontSize: 13.5, margin: "18px 0 10px" }}>Historial quirúrgico</h3>
            {(detail?.surgeries ?? []).length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>
                Sin cirugías registradas.
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {(detail?.surgeries ?? []).map((s) => {
                  const meta = SURGERY_STATUS_META[s.status as SurgeryStatus];
                  return (
                    <li
                      key={s.id}
                      className="row wrap"
                      style={{
                        gap: 8,
                        padding: "9px 10px",
                        border: "1px solid var(--border-soft)",
                        borderRadius: "var(--radius-sm)",
                        marginBottom: 6,
                      }}
                    >
                      <span className="mono">{s.code}</span>
                      <span
                        className={`badge badge-${meta?.badge ?? "secondary"}`}
                        aria-label={`Estado ${meta?.label ?? s.status}`}
                      >
                        {meta?.label ?? s.status}
                      </span>
                      <b style={{ fontSize: 13 }}>{s.procedureType}</b>
                      {s.bodyRegion ? <span className="cell-sub">{s.bodyRegion}</span> : null}
                      <span className="spacer" />
                      <span className="cell-sub">{fmtDate(s.scheduledAt)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
      <PrintPreviewDialog
        doc={preview.doc}
        loading={preview.loading}
        error={preview.error}
        onClose={preview.close}
      />
    </Modal>
  );
}
