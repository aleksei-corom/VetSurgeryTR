// VetSurgeryTR — Documentos imprimibles clínicos.
//
// Cada documento se genera como HTML autónomo (con sus estilos inline) y se
// imprime desde un <iframe> oculto: así sale SOLO el documento en el papel —
// sin el sidebar, header ni tema de la app — usando el diálogo nativo del
// sistema (imprimir en papel o guardar como PDF).
//
// Documentos: consentimiento informado, fórmula médica post-quirúrgica,
// historia clínica de cirugía e historia clínica del paciente.
import type { ClinicSettings, PatientDetail, SurgeryDetail } from "@/types";
import { fmtCOP, fmtDate, fmtDateTime, fmtQty } from "./format";
import { getClinicSettings } from "./ipc";

/** Los datos del paciente que viajan dentro de una SurgeryDetail (subconjunto
 *  con el propietario anidado que produce el backend Rust). */
interface PatientOfSurgery {
  name: string;
  code: string;
  species: string;
  breed: string | null;
  sex: string;
  birthDate: string | null;
  weight: number | null;
  owner: { fullName: string; phone: string | null; city: string | null };
}

/* ------------------------------ Utilidades -------------------------------- */

function esc(v: string | null | undefined): string {
  if (v == null || v === "") return "—";
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** Identidad de la clínica para los documentos. Se carga una vez (cacheada):
 *  si el admin la cambia, los documentos siguientes ya salen con la nueva
 *  identidad. Si la consulta falla, se usa el nombre genérico de la app. */
const DEFAULT_CLINIC: ClinicSettings = {
  clinicName: "VetSurgeryTR · Cirugía Ortopédica Veterinaria",
  taxId: null,
  address: null,
  phone: null,
  email: null,
  license: null,
  logoDataUrl: null,
  updatedAt: null,
};
let clinicCache: ClinicSettings | null = null;

async function loadClinic(): Promise<ClinicSettings> {
  if (!clinicCache) {
    try {
      clinicCache = { ...DEFAULT_CLINIC, ...(await getClinicSettings()) };
    } catch {
      clinicCache = DEFAULT_CLINIC;
    }
  }
  return clinicCache;
}

/** Documento clínico generado, listo para previsualizar o imprimir. */
export interface PrintDoc {
  title: string;
  html: string;
  /** Nombre del documento para la bitácora de impresiones
   *  (p. ej. «Consentimiento informado»). */
  document: string;
  /** Código de la entidad de origen (CIR-…/PAC-…) para la bitácora. */
  entityCode: string;
  /** ID de la cirugía o del paciente, si aplica (informativo). */
  entityId: number | null;
}

/** Abre el diálogo de impresión del sistema con `html` SOLO en el papel. */
export function printHtml(_title: string, html: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();

  // Dar un tick para que el iframe cargue el DOM antes de invocar el diálogo.
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      // Limpiar después de que el diálogo tenga el contenido (Safari/Chrome
      // necesitan un margen; Firefox es inmediato).
      window.setTimeout(() => iframe.remove(), 60_000);
    }
  };
}

/** Base común de estilos: papel A4, tipografía serifa, encabezado/pie.
 *  El encabezado lleva la identidad real de la clínica (nombre, NIT,
 *  dirección, teléfono, correo, licencia y logo si existen). */
