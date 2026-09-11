// Panel de control: 6 KPIs, próximas cirugías, alertas de stock y cirugías
// por mes (barras CSS simples). Datos vía ipc.getDashboard().
import { useMemo } from "react";
import type { ViewId } from "./AppShell";
import {
  SURGERY_STATUS_META,
  type InventoryItem,
  type Surgery,
} from "@/types";
import { getDashboard } from "@/lib/ipc";
import { fmtCOP, fmtDate, fmtQty } from "@/lib/format";
import { useAsync } from "@/lib/use-async";
import {
  IconActivity,
  IconAlert,
  IconCalendar,
  IconClock,
  IconPaw,
  IconRefresh,
  IconTag,
} from "./icons";

interface DashboardViewProps {
  onNavigate?: (view: ViewId) => void;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const idx = Number(m) - 1;
  return `${MONTHS[idx] ?? m} ${y?.slice(2) ?? ""}`;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ------------------------------ Sub-componentes ------------------------------ */

function StatusBadge({ status }: { status: string }) {
  const meta = SURGERY_STATUS_META[status as keyof typeof SURGERY_STATUS_META];
  return (
    <span className={`badge badge-${meta?.badge ?? "secondary"}`}>
      <span className="dot" aria-hidden="true" />
      {meta?.label ?? status}
    </span>
  );
}

function UpcomingRow({ s }: { s: Surgery }) {
  const day = s.scheduledAt.slice(0, 10);
  const isToday = day === todayKey();
  const [, m, d] = day.split("-").map(Number);
  return (
    <div className="list-row">
      <div className={isToday ? "date-chip today" : "date-chip"} aria-hidden="true">
        <b>{d}</b>
        <span>{MONTHS[(m ?? 1) - 1]}</span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          <span className="mono">{s.code}</span>
          <StatusBadge status={s.status} />
        </div>
        <div className="cell-main" style={{ marginTop: 2 }}>
          {s.patient.name} <span className="muted">· {s.patient.species}</span>
        </div>
        <div className="cell-sub">
          {s.procedureType}
          {s.vet ? ` · ${s.vet.fullName}` : ""}
        </div>
      </div>
      <span className="cell-sub" style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>
        <IconClock size={14} style={{ display: "inline", verticalAlign: "-2px" }} />{" "}
        {s.scheduledAt.length > 10 ? s.scheduledAt.slice(11, 16) : "—"}
      </span>
    </div>
  );
}

function StockRow({ item }: { item: InventoryItem }) {
  const deficit = item.minStock - item.stockQty;
  return (
    <div className="list-row">
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          <span className="mono">{item.code}</span>
          <span className="badge badge-outline">{item.category}</span>
        </div>
        <div className="cell-main" style={{ marginTop: 2 }}>
          {item.name}
          {item.size ? <span className="muted"> · {item.size}</span> : null}
        </div>
      </div>
      <div className="right" style={{ whiteSpace: "nowrap" }}>
        <div>
          <b>{fmtQty(item.stockQty)}</b> <span className="muted">/ {fmtQty(item.minStock)} {item.unit}</span>
        </div>
        <span className="badge badge-destructive">faltan {fmtQty(deficit)}</span>
      </div>
    </div>
  );
}

/* --------------------------------- Vista --------------------------------- */

export default function DashboardView({ onNavigate }: DashboardViewProps) {
  const { data, loading, error, reload } = useAsync(() => getDashboard(), []);

  const kpis = useMemo(() => {
    const st = data?.stats;
    return [
      {
        label: "Cirugías del mes",
        value: st ? String(st.surgeriesCompletedMonth) : "—",
        hint: "completadas",
        icon: <IconActivity size={18} />,
        to: "surgeries" as ViewId,
      },
      {
        label: "Programadas",
        value: st ? String(st.surgeriesScheduled) : "—",
        hint: "próximas en agenda",
        icon: <IconCalendar size={18} />,
        to: "surgeries" as ViewId,
      },
      {
        label: "Pacientes activos",
        value: st ? String(st.patientsActive) : "—",
        hint: "en tratamiento",
        icon: <IconPaw size={18} />,
        to: "patients" as ViewId,
      },
      {
        label: "Alertas de stock",
        value: st ? String(st.lowStockCount) : "—",
        hint: "refs. bajo mínimo",
        icon: <IconAlert size={18} />,
        kind: st && st.lowStockCount > 0 ? "warn" : "",
        to: "inventory" as ViewId,
      },
      {
        label: "Controles vencidos",
        value: st ? String(st.followUpsDue) : "—",
        hint: "postoperatorios",
        icon: <IconClock size={18} />,
        kind: st && st.followUpsDue > 0 ? "danger" : "",
        to: "surgeries" as ViewId,
      },
      {
        label: "Valor inventario",
        value: st ? fmtCOP(st.inventoryValue) : "—",
        hint: "Σ stock × costo",
        icon: <IconTag size={18} />,
        to: "inventory" as ViewId,
      },
    ];
  }, [data]);

  if (loading) {
    return (
      <div>
        <div className="kpi-grid" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="kpi" style={{ cursor: "default" }}>
              <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 10 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: 12, width: "70%", marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 20, width: "50%" }} />
              </div>
            </div>
          ))}
        </div>
        <div className="row mt-4" style={{ color: "var(--text-muted)", fontSize: 13.5 }}>
          <span className="spin" /> Cargando panel…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card">
        <div className="state state-error">
          <IconAlert size={30} />
          <h3>No se pudo cargar el panel</h3>
          <p>
            {error}
            <br />
            Recuerda que los datos se piden por IPC a Rust: ejecuta la app con{" "}
            <span className="mono">bun run tauri dev</span> para que{" "}
            <span className="mono">invoke()</span> esté disponible y Firebird Embedded arranque.
          </p>
          <div className="actions">
            <button type="button" className="btn btn-outline" onClick={reload}>
              <IconRefresh size={16} /> Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const maxMonthly = Math.max(1, ...data.monthlySurgeries.map((m) => m.count));

  return (
    <div>
      {/* ---------- KPIs ---------- */}
      <section aria-label="Indicadores">
        <div className="kpi-grid">
          {kpis.map((k) => (
            <button
              key={k.label}
              type="button"
              className={`kpi ${k.kind ? `kpi-${k.kind}` : ""}`}
              onClick={() => onNavigate?.(k.to)}
              title={`Ver ${k.to === "surgeries" ? "cirugías" : k.to === "patients" ? "pacientes" : "inventario"}`}
            >
              <span className="kpi-icon">{k.icon}</span>
              <span style={{ minWidth: 0 }}>
                <span className="kpi-label">{k.label}</span>
                <span className="kpi-value" style={{ display: "block" }}>
                  {k.value}
                </span>
                <span className="kpi-hint">{k.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4" aria-label="Agenda, alertas y evolución" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))", gap: "1rem", alignItems: "start" }}>
        {/* ---------- Próximas cirugías ---------- */}
        <div className="card">
          <div className="card-head">
            <h2>Próximas cirugías</h2>
            <span className="card-sub">
              PROGRAMADA / EN_CURSO desde {fmtDate(todayKey())}
            </span>
          </div>
          <div className="card-body flush" style={{ maxHeight: "24rem", overflowY: "auto" }}>
            {data.upcomingSurgeries.length === 0 ? (
              <div className="state">
                <IconCalendar size={26} />
                <p>No hay cirugías próximas agendadas.</p>
              </div>
            ) : (
              <div className="list">
                {data.upcomingSurgeries.map((s) => (
                  <UpcomingRow key={s.id} s={s} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ---------- Alertas de stock ---------- */}
        <div className="card">
          <div className="card-head">
            <h2>Alertas de stock</h2>
            <span className="card-sub">existencias ≤ mínimo</span>
            <span className="spacer" />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onNavigate?.("inventory")}
            >
              Ver inventario
            </button>
          </div>
          <div className="card-body flush" style={{ maxHeight: "24rem", overflowY: "auto" }}>
            {data.lowStockItems.length === 0 ? (
              <div className="state">
                <IconTag size={26} />
                <p>Todas las referencias están por encima del stock mínimo.</p>
              </div>
            ) : (
              <div className="list">
                {data.lowStockItems.map((i) => (
                  <StockRow key={i.id} item={i} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ---------- Cirugías por mes ---------- */}
        <div className="card">
          <div className="card-head">
            <h2>Cirugías por mes</h2>
            <span className="card-sub">últimos 6 meses · creadas</span>
          </div>
          <div className="card-body">
            {data.monthlySurgeries.length === 0 ? (
              <p className="muted">Sin actividad registrada todavía.</p>
            ) : (
              <div className="bars">
                {data.monthlySurgeries.map((m) => (
                  <div key={m.month} className="bar-row">
                    <span className="bar-month">{monthLabel(m.month)}</span>
                    <span className="bar-track">
                      <span
                        className="bar-fill"
                        style={{ width: `${Math.round((m.count / maxMonthly) * 100)}%` }}
                      />
                    </span>
                    <span className="bar-count">{m.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
