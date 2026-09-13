// Pacientes: búsqueda + filtro por especie + tabla + ficha (historial
// quirúrgico) + alta y edición. Los modales usan las primitivas compartidas.
import { useState } from "react";
import { SPECIES_OPTIONS, type Patient } from "@/types";
import { getPatient, getPrintTotals, listPatients } from "@/lib/ipc";
import { fmtAge, fmtDate, fmtQty, fmtSex } from "@/lib/format";
import { useAsync, useDebounced } from "@/lib/use-async";
import { useToast } from "./ui";
import PatientFormDialog from "./PatientFormDialog";
import PatientDetailDialog from "./PatientDetailDialog";
import PatientEditDialog from "./PatientEditDialog";
import { IconAlert, IconChevronRight, IconPaw, IconPlus, IconRefresh, IconSearch } from "./icons";

export default function PatientsView() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 300);
  const [species, setSpecies] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [editPatient, setEditPatient] = useState<Patient | null>(null);

  const { data, loading, error, reload } = useAsync(
    () => listPatients({ search: debouncedQ.trim() || undefined, species: species || undefined }),
    [debouncedQ, species],
  );

  const detail = useAsync(
    () => (detailId != null ? getPatient(detailId) : Promise.resolve(null)),
    [detailId],
  );

  const patients = data ?? [];

  // Total de impresiones de documentos por código PAC- (una consulta para
  // toda la página): alimenta la columna «Impresiones». Se recarga con el
  // listado y al volver del detalle, donde se acaban de imprimir documentos.
  const printTotals = useAsync(() => getPrintTotals("PAC-"), [data]);
  const printsByCode = new Map((printTotals.data ?? []).map((t) => [t.entityCode, t.count]));

  return (
    <div>
      {/* ---------- Toolbar ---------- */}
      <div className="toolbar">
        <div className="search-box">
          <IconSearch size={16} />
          <label htmlFor="q-patients" className="sr-only">
            Buscar pacientes
          </label>
          <input
            id="q-patients"
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, código, propietario o microchip…"
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="f-species-filter" className="sr-only">
            Filtrar por especie
          </label>
          <select
            id="f-species-filter"
            className="select"
            style={{ width: 150 }}
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
          >
            <option value="">Todas las especies</option>
            {SPECIES_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn btn-outline"
          onClick={reload}
          aria-label="Recargar pacientes"
          title="Recargar"
        >
          <IconRefresh size={16} />
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
          <IconPlus size={16} /> Nuevo paciente
        </button>
      </div>

      {/* ---------- Tabla ---------- */}
      {loading ? (
        <div className="card">
          <div className="loading-row">
            <span className="spin" /> Cargando pacientes…
          </div>
        </div>
      ) : error ? (
        <div className="card">
          <div className="state state-error">
            <IconAlert size={28} />
            <h3>No se pudo cargar los pacientes</h3>
            <p>{error}</p>
            <div className="actions">
              <button type="button" className="btn btn-outline" onClick={reload}>
                <IconRefresh size={16} /> Reintentar
              </button>
            </div>
          </div>
        </div>
      ) : patients.length === 0 ? (
        <div className="card">
          <div className="state">
            <IconPaw size={28} />
            <h3>Sin resultados</h3>
            <p>
              No hay pacientes que coincidan con la búsqueda
              {species ? ` y el filtro ${species}` : ""}.
            </p>
            <div className="actions">
              <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
                <IconPlus size={16} /> Registrar el primer paciente
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Listado de pacientes</caption>
            <thead>
              <tr>
                <th>Código</th>
                <th>Paciente</th>
                <th>Especie / Raza</th>
                <th>Propietario</th>
                <th>Edad</th>
                <th className="num">Cirugías</th>
                <th className="num">Impresiones</th>
                <th>Estado</th>
                <th aria-label="Abrir" />
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr
                  key={p.id}
                  className="row-click"
                  tabIndex={0}
                  onClick={() => setDetailId(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setDetailId(p.id);
                    }
                  }}
                  aria-label={`Abrir ficha de ${p.name}`}
                >
                  <td data-label="Código" className="mono">
                    {p.code}
                  </td>
                  <td data-label="Paciente">
                    <span className="cell-main">
                      {fmtSex(p.sex)} {p.name}
                    </span>
                    {p.weight != null ? <div className="cell-sub">{fmtQty(p.weight)} kg</div> : null}
                  </td>
                  <td data-label="Especie / Raza">
                    <span className="cell-main">{p.species}</span>
                    {p.breed ? <div className="cell-sub">{p.breed}</div> : null}
                  </td>
                  <td data-label="Propietario">
                    <span className="cell-main">{p.ownerName}</span>
                    {p.ownerPhone ? <div className="cell-sub">{p.ownerPhone}</div> : null}
                  </td>
                  <td data-label="Edad" title={p.birthDate ? `Nac.: ${fmtDate(p.birthDate)}` : undefined}>
                    {p.birthDate ? (
                      <>
                        {fmtAge(p.ageMonths)}
                        <div className="cell-sub">{fmtDate(p.birthDate)}</div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td data-label="Cirugías" className="num">
                    {p.surgeryCount}
                  </td>
                  <td
                    data-label="Impresiones"
                    className="num"
                    title={printsByCode.get(p.code) ? `${printsByCode.get(p.code)} documento(s) impreso(s) para ${p.code}` : undefined}
                  >
                    {printsByCode.get(p.code) ?? "—"}
                  </td>
                  <td data-label="Estado">
                    {p.active ? (
                      <span className="badge badge-success">
                        <span className="dot" aria-hidden="true" /> Activo
                      </span>
                    ) : (
                      <span className="badge badge-secondary">Inactivo</span>
                    )}
                  </td>
                  <td data-label="" className="num">
                    <IconChevronRight size={15} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="muted mt-2" style={{ fontSize: 12.5 }}>
        {data ? `${data.length} paciente(s)` : "—"} · haz clic en una fila para abrir la ficha
      </p>

      {/* ---------- Diálogos ---------- */}
      {showForm ? (
        <PatientFormDialog
          onClose={() => setShowForm(false)}
          onCreated={(p) => {
            setShowForm(false);
            toast.success(`Paciente ${p.code} · ${p.name} creado correctamente.`);
            reload();
          }}
        />
      ) : null}

      {detailId != null ? (
        <PatientDetailDialog
          detail={detail.data}
          loading={detail.loading}
          error={detail.error}
          onClose={() => setDetailId(null)}
          onEdit={(d) => {
            setDetailId(null);
            setEditPatient(d); // PatientDetail es plano: es el propio paciente
          }}
        />
      ) : null}

      {editPatient ? (
        <PatientEditDialog
          patient={editPatient}
          onClose={() => setEditPatient(null)}
          onSaved={(p) => {
            setEditPatient(null);
            toast.success(`Paciente ${p.code} actualizado.`);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}
