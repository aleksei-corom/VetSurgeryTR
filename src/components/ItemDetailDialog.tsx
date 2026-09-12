// Detalle del ítem con su kardex (historial de movimientos, máx. 50) y
// acciones rápidas: registrar movimiento / editar.
import { useMemo } from "react";
import {
  INVENTORY_CATEGORY_META,
  type InventoryItemDetail,
  type MovementType,
} from "@/types";
import { fmtCOP, fmtDate, fmtDateTime, fmtQty } from "@/lib/format";
import { Modal } from "./ui";
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconEdit,
  IconHistory,
  IconScale,
} from "./icons";

interface Props {
  detail: InventoryItemDetail | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onMovement: (item: { id: number; name: string }) => void;
  onEdit: () => void;
}

const MOVE_SIGN: Record<MovementType, string> = {
  ENTRADA: "+",
  SALIDA: "−",
  AJUSTE: "=",
};

const MOVE_ICON: Record<MovementType, typeof IconArrowUpRight> = {
  ENTRADA: IconArrowUpRight,
  SALIDA: IconArrowDownRight,
  AJUSTE: IconScale,
};

export default function ItemDetailDialog({
  detail,
  loading,
  error,
  onClose,
  onMovement,
  onEdit,
}: Props) {
  const item = detail?.item ?? null;
  const movements = useMemo(() => detail?.movements ?? [], [detail]);
  const stockValue = item ? item.stockQty * (item.unitCost ?? 0) : 0;

  return (
    <Modal
      title={item ? item.name : "Detalle del material"}
      subtitle={item ? `${item.code} · ${INVENTORY_CATEGORY_META[item.category]?.label ?? item.category}` : undefined}
      onClose={onClose}
      width={640}
      footer={
        item ? (
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onMovement({ id: item.id, name: item.name })}
            >
              <IconArrowUpRight size={16} /> Movimiento
            </button>
            <button type="button" className="btn btn-primary" onClick={onEdit}>
              <IconEdit size={16} /> Editar
            </button>
          </>
        ) : null
      }
    >
      <div className="modal-body">
        {error ? (
          <p className="field-error">{error}</p>
        ) : loading || !item ? (
          <div>
            <div className="skeleton" style={{ height: 90, marginBottom: 14 }} />
            <div className="skeleton skeleton-text" style={{ width: "60%" }} />
            <div className="skeleton skeleton-text" style={{ width: "40%" }} />
          </div>
        ) : (
          <>
            <dl className="detail-grid">
              <div>
                <dt>Stock</dt>
                <dd>
                  {fmtQty(item.stockQty)} {item.unit}
                </dd>
              </div>
              <div>
                <dt>Mínimo</dt>
                <dd>{fmtQty(item.minStock)}</dd>
              </div>
              <div>
                <dt>Costo unit.</dt>
                <dd>{fmtCOP(item.unitCost)}</dd>
              </div>
              <div>
                <dt>Valor en stock</dt>
                <dd>{fmtCOP(stockValue)}</dd>
              </div>
              <div>
                <dt>Material</dt>
                <dd>{item.material ?? "—"}</dd>
              </div>
              <div>
                <dt>Tamaño</dt>
                <dd>{item.size ?? "—"}</dd>
              </div>
              <div>
                <dt>Proveedor</dt>
                <dd>{item.supplier ?? "—"}</dd>
              </div>
              <div>
                <dt>Ubicación</dt>
                <dd>{item.location ?? "—"}</dd>
              </div>
              <div>
                <dt>Lote</dt>
                <dd>{item.lotNumber ?? "—"}</dd>
              </div>
              <div>
                <dt>Vencimiento</dt>
                <dd>{item.expiresAt ? fmtDate(item.expiresAt) : "—"}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{item.active ? "Activo" : "Inactivo"}</dd>
              </div>
              <div>
                <dt>Actualizado</dt>
                <dd>{fmtDateTime(item.updatedAt)}</dd>
              </div>
            </dl>

            {item.notes ? <p className="field-hint mt-2">{item.notes}</p> : null}

            <h3
              className="row"
              style={{ fontSize: 13.5, margin: "18px 0 10px", gap: 8 }}
            >
              <IconHistory size={16} />
              Historial de movimientos
              <span className="badge badge-outline">{movements.length} registro(s)</span>
            </h3>

            {movements.length === 0 ? (
              <p className="muted" style={{ fontSize: 13 }}>
                Sin movimientos registrados.
              </p>
            ) : (
              <ul className="kardex" style={{ maxHeight: 320, overflowY: "auto", listStyle: "none", margin: 0, padding: 0 }}>
                {movements.map((m) => {
                  const t = m.type as MovementType;
                  const Icon = MOVE_ICON[t] ?? IconScale;
                  return (
                    <li key={m.id} className="kardex-row">
                      <span className={`kardex-icon ${TYPE_CLS[t]}`} aria-hidden="true">
                        <Icon size={16} />
                      </span>
                      <div className="kardex-main">
                        <span className={`kardex-qty ${TYPE_CLS[t]}`}>
                          {MOVE_SIGN[t]}
                          {fmtQty(m.qty)}
                        </span>{" "}
                        <span className="muted" style={{ fontSize: 12 }}>
                          {t === "AJUSTE" ? "(conteo físico)" : item.unit}
                        </span>
                        {m.reason ? (
                          <div className="cell-sub">{m.reason}</div>
                        ) : null}
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
                          → {fmtQty(m.stockAfter)} {item.unit}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

const TYPE_CLS: Record<MovementType, string> = {
  ENTRADA: "t-entrada",
  SALIDA: "t-salida",
  AJUSTE: "t-ajuste",
};