function docShell(clinic: ClinicSettings, title: string, body: string): string {
  const name = esc(clinic.clinicName);
  const contact = [clinic.address, clinic.phone, clinic.email]
    .filter(Boolean)
    .map((v) => esc(v));
  const identity = [clinic.taxId, clinic.license]
    .filter(Boolean)
    .map((v) => esc(v));
  const logo = clinic.logoDataUrl
    ? `<img class="logo" src="${clinic.logoDataUrl}" alt="Logo de la clínica" />`
    : "";
  const clinicBlock = `${logo}<div class="clinic">${name}
      ${contact.length || identity.length ? `<small>${[...identity, ...contact].join(" · ")}</small>` : ""}
    </div>`;
  return `<!doctype html>
<html lang="es-CO">
<head>
<meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Georgia, "Times New Roman", serif;
    color: #1a1a1a; font-size: 11.5pt; line-height: 1.5; margin: 0;
  }
  .doc-head {
    display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 2.5px solid #0e6f64; padding-bottom: 8px; margin-bottom: 18px;
  }
  .doc-head .clinic { font-size: 13pt; font-weight: bold; color: #0e6f64; }
  .doc-head .clinic small { display: block; font-weight: normal; font-size: 9.5pt; color: #444; }
  .doc-head .logo { max-height: 60px; max-width: 180px; margin-right: 12px; }
  .doc-head > div:first-child { display: flex; align-items: center; }
  .doc-head .doc-type { text-align: right; font-size: 9.5pt; color: #444; }
  .doc-head .doc-type b { display: block; font-size: 12pt; color: #1a1a1a; }
  h2 {
    font-size: 11pt; text-transform: uppercase; letter-spacing: 0.06em;
    color: #0e6f64; border-bottom: 1px solid #c9d6d3; padding-bottom: 3px;
    margin: 18px 0 8px;
  }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 12px; }
  th, td { border: 1px solid #b9c8c4; padding: 5px 8px; text-align: left; vertical-align: top; font-size: 10.5pt; }
  th { background: #eef4f2; font-weight: bold; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 24px; }
  .kv { margin: 0; }
  .kv b { color: #333; }
  .note {
    background: #f4f8f7; border: 1px solid #d5e2df; border-radius: 6px;
    padding: 10px 12px; margin: 8px 0 14px; white-space: pre-wrap;
  }
  .sign {
    display: flex; justify-content: space-between; gap: 40px; margin-top: 56px;
  }
  .sign div { flex: 1; border-top: 1.5px solid #1a1a1a; padding-top: 6px; text-align: center; font-size: 10pt; }
  .sign span { display: block; color: #444; }
  .fine { font-size: 8.8pt; color: #555; line-height: 1.45; }
  .meds li { margin-bottom: 6px; }
  .foot {
    margin-top: 26px; border-top: 1px solid #c9d6d3; padding-top: 6px;
    font-size: 8.5pt; color: #666; display: flex; justify-content: space-between;
  }
</style>
</head>
<body>
  <div class="doc-head">
    <div>${clinicBlock}</div>
    <div class="doc-type">${esc(title.split("·")[0] ?? title)}<b>${esc(title.split("·").slice(1).join("·").trim() || "")}</b></div>
  </div>
  ${body}
  <div class="foot">
    <span>${name} · historial clínico digital</span>
    <span>Documento informativo — conservar en la historia clínica</span>
  </div>
</body>
</html>`;
}

function patientBlock(p: PatientOfSurgery): string {
  return `
  <h2>Paciente y propietario</h2>
  <div class="grid-3">
    <p class="kv"><b>Paciente:</b> ${esc(p.name)} (${esc(p.code)})</p>
    <p class="kv"><b>Especie / raza:</b> ${esc(p.species)}${p.breed ? ` / ${esc(p.breed)}` : ""}</p>
    <p class="kv"><b>Sexo:</b> ${p.sex === "M" ? "Macho" : "Hembra"}</p>
    <p class="kv"><b>Nacimiento:</b> ${p.birthDate ? fmtDate(p.birthDate) : "—"}</p>
    <p class="kv"><b>Peso:</b> ${p.weight != null ? `${fmtQty(p.weight)} kg` : "—"}</p>
    <p class="kv"><b>Propietario:</b> ${esc(p.owner.fullName)}${p.owner.phone ? ` · ${esc(p.owner.phone)}` : ""}</p>
  </div>`;
}

