// Detalle de la cirugía: resumen, editor de materiales/implantes (bloqueado
// si está COMPLETADA), transiciones de estado (completar consume inventario
// de forma transaccional) y controles postoperatorios.
import { useMemo, useState, type FormEvent } from "react";
import {
  FOLLOW_UP_TYPE_LABEL,
  FOLLOW_UP_TYPES,
  SURGERY_STATUS_META,
  type FollowUp,
  type SurgeryMaterial,
  type SurgeryStatus,
  type UpsertMaterialInput,
} from "@/types";
import {
  createFollowUp,
  getDocumentPrints,
  getSurgery,
  listInventoryItems,
  removeSurgeryMaterial,
  updateFollowUp,
  updateSurgery,
  upsertSurgeryMaterial,
} from "@/lib/ipc";
import type { DocumentPrintCount } from "@/types";
import { fmtCOP, fmtDate, fmtDateTime, fmtQty } from "@/lib/format";
import {
  buildConsentimiento,
  buildFormulaMedica,
  buildHistoriaCirugia,
  type PrintDoc,
} from "@/lib/clinical-docs";
import { usePrintPreview } from "@/lib/use-print-preview";
import PrintPreviewDialog from "./PrintPreviewDialog";
import { useAsync } from "@/lib/use-async";
import { Modal, useToast } from "./ui";
import { IconAlert, IconCheck, IconClose, IconDownload, IconPlus } from "./icons";

interface Props {
  surgeryId: number;
  onClose: () => void;
  onChanged: () => void;
}

/** Fila de impresiones del pie del detalle: cuántas veces salió cada
 *  documento de esta cirugía y cuándo fue la última. Solo lista los tipos
 *  con impresiones registradas; si no hay ninguna, una nota discreta. */
