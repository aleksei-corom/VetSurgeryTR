import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },

  // tauri dev lee la salida de la consola; no la limpiamos.
  clearScreen: false,

  server: {
    // Tauri espera un puerto fijo; falla si el puerto está ocupado.
    port: 1420,
    strictPort: true,
    // true → escucha en todas las interfaces (necesario para `tauri android dev`).
    host: host || true,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Vite no vigila src-tauri: Rust se recompila aparte con `tauri dev`.
      ignored: ["**/src-tauri/**"],
    },
  },
  // Las variables de entorno con estos prefijos quedan expuestas en
  // import.meta.env dentro del webview de Tauri.
  envPrefix: ["VITE_", "TAURI_ENV_*"],
});
