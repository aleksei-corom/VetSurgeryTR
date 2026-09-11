# VetSurgeryTR · Kit de escritorio

**VetSurgeryTR** es el sistema de gestión para una clínica veterinaria especializada en **cirugía
ortopédica**: pacientes y propietarios, agenda quirúrgica (TPLO, TTA, ORIF…), inventario de
implantes con consumo por cirugía, movimientos de stock y controles postoperatorios.

Este kit es la versión de **escritorio** del proyecto (stack ISALAB-TR): React 19 + Vite 6 en el
webview, Rust como backend local y **Firebird 5 Embedded** como base de datos, todo empaquetado
con **Tauri v2**.

## Arquitectura

```
┌──────────────────────────── Tauri v2 (ventana) ────────────────────────────┐
│                                                                             │
│  React 19 + Vite 6 (TypeScript)          Rust (src-tauri)                  │
│  ┌─────────────────────────────┐   invoke ┌─────────────────────────────┐  │
│  │ src/components/*View.tsx    │ ───────► │ commands/* (23 commands)    │  │
│  │ src/lib/ipc.ts (tipado)     │ ◄─────── │ repositories/* + migraciones│  │
│  └─────────────────────────────┘  JSON    └──────────────┬──────────────┘  │
│                                                          │ rsfbclient      │
│                                                          │ dynamic_loading  │
│                                              ┌───────────▼──────────────┐  │
│                                              │ Firebird 5 EMBEDDED      │  │
│                                              │ (fbclient.dll / .so/.dylib)│
│                                              └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

- La UI llama a Rust con `invoke()` de `@tauri-apps/api/core`; `src/lib/ipc.ts` es el cliente
  tipado (misma forma de funciones que `api-client.ts` de la app web).
- Rust expone cada operación como un `#[tauri::command]`; los errores viajan serializados como
  `{ type, data }` y el cliente los traduce a mensajes en español.
- **Firebird corre embebido** (sin servidor ni instalación): `rsfbclient` con
  `dynamic_loading` carga la librería del cliente desde `src-tauri/binaries/firebird/`.

## Requisitos

| Requisito | Detalle |
|---|---|
| Rust | ≥ 1.77.2 (`rustup.rs`) — solo para compilar el backend |
| Node 18+ / Bun | para el frontend y el tooling |
| Tauri CLI 2 | `bun add -D @tauri-apps/cli` (ya en `package.json`) |
| Firebird 5 Embedded | descargar de <https://firebirdsql.org/en/downloads/> → «Firebird 5.0 embedded» |

### Firebird 5 Embedded (librería del cliente)

Copia la librería de tu plataforma en `src-tauri/binaries/firebird/` (hay un `LEEME.txt` con el
detalle):

- **Windows**: `fbclient.dll` (imprescindible) y `firebird.msg` (recomendado, mensajes de error).
  En algunos paquetes también se exige `icudt64.dll` — cópiala si el arranque la pide.
- **Linux**: `libfbclient.so` (en desarrollo sirve la del paquete `libfbclient2` de tu distro).
- **macOS**: `libfbclient.dylib`.

> En la primera ejecución, si la librería falta, la app arranca igual y muestra un banner rojo con
> la ruta esperada (comando de diagnóstico `db_status`).

## Puesta en marcha

```bash
cd desktop
bun install                 # dependencias del frontend (React, Vite, Tauri CLI)
bun run tauri dev           # compila Rust + abre la ventana
```

La **primera ejecución** crea la base de datos en `%APPDATA%/vetsurgerytr/vetsurgerytr.fdb`
(Windows; en Linux/macOS, el equivalente `app_data_dir` de Tauri), aplica las **migraciones**
(`src-tauri/migrations/`) y ejecuta el **seed** de demostración: 8 propietarios, 9 pacientes,
39 referencias de inventario ortopédico, 7 cirugías y controles postoperatorios con fechas
relativas a hoy.

```bash
bun run tauri build         # instalador NSIS → src-tauri/target/release/bundle/
bun run dev                 # solo el webview en http://localhost:1420 (sin backend)
bun run tauri icon src-tauri/icons/icon.png   # regenera todos los tamaños de icono
```

