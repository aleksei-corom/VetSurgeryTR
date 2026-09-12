// VetSurgeryTR — pantalla de acceso local.
// Puerta de entrada de la app: sin sesión activa no se muestra ningún dato.
// Credenciales iniciales (documentadas en el README): admin / admin123 — el
// propio diálogo ofrece el cambio de contraseña en el primer ingreso.
import { useState } from "react";
import type { FormEvent } from "react";
import { changePassword, getErrorMessage, login } from "@/lib/ipc";
import type { Session } from "@/types";

interface LoginScreenProps {
  onAuthenticated: (session: Session) => void;
}

export default function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Primer ingreso con la contraseña inicial: pide una nueva al instante.
  const [mustChange, setMustChange] = useState<Session | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [repeat, setRepeat] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    login(username.trim(), password)
      .then((session) => {
        if (password === "admin123") {
          setMustChange(session);
        } else {
          onAuthenticated(session);
        }
      })
      .catch((err: unknown) => setError(getErrorMessage(err)))
      .finally(() => setBusy(false));
  }

  function submitNewPassword(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (newPassword.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (newPassword !== repeat) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setError(null);
    setBusy(true);
    changePassword(password, newPassword)
      .then(() => {
        if (mustChange) onAuthenticated(mustChange);
      })
      .catch((err: unknown) => setError(getErrorMessage(err)))
      .finally(() => setBusy(false));
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={mustChange ? submitNewPassword : submit}>
        <img src="/icon.png" width={64} height={64} alt="Logo VetSurgeryTR" />
        <h1 className="login-title">VetSurgeryTR</h1>
        <p className="muted login-sub">
          {mustChange
            ? "Por seguridad, define una nueva contraseña antes de continuar."
            : "Cirugía ortopédica veterinaria · acceso local"}
        </p>

        {mustChange ? (
          <>
            <label className="field">
              <span>Nueva contraseña</span>
              <input
                type="password"
                autoFocus
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
              />
            </label>
            <label className="field">
              <span>Repetir nueva contraseña</span>
              <input
                type="password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                required
              />
            </label>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Guardando…" : "Guardar y entrar"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setMustChange(null)}
              disabled={busy}
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <label className="field">
              <span>Usuario</span>
              <input
                type="text"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label className="field">
              <span>Contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Verificando…" : "Iniciar sesión"}
            </button>
          </>
        )}

        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}

        <p className="muted login-foot">
          Sesión local · las acciones quedan registradas en la bitácora a tu nombre.
        </p>
      </form>
    </div>
  );
}
