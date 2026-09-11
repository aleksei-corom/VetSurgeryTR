// VetSurgeryTR — raíz de la SPA de escritorio: shell + vista activa por estado.
// El banner superior avisa si Firebird Embedded no arrancó (p. ej. falta la
// librería del cliente en src-tauri/binaries/firebird/).
import { useState } from "react";
import { AppShell, type ViewId } from "./components/AppShell";
import DashboardView from "./components/DashboardView";
import PatientsView from "./components/PatientsView";
import SurgeriesView from "./components/SurgeriesView";
import InventoryView from "./components/InventoryView";
import { getDbStatus } from "./lib/ipc";
import { useAsync } from "./lib/use-async";
import { IconAlert, IconDatabase } from "./components/icons";

export default function App() {
  const [view, setView] = useState<ViewId>("dashboard");
  const db = useAsync(() => getDbStatus(), []);

  return (
    <AppShell active={view} onNavigate={setView}>
      {db.data && !db.data.ok ? (
        <div className="banner danger" role="alert">
          <IconAlert size={18} />
          <div>
            <b>Firebird Embedded no está disponible.</b> {db.data.initError}
            <br />
            Copia <span className="mono">fbclient.dll</span> (+
            <span className="mono">firebird.msg</span>) en{" "}
            <span className="mono">src-tauri/binaries/firebird/</span> y reinicia la app. Ruta
            esperada: <span className="mono">{db.data.fbclientPath}</span>
          </div>
        </div>
      ) : db.data && db.data.ok ? (
        <div className="banner" role="status">
          <IconDatabase size={18} />
          <div>
            Base de datos lista (esquema v{db.data.schemaVersion}) ·{" "}
            <span className="mono">{db.data.dbPath}</span>
          </div>
        </div>
      ) : null}

      {view === "dashboard" && <DashboardView onNavigate={setView} />}
      {view === "patients" && <PatientsView />}
      {view === "surgeries" && <SurgeriesView />}
      {view === "inventory" && <InventoryView />}
    </AppShell>
  );
}
