// Diálogo de movimiento de inventario: ENTRADA suma · SALIDA resta (valida
// stock) · AJUSTE fija el stock absoluto contado (0 válido: existencia
// agotada). Muestra la proyección de stock resultante en vivo.
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { InventoryItem, MovementType } from "@/types";
import { createMovement } from "@/lib/ipc";
import { fmtCOP, fmtQty } from "@/lib/format";
import { Modal } from "./ui";
import { IconAlert, IconArrowDownRight, IconArrowUpRight, IconScale } from "./icons";

interface Props {
  /** Ítem fijo; null = selector de ítem. */
  item: InventoryItem | null;
  /** Ítems disponibles para el selector (solo cuando item == null). */
  items?: InventoryItem[];
  onClose: () => void;
  onDone: (result: { itemId: number; type: MovementType }) => void;
}

const TYPE_META: Record<
  MovementType,
  { label: string; hint: string; Icon: typeof IconArrowUpRight; cls: string }
> = {
  ENTRADA: {
    label: "Entrada",
    hint: "Suma la cantidad al stock actual (compras, devoluciones).",
    Icon: IconArrowUpRight,
    cls: "t-entrada",
  },
  SALIDA: {
    label: "Salida",
    hint: "Resta la cantidad al stock actual (consumo, vencimientos).",
    Icon: IconArrowDownRight,
    cls: "t-salida",
  },
  AJUSTE: {
    label: "Ajuste",
    hint: "Fija el stock al valor contado físicamente (0 = agotado).",
    Icon: IconScale,
    cls: "t-ajuste",
  },
};

export default function MovementDialog({ item, items, onClose, onDone }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(item?.id ?? null);
  const [type, setType] = useState<MovementType>("ENTRADA");
  const [qty, setQty] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedItem = useMemo(() => {
    if (item) return item;
    return (items ?? []).find((i) => i.id === selectedId) ?? null;
  }, [item, items, selectedId]);

  // Prefijo el costo unitario del ítem al elegirlo.
  useEffect(() => {
    setUnitCost(selectedItem?.unitCost != null ? String(selectedItem.unitCost) : "");
  }, [selectedItem?.id, selectedItem?.unitCost]);

  const isAjuste = type === "AJUSTE";
  const qtyNum = Number(qty.replace(",", "."));

  const projected = useMemo(() => {
    if (!selectedItem || qty.trim() === "" || Number.isNaN(qtyNum)) return null;
    if (type === "ENTRADA") return selectedItem.stockQty + qtyNum;
    if (type === "SALIDA") return selectedItem.stockQty - qtyNum;
    return qtyNum;
  }, [selectedItem, qtyNum, type, qty]);

  function validate(): string | null {
    if (!selectedItem) return "Selecciona el material.";
    if (qty.trim() === "" || Number.isNaN(qtyNum)) return "La cantidad debe ser un número.";
    if (isAjuste) {
      if (qtyNum < 0) return "El stock contado no puede ser negativo.";
    } else if (qtyNum <= 0) return "La cantidad debe ser mayor a 0.";
    if (unitCost.trim() !== "" && Number(unitCost.replace(",", ".")) < 0)
      return "El costo unitario no puede ser negativo.";
    return null;
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setFormError(null);
    const problem = validate();
    if (problem || !selectedItem) {
      if (problem) setFormError(problem);
      return;
    }
    setSubmitting(true);
    try {
      await createMovement(selectedItem.id, {
        type,
        qty: qtyNum,
        unitCost: unitCost.trim() === "" ? undefined : Number(unitCost.replace(",", ".")),
        reason: reason.trim() || undefined,
      });
      onDone({ itemId: selectedItem.id, type });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo registrar el movimiento.");
      setSubmitting(false);
    }
  }

  const projectCls =
    projected == null || !selectedItem
      ? ""
      : projected < 0
        ? "bad"
        : projected === 0 && !isAjuste
          ? "warn"
          : projected <= selectedItem.minStock
            ? "warn"
            : "ok";

  return (
    <Modal
      title="Movimiento de inventario"
      subtitle={
        selectedItem
          ? `${selectedItem.code} · ${selectedItem.name} — stock actual: ${fmtQty(selectedItem.stockQty)} ${selectedItem.unit}`
          : "Registra entradas, salidas o ajustes de existencias."
      }
      onClose={onClose}
      width={520}
    >
      <form onSubmit={submit} noValidate>
        <div className="modal-body">
          {formError ? (
            <div className="banner danger" role="alert" style={{ marginBottom: 16 }}>
              <IconAlert size={18} />
              <span>{formError}</span>
            </div>
          ) : null}

          {!item ? (
            <div className="field" style={{ marginBottom: 14 }}>
              <label htmlFor="mv-item">Material *</label>
              <select
                id="mv-item"
                className="select"
                value={selectedId ?? ""}
                onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Seleccionar…</option>
                {(items ?? []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({fmtQty(i.stockQty)} {i.unit})
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="field" style={{ marginBottom: 12 }}>
            <label>Tipo de movimiento *</label>
            <div className="type-cards" role="radiogroup" aria-label="Tipo de movimiento">
              {(Object.keys(TYPE_META) as MovementType[]).map((t) => {
                const meta = TYPE_META[t];
                const active = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`type-card ${meta.cls}${active ? " active" : ""}`}
                    onClick={() => setType(t)}
                  >
                    <meta.Icon size={17} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
            <p className="field-hint">{TYPE_META[type].hint}</p>
          </div>

          <div className="form-grid" style={{ marginBottom: 12 }}>
            <div className="field">
              <label htmlFor="mv-qty">{isAjuste ? "Stock contado *" : "Cantidad *"}</label>
              <input
                id="mv-qty"
                className="input"
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                autoFocus
              />
              {projected != null && selectedItem ? (
                <p className={`project-line ${projectCls}`}>
                  Stock resultante:{" "}
                  <b>
                    {fmtQty(projected)} {selectedItem.unit}
                  </b>
                  {projected < 0
                    ? " · ¡supera el disponible!"
                    : projected <= selectedItem.minStock
                      ? " · quedará bajo el mínimo"
                      : ""}
                </p>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="mv-cost">
                Costo unitario (COP) <span className="opt">(opcional)</span>
              </label>
              <input
                id="mv-cost"
                className="input"
                type="number"
                step="any"
                min="0"
                inputMode="decimal"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder={selectedItem?.unitCost != null ? fmtCOP(selectedItem.unitCost) : "95000"}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="mv-reason">
              Motivo <span className="opt">(opcional)</span>
            </label>
            <textarea
              id="mv-reason"
              className="textarea"
              style={{ minHeight: 60 }}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Compra a proveedor, consumo en consulta, inventario físico…"
            />
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? <span className="spin" /> : null}
            {submitting ? "Registrando…" : "Registrar movimiento"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