> `bun run dev` abre la UI pero `invoke()` no está disponible fuera de Tauri: las vistas muestran
> su estado de error con botón *Reintentar*. Es el comportamiento esperado.

## Estructura del proyecto

```
desktop/
├── index.html                  Entrada del webview (es-ES, theme-color teal)
├── package.json                Scripts: dev / build / preview / tauri
├── vite.config.ts              Puerto 1420 fijo, alias @, HMR para móvil
├── tsconfig(.node).json        TypeScript strict, paths @/*
├── public/
│   ├── favicon.png             Icono 64×64 (webview / PWA)
│   └── icon.png                Logo 512×512
├── scripts/gen-icons.mjs       Regenera src-tauri/icons desde public/icon.png (sharp)
├── src/
│   ├── main.tsx                Bootstrap de React
│   ├── App.tsx                 Vista activa por estado + banner de estado de Firebird
│   ├── styles.css              Tema teal (#0d7d74), shell, cards 12px, tablas, badges, móvil
│   ├── types.ts                Contrato de tipos (copia adaptada de api-types.ts, ids number)
│   ├── lib/
│   │   ├── ipc.ts              Cliente tipado de invoke() (22 comandos + db_status)
│   │   ├── format.ts           Fechas estilo Firebird, COP, edad, sexo
│   │   └── use-async.ts        useAsync (rol TanStack Query) + useDebounced
│   └── components/
│       ├── AppShell.tsx        Sidebar 240px + bottom-nav móvil + header con fecha es-CO
│       ├── DashboardView.tsx   6 KPIs, próximas cirugías, alertas de stock, barras por mes
│       ├── PatientsView.tsx    Búsqueda + filtro especie + tabla + alta con upsert de dueño
│       ├── SurgeriesView.tsx   Tabs por estado con contadores + tabla resumen (solo lectura)
│       └── InventoryView.tsx   Búsqueda + filtro categoría + semáforo de stock (solo lectura)
└── src-tauri/                  Backend Rust (ver apartado de commands)
    ├── tauri.conf.json         Ventana 1280×820 (min 560×480), NSIS, recursos Firebird
    ├── binaries/firebird/      ← coloca aquí fbclient.dll / .so / .dylib
    ├── migrations/             0001 dominios · 0002 tablas · 0003 seed
    └── src/                    commands · repositories · models · db
```

### Commands IPC

Los nombres y parámetros coinciden 1:1 con los endpoints de la app web (el transporte cambia de
HTTP REST a `invoke`). Los argumentos se pasan en camelCase (conversión por defecto de Tauri).

| Command (Rust) | Firma TS en `lib/ipc.ts` | Equivalente web |
|---|---|---|
| `db_status` | `getDbStatus() → DbStatus` | — |
| `get_dashboard` | `getDashboard() → DashboardData` | `GET /api/dashboard` |
| `list_owners` | `listOwners(search?) → Owner[]` | `GET /api/owners` |
| `create_owner` | `createOwner(input) → Owner` | `POST /api/owners` |
| `list_vets` | `listVets() → Vet[]` | `GET /api/vets` |
| `create_vet` | `createVet(input) → Vet` | `POST /api/vets` |
| `list_patients` | `listPatients({search, species, active}) → Patient[]` | `GET /api/patients` |
| `get_patient` | `getPatient(id) → PatientDetail` | `GET /api/patients/:id` |
| `create_patient` | `createPatient(input) → Patient` (upsert de propietario) | `POST /api/patients` |
| `update_patient` | `updatePatient(id, input) → Patient` | `PATCH /api/patients/:id` |
| `list_inventory_items` | `listInventoryItems({search, category, lowStock}) → InventoryItem[]` | `GET /api/inventory` |
| `get_inventory_item` | `getInventoryItem(id) → InventoryItemDetail` | `GET /api/inventory/:id` |
| `create_inventory_item` | `createInventoryItem(input) → InventoryItem` | `POST /api/inventory` |
| `update_inventory_item` | `updateInventoryItem(id, input) → InventoryItem` | `PATCH /api/inventory/:id` |
| `create_movement` | `createMovement(itemId, {type, qty, unitCost?, reason?, surgeryId?}) → MovementResult` | `POST /api/inventory/:id/movements` |
| `list_surgeries` | `listSurgeries({status, search, patientId}) → Surgery[]` | `GET /api/surgeries` |
| `get_surgery` | `getSurgery(id) → SurgeryDetail` | `GET /api/surgeries/:id` |
| `create_surgery` | `createSurgery(input) → SurgeryDetail` | `POST /api/surgeries` |
| `update_surgery` | `updateSurgery(id, input) → SurgeryDetail` (transición de estado + consumo de inventario + sync de materiales) | `PATCH /api/surgeries/:id` |
| `upsert_surgery_material` | `upsertSurgeryMaterial(surgeryId, {itemId, qtyPlanned, qtyUsed?, notes?}) → SurgeryMaterial` | `POST /api/surgeries/:id/materials` |
| `remove_surgery_material` | `removeSurgeryMaterial(surgeryId, materialId) → void` | `DELETE /api/surgeries/:id/materials/:materialId` |
| `create_follow_up` | `createFollowUp(surgeryId, {scheduledDate, type, notes?}) → FollowUp` | `POST /api/surgeries/:id/follow-ups` |
| `update_follow_up` | `updateFollowUp(surgeryId, followUpId, {status, notes?}) → FollowUp` | `PATCH /api/surgeries/:id/follow-ups/:followUpId` |

