// Puente entre los botones de impresión y el diálogo de vista previa.
// Construye el documento (async: lee la identidad de la clínica) y abre la
// vista previa; los errores de generación se reportan como toast.
import { useCallback, useState } from "react";
import type { PrintDoc } from "./clinical-docs";
import { useToast } from "@/components/ui";

export interface PrintPreviewState {
  doc: PrintDoc | null;
  loading: boolean;
  error: string | null;
}

export function usePrintPreview(): PrintPreviewState & {
  open: (build: () => Promise<PrintDoc>) => void;
  close: () => void;
} {
  const toast = useToast();
  const [state, setState] = useState<PrintPreviewState>({ doc: null, loading: false, error: null });

  const close = useCallback(() => {
    setState({ doc: null, loading: false, error: null });
  }, []);

  const open = useCallback(
    (build: () => Promise<PrintDoc>) => {
      setState({ doc: null, loading: true, error: null });
      build()
        .then((doc) => setState({ doc, loading: false, error: null }))
        .catch((e: unknown) => {
          setState({ doc: null, loading: false, error: null });
          toast.error(`No se pudo generar el documento: ${e instanceof Error ? e.message : String(e)}`);
        });
    },
    [toast],
  );

  return { ...state, open, close };
}