function surgeryBlock(s: SurgeryDetail): string {
  return `
  <h2>Procedimiento quirúrgico</h2>
  <div class="grid-3">
    <p class="kv"><b>Código:</b> ${esc(s.code)}</p>
    <p class="kv"><b>Procedimiento:</b> ${esc(s.procedureType)}</p>
    <p class="kv"><b>Estado:</b> ${esc(s.status)}</p>
    <p class="kv"><b>Fecha programada:</b> ${fmtDateTime(s.scheduledAt)}</p>
    <p class="kv"><b>Región / lateralidad:</b> ${esc(s.bodyRegion)} / ${esc(s.laterality)}</p>
    <p class="kv"><b>Duración estimada:</b> ${s.durationMin != null ? `${s.durationMin} min` : "—"}</p>
    <p class="kv"><b>Anestesia:</b> ${esc(s.anesthesiaType)}${s.asaRisk ? ` · ASA ${s.asaRisk}` : ""}</p>
    <p class="kv"><b>Cirujano responsable:</b> ${s.vet ? `MV. ${esc(s.vet.fullName)}` : "—"}${s.vet?.specialty ? ` (${esc(s.vet.specialty)})` : ""}</p>
    <p class="kv"><b>Costo estimado:</b> ${s.estimatedCost != null ? fmtCOP(s.estimatedCost) : "—"}</p>
  </div>
  ${
    s.presumptiveDiagnosis || s.definitiveDiagnosis
      ? `<h2>Diagnóstico</h2>
  ${s.presumptiveDiagnosis ? `<p class="kv"><b>Presuntivo (motivo quirúrgico):</b> ${esc(s.presumptiveDiagnosis)}</p>` : ""}
  ${s.definitiveDiagnosis ? `<p class="kv"><b>Definitivo (hallazgo confirmado):</b> ${esc(s.definitiveDiagnosis)}</p>` : ""}`
      : ""
  }
  ${s.description ? `<h2>Descripción</h2><div class="note">${esc(s.description)}</div>` : ""}
  ${s.preoperativeNotes ? `<h2>Notas preoperatorias</h2><div class="note">${esc(s.preoperativeNotes)}</div>` : ""}
  ${s.postoperativeNotes ? `<h2>Notas postoperatorias / hallazgos</h2><div class="note">${esc(s.postoperativeNotes)}</div>` : ""}
  ${
    s.materials.length
      ? `<h2>Implantes, materiales y medicamentos usados</h2>
  <table>
    <thead><tr><th>Material / medicamento</th><th>Cant. planificada</th><th>Cant. usada</th><th>Notas</th></tr></thead>
    <tbody>
      ${s.materials
        .map(
          (m) => `<tr>
        <td>${esc(m.item.name)} <small>(${esc(m.item.code)})</small></td>
        <td>${fmtQty(m.qtyPlanned)} ${esc(m.item.unit)}</td>
        <td>${m.qtyUsed != null ? `${fmtQty(m.qtyUsed)} ${esc(m.item.unit)}` : "—"}</td>
        <td>${esc(m.notes)}</td>
      </tr>`,
        )
        .join("\n")}
    </tbody>
  </table>`
      : ""
  }
  ${
    s.follow_ups.length
      ? `<h2>Controles postoperatorios</h2>
  <table>
    <thead><tr><th>Fecha</th><th>Tipo</th><th>Estado</th><th>Notas</th></tr></thead>
    <tbody>
      ${s.follow_ups
        .map(
          (f) => `<tr>
        <td>${fmtDate(f.scheduledDate)}</td>
        <td>${esc(FOLLOW_UP_LABEL[f.type] ?? f.type)}</td>
        <td>${f.status === "CUMPLIDO" ? `Cumplido${f.doneAt ? ` (${fmtDate(f.doneAt)})` : ""}` : f.status === "PENDIENTE" ? "Pendiente" : "Perdido"}</td>
        <td>${esc(f.notes)}</td>
      </tr>`,
        )
        .join("\n")}
    </tbody>
  </table>`
      : ""
  }`;
}

