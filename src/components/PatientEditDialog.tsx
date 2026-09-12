// Edición de paciente (update_patient parcial): datos clínicos + estado.
import { useState, type FormEvent } from "react";
import { SPECIES_OPTIONS, type Patient } from "@/types";
import { updatePatient } from "@/lib/ipc";
import { Modal } from "./ui";
import { IconAlert } from "./icons";

interface Props {
  patient: Patient;
  onClose: () => void;
  onSaved: (p: Patient) => void;
}

interface FormState {
  name: string;
  species: string;
  breed: string;
  sex: "M" | "F";
  birthDate: string;
  weight: string;
  color: string;
  microchip: string;
  neutered: boolean;
  active: boolean;
  notes: string;
}

function fromPatient(p: Patient): FormState {
  return {
    name: p.name,
    species: p.species,
    breed: p.breed ?? "",
    sex: p.sex === "F" ? "F" : "M",
    birthDate: p.birthDate ?? "",
    weight: p.weight != null ? String(p.weight) : "",
    color: p.color ?? "",
    microchip: p.microchip ?? "",
    neutered: p.neutered,
    active: p.active,
    notes: p.notes ?? "",
  };
}

type Errors = Partial<Record<string, string>>;

export default function PatientEditDialog({ patient, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(() => fromPatient(patient));
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "El nombre del paciente es requerido.";
    if (!form.species) e.species = "Selecciona la especie.";
    if (form.birthDate) {
      const d = new Date(`${form.birthDate}T00:00:00`);
      if (Number.isNaN(d.getTime())) e.birthDate = "Fecha inválida.";
      else if (d.getTime() > Date.now() + 86_400_000) e.birthDate = "La fecha no puede ser futura.";
    }
    if (form.weight.trim() !== "") {
      const w = Number(form.weight.replace(",", "."));
      if (Number.isNaN(w)) e.weight = "Debe ser un número (kg).";
      else if (w <= 0) e.weight = "El peso debe ser mayor a 0.";
    }
    setErrors(e);
    return Object.values(e).every((v) => !v);
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setFormError(null);
    if (!validate()) return;

    const opt = (v: string) => (v.trim() === "" ? undefined : v.trim());
    setSubmitting(true);
    try {
      const saved = await updatePatient(patient.id, {
        name: form.name.trim(),
        species: form.species,
        breed: opt(form.breed),
        sex: form.sex,
        birthDate: opt(form.birthDate),
        weight: form.weight.trim() ? Number(form.weight.replace(",", ".")) : undefined,
        neutered: form.neutered,
        color: opt(form.color),
        microchip: opt(form.microchip),
        active: form.active,
        notes: opt(form.notes),
      });
      onSaved(saved);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar el paciente.");
      setSubmitting(false);
    }
  }

  const err = (k: string) => errors[k];

  return (
    <Modal
      title={`Editar ${patient.code}`}
      subtitle="Actualiza los datos clínicos. El propietario se gestiona desde el módulo de pacientes (alta)."
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

          <div className="form-grid">
            <div className="field">
              <label htmlFor="pe-name">Nombre *</label>
              <input
                id="pe-name"
                className="input"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                aria-invalid={!!err("name")}
                autoComplete="off"
              />
              {err("name") ? <span className="field-error">{err("name")}</span> : null}
            </div>
            <div className="field">
              <label htmlFor="pe-species">Especie *</label>
              <select
                id="pe-species"
                className="select"
                value={form.species}
                onChange={(e) => set("species", e.target.value)}
                aria-invalid={!!err("species")}
              >
                <option value="">Seleccionar…</option>
                {SPECIES_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {err("species") ? <span className="field-error">{err("species")}</span> : null}
            </div>
            <div className="field">
              <label htmlFor="pe-breed">
                Raza <span className="opt">(opcional)</span>
              </label>
              <input
                id="pe-breed"
                className="input"
                value={form.breed}
                onChange={(e) => set("breed", e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label htmlFor="pe-sex">Sexo</label>
              <select
                id="pe-sex"
                className="select"
                value={form.sex}
                onChange={(e) => set("sex", e.target.value === "F" ? "F" : "M")}
              >
                <option value="M">♂ Macho</option>
                <option value="F">♀ Hembra</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="pe-birth">
                Fecha de nacimiento <span className="opt">(opcional)</span>
              </label>
              <input
                id="pe-birth"
                className="input"
                type="date"
                value={form.birthDate}
                onChange={(e) => set("birthDate", e.target.value)}
                aria-invalid={!!err("birthDate")}
              />
              {err("birthDate") ? <span className="field-error">{err("birthDate")}</span> : null}
            </div>
            <div className="field">
              <label htmlFor="pe-weight">
                Peso <span className="opt">(kg, opcional)</span>
              </label>
              <input
                id="pe-weight"
                className="input"
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                value={form.weight}
                onChange={(e) => set("weight", e.target.value)}
                aria-invalid={!!err("weight")}
              />
              {err("weight") ? <span className="field-error">{err("weight")}</span> : null}
            </div>
            <div className="field">
              <label htmlFor="pe-color">
                Color <span className="opt">(opcional)</span>
              </label>
              <input
                id="pe-color"
                className="input"
                value={form.color}
                onChange={(e) => set("color", e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="field">
              <label htmlFor="pe-chip">
                Microchip <span className="opt">(opcional)</span>
              </label>
              <input
                id="pe-chip"
                className="input"
                value={form.microchip}
                onChange={(e) => set("microchip", e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="field col-2">
              <label htmlFor="pe-notes">
                Notas clínicas <span className="opt">(opcional)</span>
              </label>
              <textarea
                id="pe-notes"
                className="textarea"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
            <div className="field col-2">
              <label className="check-row" htmlFor="pe-neutered">
                <input
                  id="pe-neutered"
                  type="checkbox"
                  checked={form.neutered}
                  onChange={(e) => set("neutered", e.target.checked)}
                />
                Esterilizado / castrado
              </label>
            </div>
            <div className="field col-2">
              <label className="check-row" htmlFor="pe-active">
                <input
                  id="pe-active"
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => set("active", e.target.checked)}
                />
                Paciente activo (en tratamiento o en seguimiento)
              </label>
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? <span className="spin" /> : null}
            {submitting ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
