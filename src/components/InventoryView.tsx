// Inventario (solo lectura): búsqueda + filtro por categoría + tabla con
// semáforo de stock. Datos vía ipc.listInventoryItems().
import { useState } from "react";
import {
  INVENTORY_CATEGORIES,
  INVENTORY_CATEGORY_META,
  type InventoryItem,
} from "@/types";
import { listInventoryItems } from "@/lib/ipc";
import { fmtCOP, fmtQty } from "@/lib/format";
import { useAsync, useDebounced } from "@/lib/use-async";
import { IconAlert, IconBox, IconRefresh, IconSearch } from "./icons";

function StockState({ item }: { item: InventoryItem }) {
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

export default function InventoryView() {
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

  const totalValue = (data ?? []).reduce((acc, i) => acc + (i.unitCost ?? 0) * i.stockQty, 0);

  return (
    <div>
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
            <p>
              {error}
              <br />
              Los datos se piden por IPC: ejecuta con <span className="mono">bun run tauri dev</span>.
            </p>
            <div className="actions">
              <button type="button" className="btn btn-outline" onClick={reload}>
                <IconRefresh size={16} /> Reintentar
              </button>
            </div>
          </div>
        </div>
      ) : !data || data.length === 0 ? (
        <div className="card">
          <div className="state">
            <IconBox size={28} />
            <h3>Sin referencias</h3>
            <p>
              No hay ítems que coincidan con la búsqueda
              {category ? ` y la categoría ${INVENTORY_CATEGORY_META[category]?.label ?? category}` : ""}
              {lowOnly ? " con stock bajo" : ""}.
            </p>
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
              </tr>
            </thead>
            <tbody>
              {data.map((i) => (
                <tr key={i.id}>
                  <td className="mono">{i.code}</td>
                  <td>
                    <span className="cell-main">{i.name}</span>
                    <div className="cell-sub">
                      {[i.subType, i.material, i.size].filter(Boolean).join(" · ") || i.unit}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-outline">
                      {INVENTORY_CATEGORY_META[i.category]?.label ?? i.category}
                    </span>
                  </td>
                  <td className="num">
                    <b>{fmtQty(i.stockQty)}</b>
                    <span className="muted"> / {fmtQty(i.minStock)}</span>
                    <div className="cell-sub">{i.unit}</div>
                  </td>
                  <td className="num">{fmtCOP(i.unitCost)}</td>
                  <td>
                    <StockState item={i} />
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
    </div>
  );
}