Reglas de negocio replicadas de la web: códigos secuenciales `PAC-AAAA-NNNN`, `INV-NNNN`,
`CIR-AAAA-NNNN`; propietario único por documento; transiciones de estado
`PROGRAMADA→EN_CURSO/COMPLETADA/CANCELADA`; consumo transaccional de inventario al completar la
cirugía; movimientos `ENTRADA/SALIDA/AJUSTE` con snapshot `stockAfter`.

## Móvil (Tauri v2)

La UI ya es responsive: sidebar → **barra de navegación inferior** por debajo de 1024 px y la
ventana de escritorio tiene `minWidth: 560`. Para generar los proyectos nativos:

```bash
bun run tauri android init   # requiere Android SDK + NDK (ver docs de Tauri)
bun run tauri android dev    # con la app en un dispositivo/emulador
bun run tauri ios init       # requiere macOS + Xcode
bun run tauri ios dev
```

Para probar en un teléfono físico durante el desarrollo, define `TAURI_DEV_HOST` con la IP de tu
máquina (Vite ya escucha en todas las interfaces y el HMR usa el puerto 1421).

## Portar el resto de vistas desde el proyecto web

La app web (raíz del monorepo) tiene vistas React **puras** en `src/features/*.tsx` construidas
con shadcn/ui + Tailwind + TanStack Query + react-hook-form + zod. Para traerlas a este kit:

1. `bun add @tanstack/react-query react-hook-form zod` (y los componentes shadcn que use la vista,
   con `tailwindcss` + `class-variance-authority`, o sustitúyelos por el CSS plano del kit).
2. Copia la vista (p. ej. `surgery-detail-dialog.tsx`) y cambia el transporte: donde la web llama
   funciones de `src/lib/api-client.ts`, aquí se usan las equivalentes de `src/lib/ipc.ts`
   (**misma forma de funciones**, solo cambia el tipo de los ids: `number` en escritorio, `string`
   en web).
3. `types.ts` ya contiene el contrato completo (catálogos y entidades); cualquier tipo que falte
   está en `src/lib/api-types.ts` del proyecto web.
4. Envuelve la app en `QueryClientProvider` si usas TanStack Query, o usa el `useAsync` del kit.

Las diferencias de dominio a tener en cuenta: en escritorio `null` significa «no tocar el campo»
en los PATCH (la web distinguía `null` de ausente), y las fechas llegan como
`"YYYY-MM-DD HH:MM:SS"` en vez de ISO con zona.

## Nota sobre este kit

Fue generado en un sandbox **sin Rust ni Firebird**, verificando el frontend con `tsc`. Si al
compilar por primera vez `cargo` reporta algún ajuste menor (p. ej. versión de crates), revísalo
siguiendo los mensajes del compilador — la lógica de dominio está replicada del backend web ya
verificado.