const FOLLOW_UP_LABEL: Record<string, string> = {
  CONTROL_RADIOGRAFICO: "Control radiográfico",
  CURACION: "Curación de herida",
  RETIRO_PUNTOS: "Retiro de puntos",
  EVALUACION: "Evaluación clínica",
  RETIRO_IMPLANTES: "Retiro de implantes",
};

/* ========================= 1) CONSENTIMIENTO INFORMADO ===================== */

export async function buildConsentimiento(detail: SurgeryDetail): Promise<PrintDoc> {
  const s: SurgeryDetail = detail;
  const body = `
  <p class="fine">
    El presente documento certifica que el propietario ha sido informado de forma clara y
    suficiente sobre el procedimiento quirúrgico propuesto para su paciente, sus riesgos,
    beneficios y alternativas, y <b>autoriza voluntariamente</b> su realización, incluyendo la
    administración de anestesia/ sedación y la aplicación de los medicamentos e implantes que
    el profesional considere necesarios durante el acto quirúrgico y su recuperación.
  </p>

  ${patientBlock(s.patient)}

  <h2>Procedimiento autorizado</h2>
  <div class="grid-3">
    <p class="kv"><b>Código:</b> ${esc(s.code)}</p>
    <p class="kv"><b>Procedimiento:</b> ${esc(s.procedureType)}</p>
    <p class="kv"><b>Fecha:</b> ${fmtDateTime(s.scheduledAt)}</p>
    <p class="kv"><b>Región / lateralidad:</b> ${esc(s.bodyRegion)} / ${esc(s.laterality)}</p>
    <p class="kv"><b>Anestesia:</b> ${esc(s.anesthesiaType)}${s.asaRisk ? ` · Riesgo ASA ${s.asaRisk}` : ""}</p>
    <p class="kv"><b>Cirujano:</b> ${s.vet ? `MV. ${esc(s.vet.fullName)}` : "—"}</p>
  </div>
  ${s.description ? `<div class="note">${esc(s.description)}</div>` : ""}
  ${
    s.presumptiveDiagnosis
      ? `<h2>Diagnóstico presuntivo</h2>
  <div class="note">${esc(s.presumptiveDiagnosis)}</div>`
      : ""
  }

  <h2>Riesgos conocidos</h2>
  <p class="fine">
    Toda intervención quirúrgica y toda anestesia conllevan riesgos: reacciones adversas a
    medicamentos o anestésicos, hemorragia, infección, dehiscencia de la herida, retardo en la
    consolidación ósea, falla o migración del implante, fractura intraoperatoria, necesidad de
    una segunda cirugía y, en casos excepcionales, la muerte del paciente. El equipo médico
    adoptará todas las medidas razonables para prevenirlos y actuará de inmediato ante
    cualquier complicación. En caso de emergencia durante el procedimiento, autorizo las
    maniobras de reanimación y estabilización que se requieran.
  </p>
  <p class="fine">
    Me comprometo a cumplir las indicaciones postoperatorias (reposo, curaciones,
    medicamentos, controles y radiografías de seguimiento). La falta de adherencia puede
    comprometer el resultado de la cirugía.
  </p>

  <div class="sign">
    <div><span>Firma del propietario</span>${esc(s.patient.owner.fullName)}<span>Documento de identidad</span></div>
    <div><span>Médico veterinario</span>${s.vet ? `MV. ${esc(s.vet.fullName)}` : "________________"}<span>${esc(s.vet?.specialty ?? "Cirugía veterinaria")}</span></div>
  </div>`;

  const clinic = await loadClinic();
  const title = `Consentimiento informado · ${s.code}`;
  return { title, html: docShell(clinic, title, body), document: "Consentimiento informado", entityCode: s.code, entityId: s.id };
}

