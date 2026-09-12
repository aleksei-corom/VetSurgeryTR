// Cirugías: tabs por estado con contadores + búsqueda + tabla + acciones:
// programar (alta), detalle (materiales, estado, controles postoperatorios).
import { useMemo, useState } from "react";
import { SURGERY_STATUSES, SURGERY_STATUS_META, type SurgeryStatus } from "@/types";
import { listSurgeries } from "@/lib/ipc";
import { fmtDateTime } from "@/lib/format";
import { useAsync, useDebounced } from "@/lib/use-async";
import { useToast } from "./ui";
import SurgeryFormDialog from "./SurgeryFormDialog";
import SurgeryDetailDialog from "./SurgeryDetailDialog";
import {
  IconActivity,
  IconAlert,
  IconChevronRight,
  IconPlus,
  IconRefresh,
  IconSearch,
} from "./icons";

type Tab = "TODAS" | SurgeryStatus;

const TABS: { id: Tab; label: string }[] = [
  { id: "TODAS", label: "Todas" },
  ...SURGERY_STATUSES.map((s) => ({ id: s as Tab, label: SURGERY_STATUS_META[s].label })),
];

function StatusBadge({ status }: { status: string }) {
  const meta = SURGERY_STATUS_META[status as SurgeryStatus];
  return (
    <span className={`badge badge-${meta?.badge ?? "secondary"}`}>
      <span className="dot" aria-hidden="true" />
      {meta?.label ?? status}
    </span>
  );
}

export default function SurgeriesView() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("TODAS");
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 250);
  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const { data, loading, error, reload } = useAsync(() => listSurgeries({}), []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { TODAS: data?.length ?? 0 };
    for (const s of SURGERY_STATUSES) c[s] = 0;
    for (const s of data ?? []) if (c[s.status] != null) c[s.status] += 1;
    return c;
  }, [data]);

  const rows = useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase();
    return (data ?? []).filter((s) => {
      if (tab !== "TODAS" && s.status !== tab) return false;
      if (!needle) return true;
      const hay = [s.code, s.patient.name, s.procedureType, s.patient.owner.fullName].join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [data, tab, debouncedQ]);

  return (
    <div>
      {/* ---------- Tabs + búsqueda ---------- */}
      <div className="tabs" role="tablist" aria-label="Filtrar cirugías por estado">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? "tab active" : "tab"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            <span className="tab-count">{counts[t.id] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <div className="search-box">
          <IconSearch size={16} />
          <label htmlFor="q-surgeries" className="sr-only">
            Buscar cirugías
          </label>
          <input
            id="q-surgeries"
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por código, paciente, procedimiento o propietario…"
            autoComplete="off"
          />
        </div>
        <button
          type="button"
          className="btn btn-outline"
          onClick={reload}
          aria-label="Recargar cirugías"
          title="Recargar"
        >
          <IconRefresh size={16} />
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
          <IconPlus size={16} /> Programar cirugía
        </button>
      </div>

      {/* ---------- Tabla ---------- */}
      {loading ? (
        <div className="card">
          <div className="loading-row">
            <span className="spin" /> Cargando agenda quirúrgica…
          </div>
        </div>
      ) : error ? (
        <div className="card">
          <div className="state state-error">
            <IconAlert size={28} />
            <h3>No se pudo cargar las cirugías</h3>
            <p>{error}</p>
            <div className="actions">
              <button type="button" className="btn btn-outline" onClick={reload}>
                <IconRefresh size={16} /> Reintentar
              </button>
            </div>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <div className="state">
            <IconActivity size={28} />
            <h3>Sin cirugías</h3>
            <p>
              {tab === "TODAS"
                ? "Aún no hay cirugías registradas."
                : `No hay cirugías en estado ${SURGERY_STATUS_META[tab as SurgeryStatus]?.label ?? tab}.`}
            </p>
            <div className="actions">
              <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
                <IconPlus size={16} /> Programar la primera cirugía
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Listado de cirugías</caption>
            <thead>
              <tr>
                <th>Código</th>
                <th>Paciente</th>
                <th>Procedimiento</th>
                <th>Veterinario</th>
                <th>Fecha programada</th>
                <th>Estado</th>
                <th className="num">Materiales</th>
                <th aria-label="Abrir" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr
                  key={s.id}
                  className="row-click"
                  tabIndex={0}
                  onClick={() => setOpenId(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenId(s.id);
                    }
                  }}
                  aria-label={`Abrir detalle de ${s.code}`}
                >
                  <td data-label="Código" className="mono">
                    {s.code}
                  </td>
                  <td data-label="Paciente">
                    <span className="cell-main">{s.patient.name}</span>
                    <div className="cell-sub">
                      {s.patient.code} · {s.patient.species}
                      {s.patient.owner ? ` · ${s.patient.owner.fullName}` : ""}
                    </div>
                  </td>
                  <td data-label="Procedimiento">
                    <span className="cell-main">{s.procedureType}</span>
                    {(s.bodyRegion || s.laterality) && (
                      <div className="cell-sub">
                        {[s.bodyRegion, s.laterality].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </td>
                  <td data-label="Veterinario">
                    {s.vet ? s.vet.fullName : <span className="muted">—</span>}
                  </td>
                  <td data-label="Fecha programada">{fmtDateTime(s.scheduledAt)}</td>
                  <td data-label="Estado">
                    <StatusBadge status={s.status} />
                  </td>
                  <td data-label="Materiales" className="num">
                    {s.materialsCount}
                    {s.materialsCost > 0 ? (
                      <div className="cell-sub">{Math.round(s.materialsCost).toLocaleString("es-CO")}</div>
                    ) : null}
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
        {rows.length} de {data?.length ?? 0} cirugía(s) · haz clic en una fila para gestionarla
      </p>

      {/* ---------- Diálogos ---------- */}
      {showForm ? (
        <SurgeryFormDialog
          onClose={() => setShowForm(false)}
          onCreated={(created) => {
            setShowForm(false);
            toast.success(`Cirugía ${created.code} programada.`);
            reload();
          }}
        />
      ) : null}

      {openId != null ? (
        <SurgeryDetailDialog
          surgeryId={openId}
          onClose={() => setOpenId(null)}
          onChanged={reload}
        />
      ) : null}
    </div>
  );
}
