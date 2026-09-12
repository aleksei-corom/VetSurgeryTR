// Diálogo de alta/edición de material de inventario.
// Creación: create_inventory_item (el stock inicial genera la ENTRADA inicial
// en el backend). Edición: update_inventory_item — el stock NUNCA se edita
// directo (regla de negocio: solo cambia por movimientos).
import { useState, type FormEvent } from "react";
import {
  INVENTORY_CATEGORIES,
  INVENTORY_CATEGORY_META,
  type InventoryItem,
} from "@/types";
import { createInventoryItem, updateInventoryItem } from "@/lib/ipc";
import { Modal } from "./ui";
import { IconAlert } from "./icons";

const UNITS = ["pieza", "caja", "paquete", "rollo", "metro", "frasco", "frasco-ampolla", "unidad"];

interface FormState {
  name: string;
  category: string;
  subType: string;
  material: string;
  size: string;
  unit: string;
  stockQty: string;
  minStock: string;
  unitCost: string;
  supplier: string;
  lotNumber: string;
  expiresAt: string;
  location: string;
  notes: string;
  active: boolean;
}

function emptyForm(): FormState {
  return {
    name: "",
    category: "PLACAS",
    subType: "",
    material: "",
    size: "",
    unit: "pieza",
    stockQty: "0",
    minStock: "0",
    unitCost: "",
    supplier: "",
    lotNumber: "",
    expiresAt: "",
    location: "",
    notes: "",
    active: true,
  };
}

function fromItem(i: InventoryItem): FormState {
  return {
    name: i.name,
    category: i.category,
    subType: i.subType ?? "",
    material: i.material ?? "",
    size: i.size ?? "",
    unit: i.unit,
    stockQty: String(i.stockQty), // solo informativo en edición
    minStock: String(i.minStock),
    unitCost: i.unitCost != null ? String(i.unitCost) : "",
    supplier: i.supplier ?? "",
    lotNumber: i.lotNumber ?? "",
    expiresAt: i.expiresAt ?? "",
    location: i.location ?? "",
    notes: i.notes ?? "",
    active: i.active,
  };
}

type Errors = Partial<Record<keyof FormState, string>>;

interface ItemFormDialogProps {
  /** Ítem a editar; null = alta. */
  item: InventoryItem | null;
  onClose: () => void;
  onSaved: (item: InventoryItem, created: boolean) => void;
}

