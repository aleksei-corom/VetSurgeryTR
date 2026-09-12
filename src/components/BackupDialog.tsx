// Respaldos de la base de datos: creación con un clic (copia del .fdb en
// reposo), historial de respaldos existentes y guía de restauración.
import { useState } from "react";
import { createBackup, listBackups, type BackupFile } from "@/lib/ipc";
import { fmtBytes, fmtDateTime } from "@/lib/format";
import { useAsync } from "@/lib/use-async";
import { Modal, useToast } from "./ui";
import {
  IconAlert,
  IconCopy,
  IconDatabase,
  IconFolder,
  IconPlus,
  IconShield,
} from "./icons";

interface Props {
  onClose: () => void;
}

export default function BackupDialog({ onClose }: Props) {
  const toast = useToast();
  const backups = useAsync(() => listBackups(), []);
  const [creating, setCreating] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [showRestore, setShowRestore] = useState(false);

  async function handleCreate() {
    setCreating(true);
    try {
      const result = await createBackup();
      toast.success(
        `Respaldo creado: ${result.backup.fileName} (${fmtBytes(result.backup.sizeBytes)}).`,
      );
      backups.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el respaldo.");
    } finally {
      setCreating(false);
    }
  }

  async function copyPath(b: BackupFile) {
    try {
      await navigator.clipboard.writeText(b.fullPath);
      setCopiedPath(b.fileName);
      window.setTimeout(() => setCopiedPath(null), 2000);
    } catch {
      toast.error("No se pudo copiar la ruta al portapapeles.");
    }
  }

  const list = backups.data ?? [];

  return (
    <Modal
      title="Respaldos de la base de datos"
      subtitle="Copias puntuales del archivo Firebird, guardadas junto a la base de datos."
      onClose={onClose}
      width={700}
      footer={
        <>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setShowRestore((v) => !v)}
          >
            <IconShield size={16} />
            {showRestore ? "Ocultar guía" : "¿Cómo restauro?"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={creating || backups.loading}
          >
            {creating ? <span className="spin" /> : <IconPlus size={16} />}
            {creating ? "Creando respaldo…" : "Crear respaldo ahora"}
          </button>
        </>
      }
    >
      <div className="modal-body">
        {showRestore ? (
          <div className="banner" role="note" style={{ marginBottom: 16 }}>
            <IconShield size={18} />
            <div className="banner-body">
              <b>Restauración (guía):</b>
              <br />
              1. Cierra VetSurgeryTR por completo.
              <br />
              2. Copia el respaldo elegido sobre la base actual — respeta el nombre{" "}
              <span className="mono">vetsurgerytr.fdb</span> — en la carpeta de datos que se muestra
              abajo (o guárdala aparte y renombra la actual como <span className="mono">.bak</span>{" "}
              antes de sobreescribir).
              <br />
              3. Vuelve a abrir la app: si el respaldo tiene un esquema más antiguo (columna{" "}
              <span className="mono">v</span> del nombre), las migraciones pendientes se aplican
              solas al arrancar.
              <br />
              <b>Nota:</b> la restauración es manual por diseño — evitar sobreescribir la base en
              vivo por accidente.
            </div>
          </div>
        ) : null}

        {/* ---------- Estado vacío ---------- */}
        {backups.loading ? (
          <div className="loading-row">
            <span className="spin" /> Buscando respaldos…
          </div>
        ) : backups.error ? (
          <div className="state state-error" style={{ padding: "24px 12px" }}>
            <IconAlert size={24} />
            <h3>No se pudo leer la carpeta de respaldos</h3>
            <p>{backups.error}</p>
          </div>
        ) : list.length === 0 ? (
          <div className="state" style={{ padding: "28px 12px" }}>
            <IconDatabase size={26} />
            <h3>Aún no hay respaldos</h3>
            <p>
              Crea el primero con el botón de abajo; la copia queda en la carpeta{" "}
              <span className="mono">backups</span> del directorio de datos y no pesa más que la
              base.
            </p>
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {list.map((b) => (
              <li
                key={b.fullPath}
                className="row wrap"
                style={{
                  gap: 8,
                  padding: "9px 10px",
                  border: "1px solid var(--border-soft)",
                  borderRadius: "var(--radius-sm)",
                  marginBottom: 6,
                }}
              >
                <IconDatabase size={16} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="cell-main" style={{ fontSize: 13 }}>
                    {b.fileName}
                  </div>
                  <div className="cell-sub" style={{ overflowWrap: "anywhere" }}>
                    {fmtDateTime(b.modifiedAt)} · {fmtBytes(b.sizeBytes)} · esquema v
                    {b.schemaVersion}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => copyPath(b)}
                  title="Copiar ruta completa al portapapeles"
                >
                  <IconCopy size={14} />
                  {copiedPath === b.fileName ? "¡Copiada!" : "Ruta"}
                </button>
              </li>
            ))}
          </ul>
        )}

        {list.length > 0 ? (
          <p className="muted mt-2" style={{ fontSize: 12.5 }}>
            {list.length} respaldo(s) · más recientes primero · guarda copias importantes también
            fuera de esta carpeta (USB / nube).
          </p>
        ) : null}

        <p className="field-hint mt-2 row" style={{ gap: 6, fontSize: 12.5 }}>
          <IconFolder size={14} />
          Los respaldos viven en <span className="mono">backups/</span> dentro del directorio de
          datos de la app.
        </p>
      </div>
    </Modal>
  );
}
