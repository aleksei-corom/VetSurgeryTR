// VetSurgeryTR — raíz de la SPA: shell + vista activa por estado.
// El banner superior avisa si Firebird Embedded no arrancó (p. ej. falta la
// librería del cliente en src-tauri/binaries/firebird/); ahora es plegable
// para no robar espacio de pantalla una vez leído.
import { useState } from "react";
import { AppShell, type ViewId } from "./components/AppShell";
import DashboardView from "./components/DashboardView";
import PatientsView from "./components/PatientsView";
import SurgeriesView from "./components/SurgeriesView";
import InventoryView from "./components/InventoryView";
import AuditView from "./components/AuditView";
import AdminView from "./components/AdminView";
import BackupDialog from "./components/BackupDialog";
import LoginScreen from "./components/LoginScreen";
import { ToastProvider, useToast } from "./components/ui";
import { getDbStatus, getSession } from "./lib/ipc";
import { useAsync } from "./lib/use-async";
import { IconAlert, IconClose, IconDatabase } from "./components/icons";

const BANNER_KEY = "vst-banner-dismissed";

function DbBanner() {
  const db = useAsync(() => getDbStatus(), []);
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem(BANNER_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (!db.data || hidden) return null;

  if (!db.data.ok) {
    return (
      <div className="banner danger" role="alert">
        <IconAlert size={18} />
        <div className="banner-body">
          <b>Firebird Embedded no está disponible.</b> {db.data.initError}
          <br />
          Copia <span className="mono">fbclient.dll</span> (+
          <span className="mono">firebird.msg</span>) en{" "}
          <span className="mono">src-tauri/binaries/firebird/</span> y reinicia la app. Ruta
          esperada: <span className="mono">{db.data.fbclientPath}</span>
        </div>
        <div className="banner-actions">
          <button
            type="button"
            className="banner-btn"
            aria-label="Ocultar aviso"
            onClick={() => {
              setHidden(true);
              try {
                sessionStorage.setItem(BANNER_KEY, "1");
              } catch {
                /* noop */
              }
            }}
          >
            <IconClose size={15} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="banner" role="status">
      <IconDatabase size={18} />
      <div className="banner-body">
        Base de datos lista (esquema v{db.data.schemaVersion}) ·{" "}
        <span className="mono">{db.data.dbPath}</span>
      </div>
      <div className="banner-actions">
        <button
          type="button"
          className="banner-btn"
          aria-label="Ocultar estado de la base de datos"
          onClick={() => {
            setHidden(true);
            try {
              sessionStorage.setItem(BANNER_KEY, "1");
            } catch {
              /* noop */
            }
          }}
        >
          <IconClose size={15} />
        </button>
      </div>
    </div>
  );
}

function Shell() {
  const toast = useToast();
  const [view, setView] = useState<ViewId>("dashboard");
  const [backupsOpen, setBackupsOpen] = useState(false);
  // La sesión vive en el backend (memoria): una sola fuente de verdad.
  // Login y logout recargan esta consulta; morir al cerrar la app es a
  // propósito, así que en la práctica siempre se pide login al abrir.
  const sess = useAsync(getSession, []);

  if (sess.loading) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <p className="muted">Cargando sesión…</p>
        </div>
      </div>
    );
  }

  if (!sess.data) {
    return (
      <LoginScreen
        onAuthenticated={(s) => {
          sess.reload();
          toast.success(`Bienvenido, ${s.user.displayName}`);
        }}
      />
    );
  }

  return (
    <>
      <AppShell
        active={view}
        onNavigate={setView}
        onOpenBackups={() => setBackupsOpen(true)}
        session={sess.data}
        onLoggedOut={() => sess.reload()}
        onPasswordChanged={() => toast.success("Contraseña actualizada")}
      >
        <DbBanner />
        {view === "dashboard" && <DashboardView onNavigate={setView} />}
        {view === "patients" && <PatientsView />}
        {view === "surgeries" && <SurgeriesView />}
        {view === "inventory" && <InventoryView />}
        {view === "audit" && <AuditView />}
        {view === "admin" &&
          (sess.data.user.role === "ADMIN" ? <AdminView /> : <AuditView />)}
      </AppShell>
      {backupsOpen ? <BackupDialog onClose={() => setBackupsOpen(false)} /> : null}
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