export default function ItemFormDialog({ item, onClose, onSaved }: ItemFormDialogProps) {
  const editing = item != null;
  const [form, setForm] = useState<FormState>(() => (item ? fromItem(item) : emptyForm()));
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const num = (v: string): number | undefined => {
    const t = v.trim().replace(",", ".");
    if (t === "") return undefined;
    const n = Number(t);
    return Number.isNaN(n) ? undefined : n;
  };

  function validate(): boolean {
    const e: Errors = {};
    if (form.name.trim().length < 3) e.name = "Nombre del material (mín. 3 caracteres).";
    if (!form.category) e.category = "Selecciona la categoría.";
    if (!form.unit.trim()) e.unit = "La unidad es requerida.";

    const stock = num(form.stockQty);
    if (form.stockQty.trim() !== "" && stock == null) e.stockQty = "Debe ser un número.";
    else if (!editing && stock != null && stock < 0) e.stockQty = "No puede ser negativo.";

    const min = num(form.minStock);
    if (form.minStock.trim() !== "" && min == null) e.minStock = "Debe ser un número.";
    else if (min != null && min < 0) e.minStock = "No puede ser negativo.";

    const cost = num(form.unitCost);
    if (form.unitCost.trim() !== "" && cost == null) e.unitCost = "Debe ser un número.";
    else if (cost != null && cost < 0) e.unitCost = "No puede ser negativo.";

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
      if (editing && item) {
        const saved = await updateInventoryItem(item.id, {
          name: form.name.trim(),
          category: form.category,
          subType: opt(form.subType),
          material: opt(form.material),
          size: opt(form.size),
          unit: form.unit.trim(),
          minStock: num(form.minStock),
          unitCost: num(form.unitCost),
          supplier: opt(form.supplier),
          lotNumber: opt(form.lotNumber),
          expiresAt: opt(form.expiresAt),
          location: opt(form.location),
          active: form.active,
          notes: opt(form.notes),
        });
        onSaved(saved, false);
      } else {
        const created = await createInventoryItem({
          name: form.name.trim(),
          category: form.category,
          subType: opt(form.subType),
          material: opt(form.material),
          size: opt(form.size),
          unit: form.unit.trim(),
          stockQty: num(form.stockQty) ?? 0,
          minStock: num(form.minStock) ?? 0,
          unitCost: num(form.unitCost),
          supplier: opt(form.supplier),
          lotNumber: opt(form.lotNumber),
          expiresAt: opt(form.expiresAt),
          location: opt(form.location),
          notes: opt(form.notes),
        });
        onSaved(created, true);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar el material.");
      setSubmitting(false);
    }
  }

  const err = (k: keyof FormState) => errors[k];

  return (
    <Modal
      title={editing ? `Editar ${item.code}` : "Nuevo material de inventario"}
      subtitle={
        editing
          ? "El stock solo cambia por movimientos (Entrada/Salida/Ajuste), no por edición."
          : "Implantes, instrumental o insumos. El código INV-NNNN se asigna automáticamente."
      }
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
            <h3>Identificación</h3>
            <div className="form-grid">
              <div className="field col-2">
                <label htmlFor="if-name">Nombre *</label>
                <input
                  id="if-name"
                  className="input"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  aria-invalid={!!err("name")}
                  placeholder="Platina LCP 3.5 mm × 8 agujeros"
                  autoComplete="off"
                />
                {err("name") ? <span className="field-error">{err("name")}</span> : null}
              </div>
              <div className="field">
                <label htmlFor="if-category">Categoría *</label>
                <select
                  id="if-category"
                  className="select"
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                  aria-invalid={!!err("category")}
                >
                  {INVENTORY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {INVENTORY_CATEGORY_META[c]?.label ?? c}
                    </option>
                  ))}
                </select>
                {err("category") ? <span className="field-error">{err("category")}</span> : null}
              </div>
              <div className="field">
                <label htmlFor="if-subtype">
                  Tipo / modelo <span className="opt">(opcional)</span>
                </label>
                <input
                  id="if-subtype"
                  className="input"
                  value={form.subType}
                  onChange={(e) => set("subType", e.target.value)}
                  placeholder="LCP, cortical, Kirschner…"
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="if-material">
                  Material <span className="opt">(opcional)</span>
                </label>
                <input
                  id="if-material"
                  className="input"
                  value={form.material}
                  onChange={(e) => set("material", e.target.value)}
                  placeholder="Titanio, acero 316L…"
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="if-size">
                  Tamaño / medida <span className="opt">(opcional)</span>
                </label>
                <input
                  id="if-size"
                  className="input"
                  value={form.size}
                  onChange={(e) => set("size", e.target.value)}
                  placeholder="3.5 mm · 8 agujeros"
                  autoComplete="off"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Existencias y costos</h3>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="if-unit">Unidad *</label>
                <select
                  id="if-unit"
                  className="select"
                  value={form.unit}
                  onChange={(e) => set("unit", e.target.value)}
                  aria-invalid={!!err("unit")}
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                {err("unit") ? <span className="field-error">{err("unit")}</span> : null}
              </div>
              <div className="field">
                <label htmlFor="if-stock">
                  {editing ? (
                    <>
                      Stock actual <span className="opt">(solo movimientos)</span>
                    </>
                  ) : (
                    "Stock inicial"
                  )}
                </label>
                <input
                  id="if-stock"
                  className="input"
                  type="number"
                  step="any"
                  min="0"
                  inputMode="decimal"
                  value={form.stockQty}
                  onChange={(e) => set("stockQty", e.target.value)}
                  aria-invalid={!!err("stockQty")}
                  disabled={editing}
                  title={editing ? "El stock cambia con movimientos de inventario" : undefined}
                />
                {err("stockQty") ? <span className="field-error">{err("stockQty")}</span> : null}
              </div>
              <div className="field">
                <label htmlFor="if-min">Stock mínimo</label>
                <input
                  id="if-min"
                  className="input"
                  type="number"
                  step="any"
                  min="0"
                  inputMode="decimal"
                  value={form.minStock}
                  onChange={(e) => set("minStock", e.target.value)}
                  aria-invalid={!!err("minStock")}
                />
                {err("minStock") ? <span className="field-error">{err("minStock")}</span> : null}
              </div>
              <div className="field">
                <label htmlFor="if-cost">Costo unitario (COP)</label>
                <input
                  id="if-cost"
                  className="input"
                  type="number"
                  step="any"
                  min="0"
                  inputMode="decimal"
                  value={form.unitCost}
                  onChange={(e) => set("unitCost", e.target.value)}
                  aria-invalid={!!err("unitCost")}
                  placeholder="850000"
                />
                {err("unitCost") ? <span className="field-error">{err("unitCost")}</span> : null}
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Trazabilidad</h3>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="if-supplier">
                  Proveedor <span className="opt">(opcional)</span>
                </label>
                <input
                  id="if-supplier"
                  className="input"
                  value={form.supplier}
                  onChange={(e) => set("supplier", e.target.value)}
                  placeholder="Zimmer Veterinary"
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="if-lot">
                  Lote <span className="opt">(opcional)</span>
                </label>
                <input
                  id="if-lot"
                  className="input"
                  value={form.lotNumber}
                  onChange={(e) => set("lotNumber", e.target.value)}
                  placeholder="L-2026-014"
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="if-exp">
                  Vencimiento <span className="opt">(opcional)</span>
                </label>
                <input
                  id="if-exp"
                  className="input"
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => set("expiresAt", e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="if-loc">
                  Ubicación <span className="opt">(opcional)</span>
                </label>
                <input
                  id="if-loc"
                  className="input"
                  value={form.location}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="Vitrina A-1"
                  autoComplete="off"
                />
              </div>
              <div className="field col-2">
                <label htmlFor="if-notes">
                  Notas <span className="opt">(opcional)</span>
                </label>
                <textarea
                  id="if-notes"
                  className="textarea"
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Observaciones del material…"
                />
              </div>
              {editing ? (
                <div className="field col-2">
                  <label className="check-row" htmlFor="if-active">
                    <input
                      id="if-active"
                      type="checkbox"
                      checked={form.active}
                      onChange={(e) => set("active", e.target.checked)}
                    />
                    Ítem activo (desactívalo para ocultarlo del uso quirúrgico sin borrar su
                    historial)
                  </label>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? <span className="spin" /> : null}
            {submitting ? "Guardando…" : editing ? "Guardar cambios" : "Crear material"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
