// Alta de paciente en modal (validación manual; el propietario se reutiliza
// por documento único → upsert gestionado por el backend en create_patient).
import { useState, type FormEvent } from "react";
import {
  DOCUMENT_TYPES,
  SPECIES_OPTIONS,
  type CreatePatientInput,
  type Patient,
} from "@/types";
import { createPatient, listOwners } from "@/lib/ipc";
import { Modal } from "./ui";
import { IconAlert, IconPlus } from "./icons";

interface FormState {
  docType: string;
  docNumber: string;
  ownerName: string;
  ownerPhone: string;
  ownerCity: string;
  name: string;
  species: string;
  breed: string;
  sex: string;
  birthDate: string;
  weight: string;
  color: string;
  microchip: string;
  neutered: boolean;
  notes: string;
}

const EMPTY_FORM: FormState = {
  docType: "CC",
  docNumber: "",
  ownerName: "",
  ownerPhone: "",
  ownerCity: "",
  name: "",
  species: "",
  breed: "",
  sex: "M",
  birthDate: "",
  weight: "",
  color: "",
  microchip: "",
  neutered: false,
  notes: "",
};

type Errors = Partial<Record<keyof FormState, string>>;

interface PatientFormDialogProps {
  onClose: () => void;
  onCreated: (p: Patient) => void;
}

