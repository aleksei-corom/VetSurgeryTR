// Inventario: búsqueda + filtros + tabla con semáforo de stock, acciones por
// fila (detalle / movimiento / editar), alta y edición de ítems, movimientos
// ENTRADA/SALIDA/AJUSTE y kardex global (list_movements).
import { useMemo, useState } from "react";
import {
  INVENTORY_CATEGORIES,
  INVENTORY_CATEGORY_META,
  MOVEMENT_TYPES,
  MOVEMENT_TYPE_LABEL,
  type InventoryItem,
  type MovementType,
} from "@/types";
import {
  exportInventoryCsv,
  exportKardexCsv,
  getInventoryItem,
  listInventoryItems,
  listMovements,
} from "@/lib/ipc";
import { fmtCOP, fmtDateTime, fmtQty } from "@/lib/format";
import { useAsync, useDebounced } from "@/lib/use-async";
import { useToast } from "./ui";
import ItemFormDialog from "./ItemFormDialog";
import MovementDialog from "./MovementDialog";
import ItemDetailDialog from "./ItemDetailDialog";
import {
  IconAlert,
  IconArrowUpRight,
  IconBox,
  IconChevronRight,
  IconEdit,
  IconHistory,
  IconArrowDownRight,
  IconDownload,
  IconPlus,
  IconRefresh,
  IconScale,
  IconSearch,
} from "./icons";

function StockBadge({ item }: { item: InventoryItem }) {
  if (!item.active) {
    return <span className="badge badge-secondary">Inactivo</span>;
  }
  if (item.stockQty <= 0) {
    return (
      <span className="badge badge-destructive">
        <span className="dot" aria-hidden="true" /> Sin stock
      </span>
    );
  }
  if (item.stockQty <= item.minStock) {
    return (
      <span className="badge badge-warning">
        <span className="dot" aria-hidden="true" /> Stock bajo
      </span>
    );
  }
  return (
    <span className="badge badge-success">
      <span className="dot" aria-hidden="true" /> OK
    </span>
  );
}

type Section = "stock" | "kardex";

