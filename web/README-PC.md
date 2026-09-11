# VetSurgeryTR 🦴🔪 — Paquete completo (web + escritorio)

Sistema de gestión para clínicas veterinarias especializadas en **cirugía ortopédica**:
pacientes, agenda quirúrgica, inventario de implantes (platinas, clavos, tornillos…)
y controles postoperatorios.

Este ZIP contiene **dos aplicaciones**:

| Carpeta | Qué es | Stack |
|---|---|---|
| `/` (raíz) | **Versión web** (la que viste en el preview) | Next.js 16 + React 19 + TypeScript + Prisma/SQLite + Tailwind 4 + shadcn/ui |
| `/desktop` | **Versión escritorio** (stack ISALAB-TR) | Tauri v2 + Rust + React (Vite) + Firebird 5 embebido |

---

## 🚀 Opción A — Probar la WEB en tu PC (5 minutos)

**Requisitos:** [Bun](https://bun.sh) ≥ 1.1 (o Node 18+ con npm; los comandos abajo usan bun).

```bash
bun install          # dependencias
bun run dev          # http://localhost:3000
```

La base de datos **ya viene con datos de demostración** (`db/custom.db`: 10 pacientes,
9 cirugías, 39 ítems de inventario, movimientos y controles). No necesitas nada más.

> Si prefieres una base limpia o volver a sembrar:
> ```bash
> rm db/custom.db && bun run db:push     # crea el esquema
> bun scripts/seed.ts                    # dataset demo completo
> ```

**Extra (PWA):** abre la web desde un tablet o celular → menú del navegador →
“Instalar aplicación”. Queda como app con ícono propio y navegación inferior nativa.

---

## 🖥️ Opción B — Compilar la versión ESCRITORIO (Tauri + Rust + Firebird)

**Requisitos:**
1. [Rust](https://rustup.rs) ≥ 1.77.2 (`rustup default stable`)
2. Bun o Node 18+
3. **Firebird 5 embebido**: descarga “Firebird-5.x.x-windows-x64-embedded.zip” de
   <https://firebirdsql.org/en/downloads/> y copia al menos `fbclient.dll` (y
   `firebird.msg` si viene) dentro de `desktop/src-tauri/binaries/firebird/`
   (en Linux: `libfbclient.so`; en macOS: `libfbclient.dylib`).

```bash
cd desktop
bun install
bun run tauri dev      # levanta la ventana (1ª vez compila Rust: varios minutos)
bun run tauri build    # instalador Windows NSIS → src-tauri/target/release/bundle/
```

En el primer arranque la app **crea la base Firebird** en `%APPDATA%/vetsurgerytr/`,
aplica las 3 migraciones (`src-tauri/migrations/`) y siembra datos de demo.

> ⚠️ **Nota honesta:** este kit se generó en un sandbox **sin compilador Rust**.
> El código sigue al 100% los patrones del proyecto ISALAB-TR (mismas crates:
> tauri 2, rsfbclient 0.27 dynamic_loading), pero es posible que `cargo` pida
> algún ajuste menor de versión en el primer `tauri dev`. Está documentado en
> `desktop/README.md`.

**Móvil nativo (futuro):** `bun run tauri android init` / `bun run tauri ios init`
(la ventana ya está configurada con minWidth 560 y la UI tiene barra inferior).

---

## 📂 Estructura del paquete

```
VetSurgeryTR/
├── README-PC.md               ← este archivo
├── worklog.md                 ← bitácora completa de decisiones de diseño
├── prisma/schema.prisma       ← modelo de datos (8 entidades)
├── db/custom.db               ← SQLite con datos demo (versión web)
├── scripts/seed.ts            ← semilla de datos
├── src/                       ← app web Next.js
│   ├── app/api/…              ← 14 route handlers REST (reglas de negocio)
│   └── features/…             ← vistas: dashboard, pacientes, cirugías, inventario
├── public/                    ← PWA: manifest + iconos
└── desktop/                   ← app de escritorio (Tauri v2 + Rust + Firebird)
    ├── README.md              ← guía detallada de la versión escritorio
    ├── src/                   ← frontend React + Vite + cliente IPC tipado
    └── src-tauri/
        ├── migrations/        ← DDL Firebird (dominios, generadores, triggers) + seed
        └── src/               ← 23 commands IPC, repositorios, bootstrap de BD
```

## 🔑 Reglas de negocio implementadas (ambas versiones)

- Códigos secuenciales `PAC-2026-0001` · `CIR-2026-0001` · `INV-0001`
- Estados de cirugía: PROGRAMADA → EN_CURSO / COMPLETADA / CANCELADA
  (con transiciones validadas y registro de inicio/fin)
- Al **completar** una cirugía se descuenta el inventario usado (SALIDA
  transaccional por material; aborta si no hay stock: “Stock insuficiente”)
- Movimientos ENTRADA / SALIDA / AJUSTE con existencias posteriores registradas
- Controles postoperatorios agendables con estado CUMPLIDO / VENCIDO
- Alertas de stock bajo (stock ≤ mínimo) y tablero con 6 KPIs + gráficas