function PrintCountsRow({
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

function StatusBadge({ status }: { status: string }) {
  const meta = SURGERY_STATUS_META[status as SurgeryStatus];
  return (
    <span className={`badge badge-${meta?.badge ?? "secondary"}`}>
      <span className="dot" aria-hidden="true" />
      {meta?.label ?? status}
    </span>
  );
}

/** Siguientes estados permitidos para mostrar como acciones. */
function nextActions(status: SurgeryStatus): { to: SurgeryStatus; label: string; danger?: boolean }[] {
  switch (status) {
    case "PROGRAMADA":
      return [
        { to: "EN_CURSO", label: "Iniciar cirugía" },
        { to: "COMPLETADA", label: "Completar" },
        { to: "CANCELADA", label: "Cancelar", danger: true },
      ];
    case "EN_CURSO":
      return [
        { to: "COMPLETADA", label: "Completar cirugía" },
        { to: "CANCELADA", label: "Cancelar", danger: true },
      ];
    default:
      return [];
  }
}

export default function SurgeryDetailDialog({ surgeryId, onClose, onChanged }: Props) {
  const toast = useToast();
  const detail = useAsync(() => getSurgery(surgeryId), [surgeryId]);
  const preview = usePrintPreview();

  // Impresiones por documento de ESTA cirugía (conteo + última fecha):
  // se consulta cuando el detalle trae el código real (CIR-AAAA-NNNN) y se
  // recarga tras cada impresión registrada para que el contador suba al instante.
  const code = detail.data?.code;
  const prints = useAsync(
    () => (code ? getDocumentPrints(code) : Promise.resolve([])),
    [code],
  );

  const openPreview = (build: (d: NonNullable<typeof detail.data>) => Promise<PrintDoc>) => {
    if (detail.data) preview.open(() => build(detail.data!));
  };

  const [busy, setBusy] = useState(false);
  const [matForm, setMatForm] = useState({ itemId: "", qty: "1", notes: "" });
  const [fuForm, setFuForm] = useState({ date: "", type: "CONTROL_RADIOGRAFICO", notes: "" });
  const [formError, setFormError] = useState<string | null>(null);
  // Diagnóstico definitivo obligatorio al completar: el botón «Completar»
  // abre este mini-diálogo en lugar de completar directamente.
  const [completeForm, setCompleteForm] = useState<string | null>(null);

  const s = detail.data;
  const locked = s?.status === "COMPLETADA" || s?.status === "CANCELADA";

  // Ítems del inventario activos para el selector de materiales (se obtienen
  // del propio detalle de la cirugía ya cargado; la lista de la vista padre
  // trae el catálogo cuando la vista de inventario los carga, así que aquí
  // pedimos vía ipc con un pequeño componente interno).
  const materials = useMemo(() => s?.materials ?? [], [s]);
  const followUps = useMemo(() => (s?.follow_ups ?? []) as FollowUp[], [s]);
  const materialsCost = useMemo(
    () => materials.reduce((acc, m) => acc + (m.qtyUsed ?? m.qtyPlanned) * (m.unitCost ?? 0), 0),
    [materials],
  );

  async function run(fn: () => Promise<unknown>, okMsg: string) {
    setFormError(null);
    setBusy(true);
    try {
      await fn();
      await detail.reload();
      toast.success(okMsg);
      onChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Operación fallida";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  function changeStatus(to: SurgeryStatus) {
    if (to === "COMPLETADA") {
      // Requiere diagnóstico definitivo: abrir el mini-diálogo de cierre.
      setCompleteForm("");
      setFormError(null);
      return;
    }
    run(
      () => updateSurgery(surgeryId, { status: to }),
      `Estado actualizado a ${SURGERY_STATUS_META[to].label}.`,
    );
  }

  function confirmComplete(ev: FormEvent) {
    ev.preventDefault();
    const dx = (completeForm ?? "").trim();
    if (!dx) {
      setFormError("El diagnóstico definitivo es obligatorio para completar la cirugía.");
      return;
    }
    run(
      () => updateSurgery(surgeryId, { status: "COMPLETADA", definitiveDiagnosis: dx }),
      "Cirugía completada: inventario consumido.",
    );
    setCompleteForm(null);
  }

  function addMaterial(ev: FormEvent) {
    ev.preventDefault();
    if (!matForm.itemId) {
      setFormError("Selecciona el material.");
      return;
    }
    const qty = Number(matForm.qty.replace(",", "."));
    if (!Number.isFinite(qty) || qty <= 0) {
      setFormError("La cantidad debe ser mayor a 0.");
      return;
    }
    const input: UpsertMaterialInput = {
      itemId: Number(matForm.itemId),
      qtyPlanned: qty,
      notes: matForm.notes.trim() || undefined,
    };
    run(() => upsertSurgeryMaterial(surgeryId, input), "Material agregado a la cirugía.");
    setMatForm({ itemId: "", qty: "1", notes: "" });
  }

  function addFollowUp(ev: FormEvent) {
    ev.preventDefault();
    if (!fuForm.date) {
      setFormError("Fecha del control requerida.");
      return;
    }
    run(
      () =>
        createFollowUp(surgeryId, {
          scheduledDate: fuForm.date,
          type: fuForm.type,
          notes: fuForm.notes.trim() || undefined,
        }),
      "Control postoperatorio agendado.",
    );
    setFuForm({ date: "", type: fuForm.type, notes: "" });
  }

  const errBanner = formError ? (
    <div className="banner danger" role="alert" style={{ marginBottom: 14 }}>
      <IconAlert size={18} />
      <span>{formError}</span>
    </div>
  ) : null;

  return (
    <Modal
      title={s ? `${s.code} · ${s.procedureType}` : "Cirugía"}
      subtitle={s ? `${s.patient.name} (${s.patient.species}) · ${fmtDateTime(s.scheduledAt)}` : "Cargando…"}
      onClose={onClose}
      width={780}
      footer={
        s ? (
          <div style={{ width: "100%" }}>
            <PrintCountsRow prints={prints.data} loading={prints.loading} />
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <span className="muted" style={{ fontSize: 12.5, marginRight: "auto" }}>
                Imprimir / guardar como PDF:
              </span>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => openPreview(buildConsentimiento)}
                title="Vista previa del consentimiento informado firmado por el propietario"
              >
                <IconDownload size={14} /> Consentimiento
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => openPreview(buildFormulaMedica)}
                title="Vista previa de la fórmula médica postquirúrgica (medicamentos e indicaciones)"
              >
                <IconDownload size={14} /> Fórmula médica
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => openPreview(buildHistoriaCirugia)}
                title="Vista previa de la historia clínica quirúrgica completa (procedimientos, materiales y controles)"
              >
                <IconDownload size={14} /> Historia quirúrgica
              </button>
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="modal-body">
        {detail.error ? (
          <p className="field-error">{detail.error}</p>
        ) : detail.loading || !s ? (
          <div>
            <div className="skeleton" style={{ height: 70, marginBottom: 14 }} />
            <div className="skeleton skeleton-text" style={{ width: "70%" }} />
            <div className="skeleton skeleton-text" style={{ width: "45%" }} />
          </div>
        ) : (
          <>
            {errBanner}

            {/* ---------- Resumen ---------- */}
            <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
              <StatusBadge status={s.status} />
              {s.vet ? <span className="chip">MV {s.vet.fullName}</span> : null}
              {s.bodyRegion ? <span className="chip">{s.bodyRegion}</span> : null}
              {s.laterality ? <span className="chip">{s.laterality}</span> : null}
              {s.anesthesiaType ? <span className="chip">{s.anesthesiaType}</span> : null}
              {s.asaRisk ? <span className="chip">ASA {s.asaRisk}</span> : null}
              {s.durationMin ? <span className="chip">{s.durationMin} min</span> : null}
              {s.estimatedCost != null ? <span className="chip">{fmtCOP(s.estimatedCost)}</span> : null}
              <span className="chip">
                Propietario: {s.patient.owner.fullName}
                {s.patient.owner.phone ? ` · ${s.patient.owner.phone}` : ""}
              </span>
            </div>

            {s.description ? <p className="field-hint mb-2">{s.description}</p> : null}

            {/* ---------- Diagnóstico formal (migración 0006) ---------- */}
            {(s.presumptiveDiagnosis || s.definitiveDiagnosis) && (
              <div className="card mb-4" style={{ padding: "10px 14px" }}>
                {s.presumptiveDiagnosis ? (
                  <p className="kv" style={{ margin: "4px 0" }}>
                    <b>Diagnóstico presuntivo:</b> {s.presumptiveDiagnosis}
                  </p>
                ) : null}
                {s.definitiveDiagnosis ? (
                  <p className="kv" style={{ margin: "4px 0" }}>
                    <b>Diagnóstico definitivo:</b> {s.definitiveDiagnosis}
                  </p>
                ) : null}
              </div>
            )}

            {/* ---------- Acciones de estado ---------- */}
            {nextActions(s.status as SurgeryStatus).length > 0 ? (
              <div className="status-actions mb-4">
                {nextActions(s.status as SurgeryStatus).map((a) => (
                  <button
                    key={a.to}
                    type="button"
                    className={`btn btn-sm ${a.danger ? "btn-danger" : a.to === "COMPLETADA" ? "btn-primary" : "btn-outline"}`}
                    disabled={busy}
                    onClick={() => changeStatus(a.to)}
                    title={
                      a.to === "COMPLETADA"
                        ? "Descuenta del inventario los materiales con cantidad usada"
                        : undefined
                    }
                  >
                    {a.to === "COMPLETADA" ? <IconCheck size={15} /> : null}
                    {a.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted mb-4" style={{ fontSize: 12.5 }}>
                Cirugía {SURGERY_STATUS_META[s.status as SurgeryStatus]?.label ?? s.status}: estado
                final{s.completedAt ? ` · ${fmtDateTime(s.completedAt)}` : ""}.
              </p>
            )}

            {/* ---------- Diálogo de cierre: diagnóstico definitivo obligatorio ---------- */}
            {completeForm !== null && (
              <form
                className="card mb-4"
                style={{ padding: "12px 14px", borderColor: "var(--border-strong, #0e6f64)" }}
                onSubmit={confirmComplete}
              >
                <label htmlFor="sd-defdx" style={{ fontWeight: 600, fontSize: 13 }}>
                  Diagnóstico definitivo <span className="opt" style={{ color: "var(--red)" }}>*</span>
                </label>
                <p className="field-hint" style={{ margin: "2px 0 8px" }}>
                  Hallazgo confirmado que cierra el caso — se imprime en la fórmula médica y la
                  historia clínica quirúrgica. La cirugía no puede completarse sin él.
                </p>
                <textarea
                  id="sd-defdx"
                  className="textarea"
                  value={completeForm}
                  onChange={(e) => setCompleteForm(e.target.value)}
                  placeholder="p. ej. «Rotura completa de LCC izquierdo confirmada; TPLO sin complicaciones»"
                  rows={3}
                  autoFocus
                />
                <div className="row" style={{ gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
                  <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => setCompleteForm(null)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
                    <IconCheck size={15} />
                    Completar cirugía
                  </button>
                </div>
              </form>
            )}

            {/* ---------- Materiales ---------- */}
            <h3 className="row" style={{ fontSize: 13.5, gap: 8, marginBottom: 10 }}>
              Materiales e implantes
              <span className="badge badge-outline">{materials.length}</span>
              <span className="spacer" />
              <span className="muted" style={{ fontSize: 12 }}>
                Costo materiales: <b>{fmtCOP(materialsCost)}</b>
              </span>
            </h3>

            {materials.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>
                {locked
                  ? "Sin materiales registrados."
                  : "Agrega las platinas, tornillos o suturas planeados."}
              </p>
            ) : (
              <div className="table-wrap" style={{ maxHeight: 260, marginBottom: 12 }}>
                <table style={{ minWidth: 0 }}>
                  <caption className="sr-only">Materiales de la cirugía</caption>
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th className="num">Plan.</th>
                      <th className="num">Usado</th>
                      <th className="num">Costo</th>
                      {!locked && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((m: SurgeryMaterial) => (
                      <tr key={m.id}>
                        <td data-label="Material">
                          <span className="cell-main">{m.item.name}</span>
                          <div className="cell-sub">
                            {m.item.code}
                            {m.item.size ? ` · ${m.item.size}` : ""} · stock {fmtQty(m.item.stockQty)} {m.item.unit}
                          </div>
                        </td>
                        <td data-label="Planeado" className="num">
                          <input
                            className="input"
                            style={{ width: 76, minHeight: 30, textAlign: "right" }}
                            type="number"
                            min="0"
                            step="any"
                            disabled={locked || busy}
                            defaultValue={m.qtyPlanned}
                            onBlur={(e) => {
                              const v = Number(e.target.value.replace(",", "."));
                              if (Number.isFinite(v) && v > 0 && v !== m.qtyPlanned) {
                                run(
                                  () =>
                                    upsertSurgeryMaterial(surgeryId, {
                                      itemId: m.item.id,
                                      qtyPlanned: v,
                                      qtyUsed: m.qtyUsed ?? undefined,
                                      notes: m.notes ?? undefined,
                                    }),
                                  `Material ${m.item.code} actualizado.`,
                                );
                              }
                            }}
                          />
                        </td>
                        <td data-label="Usado" className="num">
                          <input
                            className="input"
                            style={{ width: 76, minHeight: 30, textAlign: "right" }}
                            type="number"
                            min="0"
                            step="any"
                            disabled={locked || busy}
                            placeholder="—"
                            defaultValue={m.qtyUsed ?? ""}
                            onBlur={(e) => {
                              const raw = e.target.value.trim();
                              const v = raw === "" ? null : Number(raw.replace(",", "."));
                              if (v === null) return;
                              if (Number.isFinite(v) && v >= 0 && v !== m.qtyUsed) {
                                run(
                                  () =>
                                    upsertSurgeryMaterial(surgeryId, {
                                      itemId: m.item.id,
                                      qtyPlanned: m.qtyPlanned,
                                      qtyUsed: v,
                                      notes: m.notes ?? undefined,
                                    }),
                                  `Material ${m.item.code} actualizado.`,
                                );
                              }
                            }}
                          />
                        </td>
                        <td data-label="Costo" className="num">
                          {fmtCOP((m.qtyUsed ?? m.qtyPlanned) * (m.unitCost ?? 0))}
                        </td>
                        {!locked && (
                          <td className="num">
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={busy}
                              aria-label={`Quitar ${m.item.name}`}
                              onClick={() =>
                                run(
                                  () => removeSurgeryMaterial(surgeryId, m.id),
                                  "Material quitado de la cirugía.",
                                )
                              }
                            >
                              <IconClose size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!locked ? (
              <form onSubmit={addMaterial} className="row wrap" style={{ gap: 8, marginBottom: 18 }}>
                <MaterialPicker onPick={(id) => setMatForm((f) => ({ ...f, itemId: id }))} selectedId={matForm.itemId} />
                <input
                  className="input"
                  style={{ width: 90 }}
                  type="number"
                  min="0"
                  step="any"
                  aria-label="Cantidad planeada"
                  value={matForm.qty}
                  onChange={(e) => setMatForm((f) => ({ ...f, qty: e.target.value }))}
                />
                <button type="submit" className="btn btn-outline btn-sm" disabled={busy}>
                  <IconPlus size={14} /> Agregar
                </button>
              </form>
            ) : null}

            {/* ---------- Controles postoperatorios ---------- */}
            <h3 className="row" style={{ fontSize: 13.5, gap: 8, marginBottom: 10 }}>
              Controles postoperatorios
              <span className="badge badge-outline">{followUps.length}</span>
            </h3>

            {followUps.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>
                Sin controles agendados.
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: "0 0 14px", padding: 0 }}>
                {followUps.map((f) => (
                  <li
                    key={f.id}
                    className="row wrap"
                    style={{
                      gap: 8,
                      padding: "8px 10px",
                      border: "1px solid var(--border-soft)",
                      borderRadius: "var(--radius-sm)",
                      marginBottom: 6,
                    }}
                  >
                    <span className="badge badge-outline">{fmtDate(f.scheduledDate)}</span>
                    <b style={{ fontSize: 13 }}>{FOLLOW_UP_TYPE_LABEL[f.type] ?? f.type}</b>
                    {f.notes ? <span className="cell-sub">{f.notes}</span> : null}
                    <span className="spacer" />
                    <span
                      className={`badge ${
                        f.status === "CUMPLIDO"
                          ? "badge-success"
                          : f.status === "PERDIDO"
                            ? "badge-destructive"
                            : "badge-warning"
                      }`}
                    >
                      {f.status}
                    </span>
                    {f.status === "PENDIENTE" ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busy}
                          onClick={() =>
                            run(
                              () => updateFollowUp(surgeryId, f.id, { status: "CUMPLIDO" }),
                              "Control marcado como cumplido.",
                            )
                          }
                        >
                          <IconCheck size={14} /> Cumplido
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={busy}
                          onClick={() =>
                            run(
                              () => updateFollowUp(surgeryId, f.id, { status: "PERDIDO" }),
                              "Control marcado como perdido.",
                            )
                          }
                        >
                          Perdido
                        </button>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={addFollowUp} className="row wrap" style={{ gap: 8 }}>
              <input
                className="input"
                style={{ width: 170 }}
                type="date"
                aria-label="Fecha del control"
                value={fuForm.date}
                onChange={(e) => setFuForm((f) => ({ ...f, date: e.target.value }))}
              />
              <select
                className="select"
                style={{ width: 200 }}
                aria-label="Tipo de control"
                value={fuForm.type}
                onChange={(e) => setFuForm((f) => ({ ...f, type: e.target.value }))}
              >
                {FOLLOW_UP_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {FOLLOW_UP_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
              <input
                className="input"
                style={{ width: 180 }}
                placeholder="Notas (opcional)"
                value={fuForm.notes}
                onChange={(e) => setFuForm((f) => ({ ...f, notes: e.target.value }))}
              />
              <button type="submit" className="btn btn-outline btn-sm" disabled={busy}>
                <IconPlus size={14} /> Agendar control
              </button>
            </form>
          </>
        )}
      </div>
      <PrintPreviewDialog
        doc={preview.doc}
        loading={preview.loading}
        error={preview.error}
        onClose={preview.close}
        onPrinted={() => void prints.reload()}
      />
    </Modal>
  );
}

/* --------------------- Selector de material (interno) --------------------- */

/**
 * Lista perezosa de ítems activos del inventario para el picker de
 * materiales. Se implementa como componente propio para poder usar useAsync
 * dentro del diálogo sin recrear la consulta en cada render.
 */
function MaterialPicker({
  onPick,
  selectedId,
}: {
  onPick: (id: string) => void;
  selectedId: string;
}) {
  const { data, loading, error } = useAsync(() => listInventoryItems({}), []);
  const items = data ?? [];

  if (error) {
    return (
      <input
        className="input"
        style={{ flex: 1, minWidth: 220 }}
        placeholder="No se pudo cargar el inventario"
        disabled
      />
    );
  }

  return (
    <select
      className="select"
      style={{ flex: 1, minWidth: 220 }}
      value={selectedId}
      onChange={(e) => onPick(e.target.value)}
      aria-label="Material"
      disabled={loading}
    >
      <option value="">{loading ? "Cargando inventario…" : "Seleccionar material…"}</option>
      {items.map((i) => (
        <option key={i.id} value={i.id}>
          {i.name} · {i.code} (stock {fmtQty(i.stockQty)} {i.unit})
        </option>
      ))}
    </select>
  );
}