export default function PatientFormDialog({ onClose, onCreated }: PatientFormDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [ownerHint, setOwnerHint] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  /** Al salir del campo documento: busca el propietario (upsert visual). */
  async function lookupOwner() {
    const doc = form.docNumber.trim();
    if (!doc) return;
    try {
      const owners = await listOwners(doc);
      const exact = owners.find((o) => o.documentNumber === doc);
      if (exact) {
        setForm((f) => ({
          ...f,
          ownerName: f.ownerName.trim() || exact.fullName,
          ownerPhone: f.ownerPhone.trim() || (exact.phone ?? ""),
          ownerCity: f.ownerCity.trim() || (exact.city ?? ""),
        }));
        setOwnerHint(
          `Propietario existente (${exact.documentType} ${exact.documentNumber}): sus datos se actualizarán.`,
        );
      } else {
        setOwnerHint(null);
      }
    } catch {
      setOwnerHint(null); // la búsqueda es best-effort
    }
  }

  function validate(): boolean {
    const e: Errors = {};
    const doc = form.docNumber.trim();
    const ownerName = form.ownerName.trim();
    const name = form.name.trim();

    if (!doc) e.docNumber = "El número de documento es requerido.";
    else if (!/^[0-9A-Za-z.-]{5,20}$/.test(doc))
      e.docNumber = "Entre 5 y 20 caracteres (letras, números, punto o guion).";
    if (!ownerName) e.ownerName = "El nombre del propietario es requerido.";
    if (!name) e.name = "El nombre del paciente es requerido.";
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
      else if (w > 2000) e.weight = "¿Seguro? Revisa el peso en kg.";
    }

    setErrors(e);
    return Object.values(e).every((v) => !v);
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setFormError(null);
    if (!validate()) return;

    const weight = form.weight.trim() ? Number(form.weight.replace(",", ".")) : undefined;
    const opt = (v: string) => (v.trim() === "" ? undefined : v.trim());

    const input: CreatePatientInput = {
      owner: {
        documentType: form.docType,
        documentNumber: form.docNumber.trim(),
        fullName: form.ownerName.trim(),
        phone: opt(form.ownerPhone),
        city: opt(form.ownerCity),
      },
      name: form.name.trim(),
      species: form.species,
      breed: opt(form.breed),
      sex: form.sex === "F" ? "F" : "M",
      birthDate: opt(form.birthDate),
      weight,
      neutered: form.neutered,
      color: opt(form.color),
      microchip: opt(form.microchip),
      notes: opt(form.notes),
    };

    setSubmitting(true);
    try {
      const patient = await createPatient(input);
      onCreated(patient);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo crear el paciente.");
      setSubmitting(false);
    }
  }

  const err = (k: keyof FormState) => errors[k];

  return (
    <Modal
      title="Nuevo paciente"
      subtitle="El propietario se reutiliza por documento único (upsert automático)."
      onClose={onClose}
      width={760}
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
            <h3>Propietario</h3>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="f-docType">Tipo de documento</label>
                <select
                  id="f-docType"
                  className="select"
                  value={form.docType}
                  onChange={(e) => set("docType", e.target.value)}
                >
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="f-docNumber">
                  Nº de documento <span className="opt">(único)</span>
                </label>
                <input
                  id="f-docNumber"
                  className="input"
                  value={form.docNumber}
                  onChange={(e) => set("docNumber", e.target.value)}
                  onBlur={lookupOwner}
                  aria-invalid={!!err("docNumber")}
                  placeholder="1032456789"
                  autoComplete="off"
                />
                {err("docNumber") ? <span className="field-error">{err("docNumber")}</span> : null}
              </div>
              <div className="field">
                <label htmlFor="f-ownerName">Nombre completo</label>
                <input
                  id="f-ownerName"
                  className="input"
                  value={form.ownerName}
                  onChange={(e) => set("ownerName", e.target.value)}
                  aria-invalid={!!err("ownerName")}
                  placeholder="Diana Carolina Restrepo"
                  autoComplete="off"
                />
                {err("ownerName") ? <span className="field-error">{err("ownerName")}</span> : null}
              </div>
              <div className="field">
                <label htmlFor="f-ownerPhone">
                  Teléfono <span className="opt">(WhatsApp)</span>
                </label>
                <input
                  id="f-ownerPhone"
                  className="input"
                  value={form.ownerPhone}
                  onChange={(e) => set("ownerPhone", e.target.value)}
                  placeholder="+57 310 456 7890"
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="f-ownerCity">
                  Ciudad <span className="opt">(opcional)</span>
                </label>
                <input
                  id="f-ownerCity"
                  className="input"
                  value={form.ownerCity}
                  onChange={(e) => set("ownerCity", e.target.value)}
                  placeholder="Medellín"
                  autoComplete="off"
                />
              </div>
            </div>
            {ownerHint ? <p className="field-hint ok mt-2">✓ {ownerHint}</p> : null}
          </div>

          <div className="form-section">
            <h3>Paciente</h3>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="f-name">Nombre</label>
                <input
                  id="f-name"
                  className="input"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  aria-invalid={!!err("name")}
                  placeholder="Rocky"
                  autoComplete="off"
                />
                {err("name") ? <span className="field-error">{err("name")}</span> : null}
              </div>
              <div className="field">
                <label htmlFor="f-species">Especie</label>
                <select
                  id="f-species"
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
                <label htmlFor="f-breed">
                  Raza <span className="opt">(opcional)</span>
                </label>
                <input
                  id="f-breed"
                  className="input"
                  value={form.breed}
                  onChange={(e) => set("breed", e.target.value)}
                  placeholder="Golden Retriever"
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="f-sex">Sexo</label>
                <select
                  id="f-sex"
                  className="select"
                  value={form.sex}
                  onChange={(e) => set("sex", e.target.value)}
                >
                  <option value="M">♂ Macho</option>
                  <option value="F">♀ Hembra</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="f-birthDate">
                  Fecha de nacimiento <span className="opt">(opcional)</span>
                </label>
                <input
                  id="f-birthDate"
                  className="input"
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => set("birthDate", e.target.value)}
                  aria-invalid={!!err("birthDate")}
                />
                {err("birthDate") ? <span className="field-error">{err("birthDate")}</span> : null}
              </div>
              <div className="field">
                <label htmlFor="f-weight">
                  Peso <span className="opt">(kg, opcional)</span>
                </label>
                <input
                  id="f-weight"
                  className="input"
                  type="number"
                  step="any"
                  min="0"
                  inputMode="decimal"
                  value={form.weight}
                  onChange={(e) => set("weight", e.target.value)}
                  aria-invalid={!!err("weight")}
                  placeholder="28.5"
                />
                {err("weight") ? <span className="field-error">{err("weight")}</span> : null}
              </div>
              <div className="field">
                <label htmlFor="f-color">
                  Color <span className="opt">(opcional)</span>
                </label>
                <input
                  id="f-color"
                  className="input"
                  value={form.color}
                  onChange={(e) => set("color", e.target.value)}
                  placeholder="Dorado"
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="f-microchip">
                  Microchip <span className="opt">(opcional)</span>
                </label>
                <input
                  id="f-microchip"
                  className="input"
                  value={form.microchip}
                  onChange={(e) => set("microchip", e.target.value)}
                  placeholder="985113001234567"
                  autoComplete="off"
                />
              </div>
              <div className="field col-2">
                <label htmlFor="f-notes">
                  Notas clínicas <span className="opt">(opcional)</span>
                </label>
                <textarea
                  id="f-notes"
                  className="textarea"
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Alergias, medicación actual…"
                />
              </div>
              <div className="field col-2">
                <label className="check-row" htmlFor="f-neutered">
                  <input
                    id="f-neutered"
                    type="checkbox"
                    checked={form.neutered}
                    onChange={(e) => set("neutered", e.target.checked)}
                  />
                  Esterilizado / castrado
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <span className="muted" style={{ marginRight: "auto", fontSize: 12.5 }}>
            Código PAC-AAAA-NNNN asignado automáticamente.
          </span>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? <span className="spin" /> : <IconPlus size={16} />}
            {submitting ? "Guardando…" : "Crear paciente"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
