// VetSurgeryTR — chip de usuario de la cabecera: quién está con sesión
// activa, cierre de sesión y cambio de contraseña.
import { useState } from "react";
import { changePassword, getErrorMessage, logout } from "@/lib/ipc";
import type { Session } from "@/types";
import { Modal } from "./ui";
import { IconShield } from "./icons";

interface UserChipProps {
  session: Session;
  onLoggedOut: () => void;
  /** Notifica «contraseña actualizada» (p. ej. para un toast del padre). */
  onPasswordChanged?: () => void;
}

export default function UserChip({ session, onLoggedOut, onPasswordChanged }: UserChipProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const initials = session.user.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  function doLogout() {
    setMenuOpen(false);
    logout()
      .then(onLoggedOut)
      .catch(() => onLoggedOut()); // sin sesión en el backend igual cae al login
  }

  function submitPassword() {
    if (busy) return;
    if (next.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (next !== repeat) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setError(null);
    setBusy(true);
    changePassword(current, next)
      .then(() => {
        setPwdOpen(false);
        setCurrent("");
        setNext("");
        setRepeat("");
        onPasswordChanged?.();
      })
      .catch((err: unknown) => setError(getErrorMessage(err)))
      .finally(() => setBusy(false));
  }

  return (
    <div className="user-chip-wrap">
      <button
        type="button"
        className="user-chip"
        onClick={() => setMenuOpen((v) => !v)}
        aria-expanded={menuOpen}
        title={`${session.user.displayName} (@${session.user.username})`}
      >
        <span className="user-avatar" aria-hidden="true">
          {initials || "?"}
        </span>
        <span className="user-name">{session.user.displayName}</span>
      </button>

      {menuOpen && (
        <div className="user-menu" role="menu">
          <div className="user-menu-head">
            <b>{session.user.displayName}</b>
            <span className="muted">
              @{session.user.username} · {session.user.role === "ADMIN" ? "Administrador" : "Veterinario"}
            </span>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setPwdOpen(true);
            }}
          >
            <IconShield size={15} /> Cambiar contraseña
          </button>
          <button type="button" role="menuitem" className="danger" onClick={doLogout}>
            Cerrar sesión
          </button>
        </div>
      )}

      {pwdOpen && (
        <Modal title="Cambiar contraseña" onClose={() => setPwdOpen(false)}>
          <form
            className="dialog-form"
            onSubmit={(e) => {
              e.preventDefault();
              submitPassword();
            }}
          >
            <label className="field">
              <span>Contraseña actual</span>
              <input
                type="password"
                autoFocus
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <label className="field">
              <span>Nueva contraseña</span>
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </label>
            <label className="field">
              <span>Repetir nueva contraseña</span>
              <input
                type="password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setPwdOpen(false)}
                disabled={busy}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