export async function printConsentimiento(detail: SurgeryDetail): Promise<void> {
  const doc = await buildConsentimiento(detail);
  printHtml(doc.title, doc.html);
}

/* ====================== 2) FÓRMULA MÉDICA POSTQUIRÚRGICA ================== */

/** Fórmula médica postquirúrgica: se alimenta de las notas postoperatorias
 *  (indicaciones) y de los materiales/medicamentos usados en la cirugía. */
export async function buildFormulaMedica(detail: SurgeryDetail): Promise<PrintDoc> {
  const s: SurgeryDetail = detail;
  const meds = s.materials.filter(
    (m) =>
      m.item.category === "MEDICAMENTOS" ||
      m.item.category === "INSUMOS" ||
      m.qtyUsed != null,
  );

  const body = `
  ${patientBlock(s.patient)}

  <h2>Procedimiento realizado</h2>
  <div class="grid-3">
    <p class="kv"><b>Código:</b> ${esc(s.code)}</p>
    <p class="kv"><b>Procedimiento:</b> ${esc(s.procedureType)}</p>
    <p class="kv"><b>Fecha:</b> ${s.completedAt ? fmtDateTime(s.completedAt) : fmtDateTime(s.scheduledAt)}</p>
    <p class="kv"><b>Región / lateralidad:</b> ${esc(s.bodyRegion)} / ${esc(s.laterality)}</p>
    <p class="kv"><b>Anestesia:</b> ${esc(s.anesthesiaType)}</p>
    <p class="kv"><b>Cirujano:</b> ${s.vet ? `MV. ${esc(s.vet.fullName)}` : "—"}</p>
  </div>

  <h2>Medicamentos e insumos prescritos</h2>
  ${
    meds.length
      ? `<table>
    <thead><tr><th>#</th><th>Medicamento / insumo</th><th>Presentación (categoría)</th><th>Indicación de uso</th></tr></thead>
    <tbody>
      ${meds
        .map(
          (m, i) => `<tr>
        <td>${i + 1}</td>
        <td><b>${esc(m.item.name)}</b></td>
        <td>${esc(m.item.category)}${m.item.size ? ` · ${esc(m.item.size)}` : ""}</td>
        <td>${esc(m.notes)}</td>
      </tr>`,
        )
        .join("\n")}
    </tbody>
  </table>`
      : `<div class="note">Según notas postoperatorias.</div>`
  }

  ${
    s.definitiveDiagnosis
      ? `<h2>Diagnóstico definitivo</h2>
  <p class="kv">${esc(s.definitiveDiagnosis)}</p>`
      : ""
  }
  ${s.postoperativeNotes ? `<h2>Indicaciones generales</h2><div class="note">${esc(s.postoperativeNotes)}</div>` : ""}

  <h2>Recomendaciones</h2>
  <ul class="fine meds">
    <li>Administrar la medicación completa a las horas indicadas, aunque el paciente parezca recuperado.</li>
    <li>Reposo relativo 2–4 semanas: paseos cortos con correa; evitar saltos, juegos bruscos y escaleras.</li>
    <li>Mantener la herida limpia y seca; impedir lamerse o morderse la zona (uso de collar isabelino si es necesario).</li>
    <li>Acudir de inmediato si observa: inflamación o secreción abundante, fiebre, inapetencia mayor a 24 h, cojera que empeora o apertura de la herida.</li>
    <li>Asistir a los controles postoperatorios programados (curaciones, retiro de puntos y radiografías de control).</li>
  </ul>

  <div class="sign">
    <div><span>Médico veterinario tratante</span>${s.vet ? `MV. ${esc(s.vet.fullName)}` : "________________"}<span>${esc(s.vet?.specialty ?? "")}</span></div>
    <div><span>Recibido por (propietario)</span>${esc(s.patient.owner.fullName)}<span></span></div>
  </div>`;

  const clinic = await loadClinic();
  const title = `Fórmula médica · ${s.code}`;
  return { title, html: docShell(clinic, title, body), document: "Fórmula médica postquirúrgica", entityCode: s.code, entityId: s.id };
}

