// Bitácora de auditoría: quién hizo qué y cuándo en movimientos de
// inventario, cambios de estado/edición de cirugías y ediciones de pacientes.
// Datos vía ipc.listAuditLog() con filtros por entidad y búsqueda libre.
import { useState } from "react";
import type { AuditAction, AuditEntityType } from "@/types";
import { exportAuditCsv, listAuditLog } from "@/lib/ipc";
import { fmtDateTime } from "@/lib/format";
import { useAsync, useDebounced } from "@/lib/use-async";
import { useToast } from "./ui";
import {
  IconActivity,
  IconAlert,
  IconArrowDownRight,
  IconArrowUpRight,
  IconBox,
  IconEdit,
  IconPaw,
  IconPlus,
  IconRefresh,
  IconScale,
  IconDownload,
  IconSearch,
  IconShield,
} from "./icons";

const ENTITY_META: Record<
  AuditEntityType,
  { label: string; Icon: typeof IconBox }
> = {
  INVENTARIO: { label: "Inventario", Icon: IconBox },
  CIRUGIA: { label: "Cirugía", Icon: IconActivity },
  PACIENTE: { label: "Paciente", Icon: IconPaw },
  USUARIO: { label: "Usuario", Icon: IconShield },
  DOCUMENTO: { label: "Documento", Icon: IconDownload },
};

const ACTION_META: Record<
  AuditAction,
  { label: string; badge: string; Icon: typeof IconArrowUpRight }
> = {
  ENTRADA: { label: "Entrada", badge: "badge-success", Icon: IconArrowUpRight },
  SALIDA: { label: "Salida", badge: "badge-destructive", Icon: IconArrowDownRight },
  AJUSTE: { label: "Ajuste", badge: "badge-warning", Icon: IconScale },
  ESTADO: { label: "Cambio de estado", badge: "badge-secondary", Icon: IconActivity },
  EDITAR: { label: "Edición", badge: "badge-outline", Icon: IconEdit },
  CREAR: { label: "Creación", badge: "badge-success", Icon: IconPlus },
  IMPRIMIR: { label: "Impresión", badge: "badge-outline", Icon: IconDownload },
};

const ENTITIES: AuditEntityType[] = ["INVENTARIO", "CIRUGIA", "PACIENTE", "USUARIO", "DOCUMENTO"];
const ACTIONS: AuditAction[] = ["ENTRADA", "SALIDA", "AJUSTE", "ESTADO", "EDITAR", "CREAR", "IMPRIMIR"];

function actionMeta(a: string): { label: string; badge: string; Icon: typeof IconArrowUpRight } {
  return ACTION_META[a as AuditAction] ?? { label: a, badge: "badge-outline", Icon: IconEdit };
}

function entityMeta(e: string): { label: string; Icon: typeof IconBox } {
  return ENTITY_META[e as AuditEntityType] ?? { label: e, Icon: IconBox };
}

export default function AuditView() {
  const toast = useToast();
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 300);
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [exporting, setExporting] = useState(false);

  /** Selector de carpeta → CSV en Rust → toasts (mismo flujo que inventario). */
  async function handleExport() {
    setExporting(true);
    try {
      const path = await exportAuditCsv();
      if (path) toast.success(`CSV generado: ${path}`);
      // null = el usuario canceló el selector de carpeta.
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar el CSV.");
    } finally {
      setExporting(false);
    }
  }

  const { data, loading, error, reload } = useAsync(
    () =>
      listAuditLog({
        entityType: entity || undefined,
        action: action || undefined,
        search: debouncedQ.trim() || undefined,
        limit: 300,
      }),
    [debouncedQ, entity, action],
  );

  const rows = data ?? [];

  return (
    <div>
      {/* ---------- Toolbar ---------- */}
      <div className="toolbar">
        <div className="search-box">
          <IconSearch size={16} />
          <label htmlFor="q-audit" className="sr-only">
            Buscar en la bitácora
          </label>
          <input
            id="q-audit"
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por código (INV-, CIR-, PAC-) o detalle…"
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="f-entity" className="sr-only">
            Filtrar por módulo
          </label>
          <select
            id="f-entity"
            className="select"
            style={{ width: 160 }}
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
          >
            <option value="">Todos los módulos</option>
            {ENTITIES.map((e) => (
              <option key={e} value={e}>
                {entityMeta(e).label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-action" className="sr-only">
            Filtrar por acción
          </label>
          <select
            id="f-action"
            className="select"
            style={{ width: 180 }}
            value={action}
            onChange={(e) => setAction(e.target.value)}
          >
            <option value="">Todas las acciones</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {actionMeta(a).label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => void handleExport()}
          disabled={exporting}
          title="Exportar la bitácora completa a CSV (Excel) — incluye impresiones de documentos"
        >
          {exporting ? <span className="spin" /> : <IconDownload size={16} />} Exportar CSV
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={reload}
          aria-label="Recargar bitácora"
          title="Recargar"
        >
          <IconRefresh size={16} />
        </button>
      </div>

      {/* ---------- Tabla ---------- */}
      {loading ? (
        <div className="card">
          <div className="loading-row">
            <span className="spin" /> Cargando bitácora…
          </div>
        </div>
      ) : error ? (
        <div className="card">
          <div className="state state-error">
            <IconAlert size={28} />
            <h3>No se pudo cargar la bitácora</h3>
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
            <h3>Sin registros</h3>
            <p>
              Aún no hay movimientos, cambios de estado ni ediciones registrados
              {entity || action ? " con estos filtros" : ""}. La bitácora se llena sola a medida
              que se usa la app.
            </p>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">Bitácora de auditoría</caption>
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Módulo</th>
                <th>Acción</th>
                <th>Entidad</th>
                <th>Detalle</th>
                <th>Autor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const em = entityMeta(e.entityType);
                const am = actionMeta(e.action);
                return (
                  <tr key={e.id}>
                    <td data-label="Fecha" style={{ whiteSpace: "nowrap" }}>
                      {fmtDateTime(e.createdAt)}
                    </td>
                    <td data-label="Módulo">
                      <span className="row" style={{ gap: 6 }}>
                        <em.Icon size={14} />
                        {em.label}
                      </span>
                    </td>
                    <td data-label="Acción">
                      <span className={`badge ${am.badge}`}>
                        <am.Icon size={12} />
                        {am.label}
                      </span>
                    </td>
                    <td data-label="Entidad" className="mono">
                      {e.entityCode ?? `#${e.entityId ?? "—"}`}
                    </td>
                    <td data-label="Detalle" style={{ minWidth: 220 }}>
                      {e.detail ?? <span className="muted">—</span>}
                    </td>
                    <td data-label="Autor" className="muted">
                      {e.actor}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="muted mt-2" style={{ fontSize: 12.5 }}>
        {data ? `${data.length} registro(s) · más recientes primero` : "—"} · la bitácora es de
        solo lectura y no se puede borrar desde la app
      </p>
    </div>
  );
}
