// VetSurgeryTR — primitivas de UI compartidas: Modal accesible, ConfirmDialog
// y sistema de Toasts (contexto + hook). Reemplaza las implementaciones
// ad-hoc que vivían dentro de PatientsView.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { IconAlert, IconCheck, IconClose } from "./icons";

/* ================================ Modal ================================== */

interface ModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  /** Ancho máximo del diálogo en px (default 700). */
  width?: number;
  footer?: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo modal accesible: focus atrapado, cierre con Escape y clic en el
 * fondo, bloqueo del scroll del body y devolución del foco al cerrar.
 * En pantallas <640px se convierte en hoja de pantalla completa (CSS).
 */
export function Modal({ title, subtitle, onClose, children, width = 700, footer }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";

    const dialog = dialogRef.current;
    const first = dialog?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Tab" && dialog) {
        const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (el) => el.offsetParent !== null,
        );
        if (items.length === 0) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      restoreFocusRef.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width: `min(${width}px, 100%)` }}
      >
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
            <IconClose size={18} />
          </button>
        </div>
        {children}
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ============================ ConfirmDialog =============================== */

interface ConfirmDialogProps {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  onConfirm,
  onCancel,
  busy = false,
}: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onCancel} width={440}>
      <div className="modal-body">
        <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
          <span
            className="confirm-icon"
            style={{
              background: danger ? "var(--red-soft)" : "var(--primary-soft)",
              color: danger ? "var(--red)" : "var(--primary)",
            }}
            aria-hidden="true"
          >
            <IconAlert size={20} />
          </span>
          <div style={{ fontSize: 14, lineHeight: 1.55 }}>{message}</div>
        </div>
      </div>
      <div className="modal-foot">
        <button type="button" className="btn btn-outline" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? <span className="spin" /> : null}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/* ================================= Toasts ================================= */

interface ToastItem {
  id: number;
  kind: "success" | "error" | "info";
  msg: string;
}

interface ToastContextValue {
  push: (kind: ToastItem["kind"], msg: string) => void;
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Hook de acceso a los toasts: `const toast = useToast(); toast.success("…")`. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}

const TOAST_TTL = 4200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const remove = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastItem["kind"], msg: string) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { id, kind, msg }]);
      window.setTimeout(() => remove(id), TOAST_TTL);
    },
    [remove],
  );

  const value = useRef<ToastContextValue>({
    push,
    success: (msg) => push("success", msg),
    error: (msg) => push("error", msg),
    info: (msg) => push("info", msg),
  });
  // Mantener las funciones estable entre renders.
  value.current.push = push;

  return (
    <ToastContext.Provider value={value.current}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast${t.kind === "error" ? " toast-error" : ""}`}
            role={t.kind === "error" ? "alert" : "status"}
          >
            {t.kind === "success" ? <IconCheck size={17} /> : <IconAlert size={17} />}
            <span style={{ flex: 1 }}>{t.msg}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => remove(t.id)}
              aria-label="Descartar aviso"
            >
              <IconClose size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