export async function printFormulaMedica(detail: SurgeryDetail): Promise<void> {
  const doc = await buildFormulaMedica(detail);
  printHtml(doc.title, doc.html);
}

/* ==================== 3) HISTORIA CLÍNICA DE LA CIRUGÍA ==================== */

export async function buildHistoriaCirugia(detail: SurgeryDetail): Promise<PrintDoc> {
  const s: SurgeryDetail = detail;
  const body = `
  ${patientBlock(s.patient)}
  ${surgeryBlock(detail)}

  <div class="sign">
    <div><span>Médico veterinario</span>${s.vet ? `MV. ${esc(s.vet.fullName)}` : "________________"}<span>${esc(s.vet?.specialty ?? "")}</span></div>
    <div><span>Elaborado / revisado</span><span>${fmtDateTime(s.updatedAt)}</span></div>
  </div>`;

  const clinic = await loadClinic();
  const title = `Historia clínica quirúrgica · ${s.code}`;
  return { title, html: docShell(clinic, title, body), document: "Historia clínica quirúrgica", entityCode: s.code, entityId: s.id };
}

export async function printHistoriaCirugia(detail: SurgeryDetail): Promise<void> {
  const doc = await buildHistoriaCirugia(detail);
  printHtml(doc.title, doc.html);
}

/* ==================== 4) HISTORIA CLÍNICA DEL PACIENTE ==================== */

/** Historia clínica completa del paciente: todos sus datos + el historial
 *  quirúrgico completo con hallazgos, materiales y controles. */
export async function buildHistoriaPaciente(detail: PatientDetail): Promise<PrintDoc> {
  const p: PatientDetail = detail;
  const body = `
  ${patientBlock({
    name: p.name,
    code: p.code,
    species: p.species,
    breed: p.breed,
    sex: p.sex,
    birthDate: p.birthDate,
    weight: p.weight,
    owner: { fullName: p.ownerName, phone: p.ownerPhone, city: null },
  })}

  <h2>Historial quirúrgico (${detail.surgeries.length} procedimiento${detail.surgeries.length === 1 ? "" : "s"})</h2>
  ${
    detail.surgeries.length
      ? detail.surgeries
          .map(
            (s) => `
  <table>
    <thead><tr><th colspan="2">${esc(s.code)} · ${esc(s.procedureType)}</th></tr></thead>
    <tbody>
      <tr><th style="width:30%">Fecha programada</th><td>${fmtDateTime(s.scheduledAt)} · ${esc(s.status)}</td></tr>
      <tr><th>Cirujano</th><td>${s.vet ? `MV. ${esc(s.vet.fullName)}` : "—"}</td></tr>
      <tr><th>Región / lateralidad</th><td>${esc(s.bodyRegion)} / ${esc(s.laterality)}</td></tr>
    </tbody>
  </table>`,
          )
          .join("\n")
      : `<div class="note">El paciente no registra procedimientos quirúrgicos.</div>`
  }

  <p class="fine">
    Esta historia clínica resume la información registrada en VetSurgeryTR a la fecha de
    impresión. Cualquier corrección debe realizarse desde la aplicación para mantener la
    trazabilidad (cada edición queda registrada en la bitácora de auditoría).
  </p>

  <div class="sign">
    <div><span>Médico veterinario</span>________________<span>Nombre y tarjeta profesional</span></div>
  </div>`;

  const clinic = await loadClinic();
  const title = `Historia clínica · ${p.name} (${p.code})`;
  return { title, html: docShell(clinic, title, body), document: "Historia clínica del paciente", entityCode: p.code, entityId: p.id };
}

export async function printHistoriaPaciente(detail: PatientDetail): Promise<void> {
  const doc = await buildHistoriaPaciente(detail);
  printHtml(doc.title, doc.html);
}
