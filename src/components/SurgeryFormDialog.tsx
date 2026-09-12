// Diálogo de programación de cirugía (código CIR-AAAA-NNNN automático).
import { useState, type FormEvent } from "react";
import {
  ANESTHESIA_TYPES,
  LATERALITIES,
  PROCEDURE_TYPES,
  type CreateSurgeryInput,
  type Patient,
  type SurgeryDetail,
  type Vet,
} from "@/types";
import { createSurgery, listPatients, listVets } from "@/lib/ipc";
import { useAsync } from "@/lib/use-async";
import { Modal } from "./ui";
import { IconAlert } from "./icons";

interface Props {
  onClose: () => void;
  onCreated: (s: SurgeryDetail) => void;
}

/** "YYYY-MM-DDTHH:mm" (datetime-local) → "YYYY-MM-DD HH:MM:00" (IPC). */
function toDbDateTime(local: string): string {
  return local.replace("T", " ") + ":00";
}

export default function SurgeryFormDialog({ onClose, onCreated }: Props) {
  const patients = useAsync(() => listPatients({ active: true }), []);
  const vets = useAsync(() => listVets(), []);

  const [patientId, setPatientId] = useState("");
  const [vetId, setVetId] = useState("");
  const [procedureType, setProcedureType] = useState("");
  const [bodyRegion, setBodyRegion] = useState("");
  const [laterality, setLaterality] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [anesthesiaType, setAnesthesiaType] = useState("");
  const [asaRisk, setAsaRisk] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [description, setDescription] = useState("");
  const [presumptiveDiagnosis, setPresumptiveDiagnosis] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!patientId) e.patientId = "Selecciona el paciente.";
    if (!procedureType.trim()) e.procedureType = "El procedimiento es requerido.";
    if (!scheduledAt) e.scheduledAt = "Fecha y hora requeridas.";
    else {
      const t = new Date(scheduledAt).getTime();
      if (Number.isNaN(t)) e.scheduledAt = "Fecha inválida.";
    }
    if (durationMin.trim() !== "") {
      const d = Number(durationMin);
      if (!Number.isInteger(d) || d <= 0 || d > 1440)
        e.durationMin = "Entre 1 y 1440 minutos.";
    }
    if (asaRisk.trim() !== "") {
      const a = Number(asaRisk);
      if (!Number.isInteger(a) || a < 1 || a > 5) e.asaRisk = "ASA entre 1 y 5.";
    }
    if (estimatedCost.trim() !== "" && Number(estimatedCost) < 0)
      e.estimatedCost = "No puede ser negativo.";
    setErrors(e);
    return Object.values(e).every((v) => !v);
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setFormError(null);
    if (!validate()) return;

    const opt = (v: string) => (v.trim() === "" ? undefined : v.trim());
    const input: CreateSurgeryInput = {
      patientId: Number(patientId),
      vetId: vetId ? Number(vetId) : undefined,
      procedureType: procedureType.trim(),
      bodyRegion: opt(bodyRegion),
      laterality: opt(laterality),
      description: opt(description),
      presumptiveDiagnosis: opt(presumptiveDiagnosis),
      scheduledAt: toDbDateTime(scheduledAt),
      durationMin: durationMin.trim() ? Number(durationMin) : undefined,
      anesthesiaType: opt(anesthesiaType),
      asaRisk: asaRisk.trim() ? Number(asaRisk) : undefined,
      estimatedCost: estimatedCost.trim() ? Number(estimatedCost) : undefined,
    };

    setSubmitting(true);
    try {
      const created = await createSurgery(input);
      onCreated(created);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo programar la cirugía.");
      setSubmitting(false);
    }
  }

  const err = (k: string) => errors[k];
  const patientList: Patient[] = patients.data ?? [];
  const vetList: Vet[] = vets.data ?? [];

  return (
    <Modal
      title="Programar cirugía"
      subtitle="El código CIR-AAAA-NNNN y el estado PROGRAMADA se asignan automáticamente."
      onClose={onClose}
      width={720}
    >
      <form onSubmit={submit} noValidate>
        <div className="modal-body">
          {formError ? (
            <div className="banner danger" role="alert" style={{ marginBottom: 16 }}>
              <IconAlert size={18} />
              <span>{formError}</span>
            </div>
          ) : null}

          <div className="form-section">
            <h3>Paciente y procedimiento</h3>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="sf-patient">Paciente *</label>
                <select
                  id="sf-patient"
                  className="select"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  aria-invalid={!!err("patientId")}
                >
                  <option value="">
                    {patients.loading ? "Cargando pacientes…" : "Seleccionar…"}
                  </option>
                  {patientList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} · {p.name} ({p.species}) — {p.ownerName}
                    </option>
                  ))}
                </select>
                {err("patientId") ? <span className="field-error">{err("patientId")}</span> : null}
              </div>
              <div className="field">
                <label htmlFor="sf-vet">
                  Veterinario <span className="opt">(opcional)</span>
                </label>
                <select
                  id="sf-vet"
                  className="select"
                  value={vetId}
                  onChange={(e) => setVetId(e.target.value)}
                >
                  <option value="">Sin asignar</option>
                  {vetList.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.fullName}
                      {v.specialty ? ` · ${v.specialty}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field col-2">
                <label htmlFor="sf-proc">Procedimiento *</label>
                <input
                  id="sf-proc"
                  className="input"
                  list="sf-proc-options"
                  value={procedureType}
                  onChange={(e) => setProcedureType(e.target.value)}
                  aria-invalid={!!err("procedureType")}
                  placeholder="TPLO, TTA, ORIF… (texto libre o sugerencia)"
                  autoComplete="off"
                />
                <datalist id="sf-proc-options">
                  {PROCEDURE_TYPES.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
                {err("procedureType") ? (
                  <span className="field-error">{err("procedureType")}</span>
                ) : null}
              </div>
              <div className="field">
                <label htmlFor="sf-region">
                  Región corporal <span className="opt">(opcional)</span>
                </label>
                <input
                  id="sf-region"
                  className="input"
                  value={bodyRegion}
                  onChange={(e) => setBodyRegion(e.target.value)}
                  placeholder="Fémur distal, tibia proximal…"
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="sf-lat">
                  Lateralidad <span className="opt">(opcional)</span>
                </label>
                <select
                  id="sf-lat"
                  className="select"
                  value={laterality}
                  onChange={(e) => setLaterality(e.target.value)}
                >
                  <option value="">Sin especificar</option>
                  {LATERALITIES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Agenda y anestesia</h3>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="sf-when">Fecha y hora *</label>
                <input
                  id="sf-when"
                  className="input"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  aria-invalid={!!err("scheduledAt")}
                />
                {err("scheduledAt") ? (
                  <span className="field-error">{err("scheduledAt")}</span>
                ) : null}
              </div>
              <div className="field">
                <label htmlFor="sf-dur">
                  Duración estimada (min) <span className="opt">(opcional)</span>
                </label>
                <input
                  id="sf-dur"
                  className="input"
                  type="number"
                  min="1"
                  max="1440"
                  step="1"
                  inputMode="numeric"
                  value={durationMin}
                  onChange={(e) => setDurationMin(e.target.value)}
                  aria-invalid={!!err("durationMin")}
                  placeholder="120"
                />
                {err("durationMin") ? (
                  <span className="field-error">{err("durationMin")}</span>
                ) : null}
              </div>
              <div className="field">
                <label htmlFor="sf-anest">
                  Anestesia <span className="opt">(opcional)</span>
                </label>
                <select
                  id="sf-anest"
                  className="select"
                  value={anesthesiaType}
                  onChange={(e) => setAnesthesiaType(e.target.value)}
                >
                  <option value="">Sin especificar</option>
                  {ANESTHESIA_TYPES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="sf-asa">
                  Riesgo ASA <span className="opt">(1–5, opcional)</span>
                </label>
                <select
                  id="sf-asa"
                  className="select"
                  value={asaRisk}
                  onChange={(e) => setAsaRisk(e.target.value)}
                >
                  <option value="">Sin clasificar</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      ASA {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="sf-cost">
                  Costo estimado (COP) <span className="opt">(opcional)</span>
                </label>
                <input
                  id="sf-cost"
                  className="input"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                  placeholder="3500000"
                  aria-invalid={!!err("estimatedCost")}
                />
                {err("estimatedCost") ? (
                  <span className="field-error">{err("estimatedCost")}</span>
                ) : null}
              </div>
              <div className="field col-2">
                <label htmlFor="sf-diag">
                  Diagnóstico presuntivo <span className="opt">(opcional)</span>
                </label>
                <textarea
                  id="sf-diag"
                  className="textarea"
                  value={presumptiveDiagnosis}
                  onChange={(e) => setPresumptiveDiagnosis(e.target.value)}
                  placeholder="Motivo quirúrgico — p. ej. «Rotura de LCC craneal con cojera grado IV/5» — sale en el consentimiento y la historia clínica."
                  rows={2}
                />
              </div>
              <div className="field col-2">
                <label htmlFor="sf-desc">
                  Descripción / plan quirúrgico <span className="opt">(opcional)</span>
                </label>
                <textarea
                  id="sf-desc"
                  className="textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Abordaje, implantes previstos, consideraciones…"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <span className="muted" style={{ marginRight: "auto", fontSize: 12.5 }}>
            Podrás agregar materiales e implantes al abrir la cirugía.
          </span>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? <span className="spin" /> : null}
            {submitting ? "Programando…" : "Programar cirugía"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