export default function InventoryView() {
  const toast = useToast();
  const [section, setSection] = useState<Section>("stock");

  // ---- Existencias ----
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 300);
  const [category, setCategory] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const { data, loading, error, reload } = useAsync(
    () =>
      listInventoryItems({
        search: debouncedQ.trim() || undefined,
        category: category || undefined,
        lowStock: lowOnly,
      }),
    [debouncedQ, category, lowOnly],
  );

  // ---- Kardex global ----
  const [kItem, setKItem] = useState("");
  const [kType, setKType] = useState("");
  const [kQ, setKQ] = useState("");
  const debouncedKQ = useDebounced(kQ, 300);
  const kardex = useAsync(
    () =>
      listMovements({
        itemId: kItem ? Number(kItem) : undefined,
        type: kType || undefined,
        search: debouncedKQ.trim() || undefined,
        limit: 150,
      }),
    [kItem, kType, debouncedKQ],
  );

  // ---- Detalle ----
  const [detailId, setDetailId] = useState<number | null>(null);
  const detail = useAsync(
    () => (detailId != null ? getInventoryItem(detailId) : Promise.resolve(null)),
    [detailId],
  );

  // ---- Diálogos ----
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [movementTarget, setMovementTarget] = useState<InventoryItem | null | "new">(null);

  const items = data ?? [];
  const totalValue = items.reduce((acc, i) => acc + (i.unitCost ?? 0) * i.stockQty, 0);
  const allForPicker = useMemo(() => items, [items]); // los filtrados alcanzan para el picker
  const [exporting, setExporting] = useState(false);

  /** Flujo compartido: selector de carpeta → CSV en Rust → toasts. */
  async function handleExport(kind: "inventory" | "kardex") {
    setExporting(true);
    try {
      const path =
        kind === "inventory" ? await exportInventoryCsv() : await exportKardexCsv();
      if (path) toast.success(`CSV generado: ${path}`);
      // null = el usuario canceló el selector de carpeta.
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar el CSV.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      {/* ---------- Sección: existencias / kardex ---------- */}
      <div className="tabs" role="tablist" aria-label="Secciones de inventario">
        <button
          type="button"
          role="tab"
          aria-selected={section === "stock"}
          className={`tab${section === "stock" ? " active" : ""}`}
          onClick={() => setSection("stock")}
        >
          <IconBox size={15} /> Existencias
          <span className="tab-count">{items.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={section === "kardex"}
          className={`tab${section === "kardex" ? " active" : ""}`}
          onClick={() => setSection("kardex")}
        >
          <IconHistory size={15} /> Kardex global
        </button>
      </div>

      {section === "stock" ? (
        <>
          {/* ---------- Toolbar ---------- */}
          <div className="toolbar">
            <div className="search-box">
              <IconSearch size={16} />
              <label htmlFor="q-inventory" className="sr-only">
                Buscar en inventario
              </label>
              <input
                id="q-inventory"
                className="input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre, código, talla o proveedor…"
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="f-category" className="sr-only">
                Filtrar por categoría
              </label>
              <select
                id="f-category"
                className="select"
                style={{ width: 200 }}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Todas las categorías</option>
                {INVENTORY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {INVENTORY_CATEGORY_META[c]?.label ?? c}
                  </option>
                ))}
              </select>
            </div>
            <label className="check-row" htmlFor="f-lowstock" style={{ flexShrink: 0 }}>
              <input
                id="f-lowstock"
                type="checkbox"
                checked={lowOnly}
                onChange={(e) => setLowOnly(e.target.checked)}
              />
              Solo stock bajo
            </label>
            <button
              type="button"
              className="btn btn-outline"
              onClick={reload}
              aria-label="Recargar inventario"
              title="Recargar"
            >
              <IconRefresh size={16} />
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setMovementTarget("new")}
            >
              <IconArrowUpRight size={16} /> Registrar movimiento
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => handleExport("inventory")}
              disabled={exporting}
              title="Exportar el inventario completo a CSV (Excel)"
            >
              {exporting ? <span className="spin" /> : <IconDownload size={16} />} Exportar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setFormOpen(true)}>
              <IconPlus size={16} /> Nuevo material
            </button>
          </div>

          {/* ---------- Tabla ---------- */}
          {loading ? (
            <div className="card">
              <div className="loading-row">
                <span className="spin" /> Cargando inventario…
              </div>
            </div>
          ) : error ? (
            <div className="card">
              <div className="state state-error">
                <IconAlert size={28} />
                <h3>No se pudo cargar el inventario</h3>
                <p>{error}</p>
                <div className="actions">
                  <button type="button" className="btn btn-outline" onClick={reload}>
                    <IconRefresh size={16} /> Reintentar
                  </button>
                </div>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="card">
              <div className="state">
                <IconBox size={28} />
                <h3>Sin referencias</h3>
                <p>
                  No hay ítems que coincidan con la búsqueda
                  {category ? ` y la categoría ${INVENTORY_CATEGORY_META[category]?.label ?? category}` : ""}
                  {lowOnly ? " con stock bajo" : ""}.
                </p>
                <div className="actions">
                  <button type="button" className="btn btn-primary" onClick={() => setFormOpen(true)}>
                    <IconPlus size={16} /> Crear el primer material
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <caption className="sr-only">Listado de inventario ortopédico</caption>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Ítem</th>
                    <th>Categoría</th>
                    <th className="num">Stock / Mín.</th>
                    <th className="num">Costo unit.</th>
                    <th>Estado</th>
                    <th className="num">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id}>
                      <td data-label="Código" className="mono">
                        {i.code}
                      </td>
                      <td data-label="Ítem">
                        <span className="cell-main">{i.name}</span>
                        <div className="cell-sub">
                          {[i.subType, i.material, i.size].filter(Boolean).join(" · ") || i.unit}
                        </div>
                      </td>
                      <td data-label="Categoría">
                        <span className="badge badge-outline">
                          {INVENTORY_CATEGORY_META[i.category]?.label ?? i.category}
                        </span>
                      </td>
                      <td data-label="Stock / Mín." className="num">
                        <b>{fmtQty(i.stockQty)}</b>
                        <span className="muted"> / {fmtQty(i.minStock)}</span>
                        <div className="cell-sub">{i.unit}</div>
                      </td>
                      <td data-label="Costo unit." className="num">
                        {fmtCOP(i.unitCost)}
                      </td>
                      <td data-label="Estado">
                        <StockBadge item={i} />
                      </td>
                      <td data-label="Acciones" className="num">
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setDetailId(i.id)}
                            title="Ver detalle y kardex"
                          >
                            Detalle <IconChevronRight size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => setMovementTarget(i)}
                            title="Registrar movimiento"
                          >
                            <IconArrowUpRight size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setEditItem(i)}
                            title="Editar ítem"
                          >
                            <IconEdit size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="muted mt-2" style={{ fontSize: 12.5 }}>
            {data ? `${data.length} referencia(s)` : "—"}
            {data && data.length > 0 ? (
              <>
                {" · "}valor total estimado: <b>{fmtCOP(totalValue)}</b>
              </>
            ) : null}
          </p>
        </>
      ) : (
        /* ---------- Kardex global ---------- */
        <>
          <div className="toolbar">
            <div className="search-box">
              <IconSearch size={16} />
              <label htmlFor="q-kardex" className="sr-only">
                Buscar en el kardex
              </label>
              <input
                id="q-kardex"
                className="input"
                value={kQ}
                onChange={(e) => setKQ(e.target.value)}
                placeholder="Buscar por nombre o código del material…"
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="k-item" className="sr-only">
                Filtrar por material
              </label>
              <select
                id="k-item"
                className="select"
                style={{ width: 220 }}
                value={kItem}
                onChange={(e) => setKItem(e.target.value)}
              >
                <option value="">Todos los materiales</option>
                {allForPicker.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.code} · {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="k-type" className="sr-only">
                Filtrar por tipo
              </label>
              <select
                id="k-type"
                className="select"
                style={{ width: 170 }}
                value={kType}
                onChange={(e) => setKType(e.target.value)}
              >
                <option value="">Todos los tipos</option>
                {MOVEMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {MOVEMENT_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn btn-outline"
              onClick={kardex.reload}
              aria-label="Recargar kardex"
              title="Recargar"
            >
              <IconRefresh size={16} />
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => handleExport("kardex")}
              disabled={exporting}
              title="Exportar el kardex completo a CSV (Excel)"
            >
              {exporting ? <span className="spin" /> : <IconDownload size={16} />} Exportar CSV
            </button>
          </div>

          {kardex.loading ? (
            <div className="card">
              <div className="loading-row">
                <span className="spin" /> Cargando movimientos…
              </div>
            </div>
          ) : kardex.error ? (
            <div className="card">
              <div className="state state-error">
                <IconAlert size={28} />
                <h3>No se pudo cargar el kardex</h3>
                <p>{kardex.error}</p>
                <div className="actions">
                  <button type="button" className="btn btn-outline" onClick={kardex.reload}>
                    <IconRefresh size={16} /> Reintentar
                  </button>
                </div>
              </div>
            </div>
          ) : (kardex.data ?? []).length === 0 ? (
            <div className="card">
              <div className="state">
                <IconHistory size={28} />
                <h3>Sin movimientos</h3>
                <p>No hay movimientos que coincidan con los filtros.</p>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="card-body flush">
                <ul className="kardex" style={{ listStyle: "none", margin: 0, padding: 12 }}>
                  {(kardex.data ?? []).map((m) => (
                    <li key={m.id} className="kardex-row">
                      <span
                        className={`kardex-icon ${m.type === "ENTRADA" ? "t-entrada" : m.type === "SALIDA" ? "t-salida" : "t-ajuste"}`}
                        aria-hidden="true"
                      >
                        {m.type === "ENTRADA" ? (
                          <IconArrowUpRight size={16} />
                        ) : m.type === "SALIDA" ? (
                          <IconArrowDownRight size={16} />
                        ) : (
                          <IconScale size={16} />
                        )}
                      </span>
                      <div className="kardex-main">
                        <span
                          className={`kardex-qty ${m.type === "ENTRADA" ? "t-entrada" : m.type === "SALIDA" ? "t-salida" : "t-ajuste"}`}
                        >
                          {m.type === "ENTRADA" ? "+" : m.type === "SALIDA" ? "−" : "="}
                          {fmtQty(m.qty)}
                        </span>{" "}
                        <span className="cell-main" style={{ fontSize: 13 }}>
                          {m.item?.name ?? `Ítem #${m.itemId}`}
                        </span>
                        {m.item?.code ? (
                          <span className="mono muted" style={{ marginLeft: 6, fontSize: 11.5 }}>
                            {m.item.code}
                          </span>
                        ) : null}
                        {m.reason ? <div className="cell-sub">{m.reason}</div> : null}
                        {m.surgeryCode ? (
                          <div className="cell-sub">
                            Cirugía <span className="mono">{m.surgeryCode}</span>
                            {m.patientName ? ` · ${m.patientName}` : ""}
                          </div>
                        ) : null}
                      </div>
                      <div className="kardex-right">
                        <div className="cell-sub" style={{ fontSize: 11.5 }}>
                          {fmtDateTime(m.createdAt)}
                        </div>
                        <div style={{ fontSize: 12.5, fontWeight: 700 }}>
                          → {fmtQty(m.stockAfter)} {m.item?.unit ?? ""}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <p className="muted mt-2" style={{ fontSize: 12.5 }}>
            {(kardex.data ?? []).length} movimiento(s) · más recientes primero
          </p>
        </>
      )}

      {/* ---------- Diálogos ---------- */}
      {formOpen ? (
        <ItemFormDialog
          item={null}
          onClose={() => setFormOpen(false)}
          onSaved={(created) => {
            setFormOpen(false);
            toast.success(`Material ${created.code} creado.`);
            reload();
          }}
        />
      ) : null}

      {editItem ? (
        <ItemFormDialog
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={(saved) => {
            setEditItem(null);
            toast.success(`Material ${saved.code} actualizado.`);
            reload();
            if (detailId === saved.id) detail.reload();
          }}
        />
      ) : null}

      {movementTarget !== null ? (
        <MovementDialog
          item={movementTarget === "new" ? null : movementTarget}
          items={movementTarget === "new" ? allForPicker : undefined}
          onClose={() => setMovementTarget(null)}
          onDone={({ itemId, type }) => {
            setMovementTarget(null);
            toast.success(
              `${MOVEMENT_TYPE_LABEL[type as MovementType]} registrada correctamente.`,
            );
            reload();
            kardex.reload();
            if (detailId === itemId) detail.reload();
          }}
        />
      ) : null}

      {detailId != null ? (
        <ItemDetailDialog
          detail={detail.data}
          loading={detail.loading}
          error={detail.error}
          onClose={() => setDetailId(null)}
          onMovement={(ref) => {
            const it = items.find((i) => i.id === ref.id) ?? null;
            setDetailId(null);
            setMovementTarget(it ?? "new");
          }}
          onEdit={() => {
            const it = detail.data?.item;
            if (!it) return;
            setDetailId(null);
            setEditItem(it);
          }}
        />
      ) : null}
    </div>
  );
}
