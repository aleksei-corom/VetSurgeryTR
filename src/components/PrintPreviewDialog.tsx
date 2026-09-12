// Vista previa de impresión: muestra el documento clínico tal como saldrá por
// el papel (mismo HTML generado para el iframe de impresión, en una página A4
// a escala) ANTES de abrir el diálogo nativo de impresión del sistema.
//
// El documento se inyecta en un <iframe> con sandbox="allow-same-origin" y
// SIN allow-modals: así el iframe no puede abrir diálogos propios (p. ej. un
// window.print() incrustado) y la impresión se controla solo desde el botón.
import { useEffect, useRef, useState } from "react";
import type { PrintDoc } from "@/lib/clinical-docs";
import { printHtml } from "@/lib/clinical-docs";
import { logDocumentPrint } from "@/lib/ipc";
import { Modal, useToast } from "./ui";
import { IconClose, IconDownload, IconMinus, IconPlus } from "./icons";

interface Props {
  doc: PrintDoc | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  /** Se notifica cuando la impresión queda registrada en la bitácora
   *  (para refrescar contadores en el diálogo que abre la vista previa). */
  onPrinted?: () => void;
}

const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.5;

export default function PrintPreviewDialog({ doc, loading, error, onClose, onPrinted }: Props) {
  const [zoom, setZoom] = useState(0.7);
  const printRef = useRef<HTMLIFrameElement>(null);
  const toast = useToast();

  // El zoom se reinicia en cada documento para que quepa en el modal.
  useEffect(() => {
    setZoom(0.7);
  }, [doc?.title]);

  // Carga del documento dentro del iframe (con sandbox, sin scripts).
  useEffect(() => {
    const frame = printRef.current;
    if (!frame || !doc) return;
    const idoc = frame.contentDocument;
    if (!idoc) return;
    idoc.open();
    idoc.write(doc.html);
    idoc.close();
  }, [doc]);

  return (
    <Modal
      title={doc ? `Vista previa · ${doc.title}` : "Vista previa de impresión"}
      subtitle="Documento A4 · así saldrá impreso (o guardado como PDF)"
      onClose={onClose}
      width={860}
      footer={
        <div className="row" style={{ gap: 8, flexWrap: "wrap", width: "100%" }}>
          <div className="row" style={{ gap: 4, marginRight: "auto" }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 10) / 10))}
              disabled={zoom <= ZOOM_MIN}
              title="Alejar"
            >
              <IconMinus size={14} />
            </button>
            <span className="muted" style={{ fontSize: 12.5, minWidth: 46, textAlign: "center" }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 10) / 10))}
              disabled={zoom >= ZOOM_MAX}
              title="Acercar"
            >
              <IconPlus size={14} />
            </button>
          </div>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            <IconClose size={16} /> Cerrar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!doc}
            onClick={() => {
              if (!doc) return;
              // Registro de impresión en la bitácora (quién y cuándo). Se
              // dispara al confirmar, antes de abrir el diálogo nativo; si
              // falla solo avisa: no bloquea la impresión del documento.
              logDocumentPrint({
                document: doc.document,
                entityCode: doc.entityCode,
                entityId: doc.entityId,
              })
                .then(() => onPrinted?.())
                .catch((e: unknown) =>
                  toast.error(
                    `No se pudo registrar la impresión en la bitácora: ${e instanceof Error ? e.message : String(e)}`,
                  ),
                );
              printHtml(doc.title, doc.html);
            }}
            title="Abrir el diálogo de impresión del sistema (papel o PDF) · queda registrado en la bitácora"
          >
            <IconDownload size={16} /> Imprimir / PDF
          </button>
        </div>
      }
    >
      <div className="modal-body" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 24 }}>
            <div className="skeleton" style={{ height: 320, marginBottom: 14 }} />
            <div className="skeleton skeleton-text" style={{ width: "60%" }} />
          </div>
        ) : error ? (
          <p className="field-error" style={{ padding: 24 }}>
            {error}
          </p>
        ) : doc ? (
          <div
            style={{
              background: "var(--bg, #334155)",
              overflow: "auto",
              maxHeight: "calc(100vh - 230px)",
              padding: "18px 12px",
              display: "flex",
              justifyContent: "center",
            }}
          >
            {/* Página A4 (210 mm ≈ 794 px) escalada con transform. */}
            <div style={{ width: 794 * zoom, height: 1123 * zoom }}>
              <iframe
                ref={printRef}
                title="Vista previa del documento"
                sandbox="allow-same-origin"
                style={{
                  width: 794,
                  height: 1123,
                  border: "none",
                  background: "#fff",
                  boxShadow: "0 2px 14px rgba(0,0,0,.35)",
                  transform: `scale(${zoom})`,
                  transformOrigin: "top left",
                }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
