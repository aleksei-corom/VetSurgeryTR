# VetSurgeryTR · Kit de escritorio

[![CI](https://github.com/aleksei-corom/VetSurgeryTR/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/aleksei-corom/VetSurgeryTR/actions/workflows/ci.yml)

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
│  │ src/components/*View.tsx    │ ───────► │ commands/* (33 commands)    │  │
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
- Rust expone cada operación como un `#[tauri::command]` **async** (las consultas Firebird
  corren fuera del hilo principal y la ventana no se congela); los errores viajan serializados
  como `{ code, message }` y el cliente los traduce a mensajes en español.
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
│   │   ├── ipc.ts              Cliente tipado de invoke() (39 comandos)
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
| `login` | `login(username, password) → Session` | — (acceso local Argon2id) |
| `get_session` | `getSession() → Session \| null` | — (sesión en memoria del backend) |
| `logout` | `logout() → void` | — |
| `change_password` | `changePassword(actual, nueva) → void` | — (auditado) |
| `db_status` | `getDbStatus() → DbStatus` | — |
| `create_backup` | `createBackup() → { backup, totalBackups }` | — (respaldo puntual del .fdb) |
| `list_backups` | `listBackups() → BackupFile[]` | — (historial, más recientes primero) |
| `export_inventory_csv` | `exportInventoryCsv() → ruta \| null` | — (CSV del inventario completo) |
| `export_kardex_csv` | `exportKardexCsv() → ruta \| null` | — (CSV del kardex, hasta 5.000) |
| `export_audit_csv` | `exportAuditCsv() → ruta \| null` | — (CSV de la bitácora, hasta 5.000) |
| `list_audit_log` | `listAuditLog({entityType?, action?, search?, limit?}) → AuditEntry[]` | — (bitácora de auditoría) |
| `log_document_print` | `logDocumentPrint({document, entityCode, entityId?}) → void` | — (bitácora: impresión de documentos) |
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
| `list_movements` | `listMovements({itemId?, type?, search?, limit?}) → InventoryMovement[]` | — (kardex global del kit) |
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

## Funcionalidades por módulo

### Acceso local (login)

- **Pantalla de acceso** antes de mostrar cualquier dato: usuario + contraseña con hash
  **Argon2id** (sal aleatoria por usuario, migración **0005** que crea la tabla `USERS`).
- **Credenciales iniciales: `admin` / `admin123`** (rol Administrador). El propio diálogo
  **exige definir una contraseña nueva en el primer ingreso** y el cambio queda auditado.
- La **sesión vive en memoria del backend**: al cerrar la app se pierde y hay que volver a
  entrar (sin tokens persistentes, a propósito para un equipo clínico compartido).
- **Toda la bitácora queda atribuida al usuario con sesión** (nombre visible, p. ej.
  «Administrador») en vez del genérico «Sistema local»: movimientos de inventario, cambios de
  estado de cirugías (incluido el consumo de inventario), altas y ediciones de pacientes.
- Chip de usuario en la cabecera con iniciales, menú de **cambio de contraseña** (verifica la
  actual, mínimo 6 caracteres) y **cerrar sesión**.
- **Todos los comandos IPC exigen sesión activa** (lecturas y escrituras), no solo las
  mutaciones: sin login, el backend no expone ningún dato. Las únicas excepciones son las que
  la pantalla de login necesita para existir: `login`, `get_session`, `logout` y `db_status`
  (estado del arranque de Firebird para el banner de configuración).
- Matriz de permisos por rol:

  | Operación | VET (Veterinario) | ADMIN |
  |---|---|---|
  | Panel, pacientes, propietarios, cirugías, inventario, movimientos, controles, bitácora | ✔ | ✔ |
  | Respaldos manuales y exportación CSV | ✔ | ✔ |
  | Crear/editar pacientes, cirugías, ítems y movimientos | ✔ | ✔ |
  | Gestionar veterinarios (alta, desactivar) | ✖ | ✔ |
  | Gestionar usuarios (alta, activar/desactivar, restablecer contraseña) | ✖ | ✔ |

  El rol se valida **en el backend** (`require_admin` revalida en cada comando de gestión): que
  el menú esté oculto para VET es solo la capa visual, no la garantía.

### Administración (módulo «Admin», solo administradores)

- Nueva vista **visible únicamente para sesiones con rol ADMIN** (ni siquiera aparece en el menú
  para los veterinarios, y los comandos del backend vuelven a validar el rol por IPC).
- **Veterinarios**: alta del cuerpo clínico (nombre, tarjeta profesional, especialidad, contacto),
  **búsqueda instantánea** por nombre, T.P., especialidad o contacto (filtrado local, sin viajes
  al backend) y **filtro de estado** (Todos / Solo activos / Solo inactivos — útil para enfocarse
  en el personal activo al agendar), **edición de datos** con **diff auditado campo a campo**
  («T.P.: TP-123456 → TP-789012 · Teléfono: — → 301 222 3344») y **desactivación con
  soft-delete** — conserva todo el historial quirúrgico pero deja de aparecer al agendar. Cada
  alta/cambio queda en la bitácora (entidad `VETERINARIO`).
- **Usuarios de la app**: crear accesos (usuario, nombre visible, contraseña inicial con hash
  Argon2id, rol **Administrador** o **Veterinario**), **búsqueda instantánea** por usuario, nombre
  o rol, **editar** (nombre visible y rol, con **diff auditado** —«Nombre: X → Y · Rol:
  Veterinario → Administrador»— y guarda del último administrador), activar/desactivar y
  **restablecer contraseña** (para olvidos, sin conocer la actual). El username no se editable:
  es la identidad en la bitácora y en los ingresos. Todo auditado (entidad `USUARIO`).
- **Guardas de seguridad**: no puedes desactivar tu propio usuario ni degradarte si eres el
  último administrador activo, no se puede desactivar/degradar al **último administrador activo**
  (la app quedaría sin gestión) y los usernames son únicos (validado en Rust y por restricción
  UNIQUE en la BD).

### Inventario (completo)

- **Alta y edición de materiales** (`INV-NNNN` automático): categoría, tipo/modelo, material,
  talla, unidad, stock mínimo, costo, proveedor, lote, vencimiento, ubicación, notas y
  activación (ambas auditadas como «Creación»/«Edición» a nombre del usuario con sesión). El
  stock **nunca** se edita a mano: solo cambia por movimientos.
- **Movimientos ENTRADA / SALIDA / AJUSTE** con proyección de stock en vivo (rojo si la salida
  supera el disponible, ámbar si queda bajo el mínimo). El AJUSTE fija el valor contado físico,
  incluido **0** («existencia agotada»), y queda registrado con snapshot `stockAfter`.
- **Detalle del ítem con kardex** (últimos 50 movimientos con fecha, motivo, cirugía de origen
  y stock resultante) y acciones rápidas de movimiento/edición.
- **Kardex global** (nuevo comando `list_movements`): historial unificado filtrable por
  material, tipo y búsqueda.
- Desactivar un ítem (soft-delete) conserva su historial y lo oculta del uso quirúrgico.

### Cirugías (completo)

- Programación con paciente, veterinario, procedimiento (sugerencias TPLO/TTA/ORIF…), región,
  lateralidad, agenda, anestesia, ASA y costo.
- Detalle con **editor de materiales** (agregar/quitar, cantidades planeadas y usadas —
  bloqueado en COMPLETADA) y **transiciones de estado** PROGRAMADA → EN_CURSO →
  COMPLETADA/CANCELADA. Al completar, el consumo de inventario es transaccional: si no hay
  stock, la operación completa se aborta con «Stock insuficiente».
- **Controles postoperatorios**: agendar (radiografía, curación, retiro de puntos…) y marcar
  CUMPLIDO / PERDIDO.

### Pacientes (completo)

- Ficha con datos del propietario, clínicos e historial quirúrgico; edición completa
  (incluido activar/desactivar) y alta con reutilización del propietario por documento único.

### Respaldos de un clic

- Botón de respaldo en la cabecera: copia el archivo `vetsurgerytr.fdb` a
  `%APPDATA%/vetsurgerytr/backups/vetsurgerytr-<AAAA-MM-DD-HHMMSS>-v<esquema>.fdb`.
- Antes de copiar, el backend **vacía el pool de conexiones** (quiesce) para que Firebird no
  tenga transacciones en vuelo: la copia es consistente aunque la app esté en uso.
- Diálogo con **historial de respaldos** (fecha, tamaño, versión de esquema, copiar ruta al
  portapapeles) y **guía de restauración** paso a paso: cerrar la app → reemplazar
  `vetsurgerytr.fdb` por el respaldo → reabrir (las migraciones pendientes se aplican solas).

### Documentos imprimibles (consentimiento, fórmula, historia clínica)

- **Diagnóstico formal** (migración **0006**): cada cirugía tiene **diagnóstico presuntivo**
  (se registra al agendar, motivo quirúrgico) y **diagnóstico definitivo** (hallazgo confirmado,
  se registra al completar). Ambos salen en una sección dedicada de la historia clínica y en el
  consentimiento/fórmula — ya no dependen de notas de texto libre.
  **El diagnóstico definitivo es obligatorio para completar la cirugía**: el botón «Completar»
  abre un cuadro que lo exige, y el backend rechaza la transición a `COMPLETADA` si no existe
  (validado también en el smoke test contra Firebird real).

- Desde el detalle de cada cirugía (pie del diálogo): **Consentimiento informado** (con cláusula
  de riesgos y firmas de propietario y veterinario), **Fórmula médica postquirúrgica**
  (medicamentos/implantes usados con dosificación de las notas, indicaciones generales y
  recomendaciones de recuperación) e **Historia clínica quirúrgica** (datos completos del
  procedimiento: descripción, notas pre/postoperatorias, implantes con cantidades y controles).
- Desde la ficha del paciente: **Historia clínica del paciente** (datos del paciente/propietario +
  todo su historial quirúrgico).
- Cada documento se genera como HTML con formato A4 (encabezado de la clínica, secciones,
  tablas de materiales/controles y líneas de firma) y se envía al **diálogo nativo de
  impresión del sistema** mediante un iframe oculto: sale SOLO el documento en el papel — sin
  la interfaz de la app — y permite **guardar como PDF** desde el mismo diálogo.
- **Vista previa de impresión**: cada botón de documento abre primero un diálogo de vista
  previa dentro de la app — la página A4 real (794×1123 px) a escala ajustable (40 %–150 %)
  con zoom −/+, y desde ahí **Imprimir / PDF** entrega el documento al diálogo nativo del
  sistema. Se ve exactamente lo que saldrá en papel antes de imprimirlo.

### Exportación CSV / Excel

- Botón **Exportar** en la pestaña Existencias (inventario completo: códigos, categorías,
  stock, mínimos, costos, valor en stock, proveedor, lote, vencimiento, ubicación y activo),
  botón **Exportar CSV** en el Kardex global (hasta 5.000 movimientos con fecha, tipo,
  ítem, cantidad, stock resultante, motivo, cirugía y paciente de origen) y botón
  **Exportar CSV** en la **Bitácora de auditoría** (hasta 5.000 entradas en orden
  cronológico: fecha, módulo, acción, código e ID de entidad, detalle legible y usuario —
  incluye las **impresiones de documentos clínicos** DOCUMENTO/IMPRIMIR).
- El archivo lo genera **Rust** y se guarda en la **carpeta que elige el usuario** mediante
  el selector nativo (`tauri-plugin-dialog`). Cancelar el selector no produce errores.
- Formato Excel-friendly: separador `;`, **BOM UTF-8** y escape RFC 4180 — doble clic en
  Excel es-CO lo abre con acentos correctos y columnas separadas, sin asistentes.

### Bitácora de auditoría (módulo «Bitácora»)

- **Tarjeta «Documentos impresos» en el Panel**: impresiones de documentos clínicos de los
  **últimos 30 días** agrupadas por tipo (consentimiento, fórmula médica, historia quirúrgica,
  historia del paciente), en barras ordenadas de mayor a menor, con acceso directo a la
  bitácora. Se alimenta de la misma fuente que la bitácora (`AUDIT_LOG`, entidad `DOCUMENTO`,
  acción `IMPRIMIR`). En el **detalle de cada cirugía**, una fila «Impresiones:» sobre los
  botones muestra cuántas veces salió cada documento y la fecha de la última (tooltip), y se
  actualiza al instante tras confirmar una impresión. El **listado de Pacientes** incluye una
  columna «Impresiones» con el total de documentos impresos por paciente (consulta agrupada
  `get_print_totals` con prefijo `PAC-`, una sola query para toda la página), y la ficha del
  paciente muestra el desglose por tipo vía `get_document_prints`.
- Vista nueva en la navegación (escritorio y barra inferior móvil): **quién hizo qué y cuándo**
  sobre movimientos de inventario (ENTRADA/SALIDA/AJUSTE con cantidades y stock resultante),
  **altas y transiciones de estado de cirugías** (incluido el consumo de inventario al
  completar), **altas y ediciones de pacientes** con **diff campo a campo** («Peso: 28.5 kg →
  30 kg · Estado: Activo → Inactivo»), cambios de contraseña de usuarios e
  **impresiones de documentos clínicos** (entidad `DOCUMENTO`, acción `IMPRIMIR`: cada vez que
  se confirma «Imprimir / PDF» en la vista previa queda registrado qué documento, de qué
  cirugía/paciente, quién lo imprimió y cuándo).
- Filtros por módulo y acción (incluye entidades **Usuario**, **Veterinario** y **Documento**), búsqueda libre
  por código (INV-/CIR-/PAC-) y detalle, hasta 1.000 registros, más recientes primero. Solo
  lectura: no se puede borrar desde la app.
- Tabla `AUDIT_LOG` (migración **0004**, se aplica sola al arrancar). Cada entrada se escribe
  **dentro de la transacción** de la operación auditada: si la operación falla y hace rollback,
  la entrada no queda — la bitácora registra únicamente lo que realmente ocurrió.

### UX general

- **Tema claro/oscuro** con toggle persistente (respeta la preferencia del SO por defecto).
- Tablas que se convierten en **tarjetas apiladas** en pantallas angostas (tablet/celular) y
  modales de pantalla completa en móvil; barra inferior de navegación < 1024 px.
- Modales accesibles (foco atrapado, Escape, devolución de foco), sistema de toasts compartido
  y banner de estado de Firebird plegable.
- Pruebas unitarias del backend (`cargo test` en `src-tauri`): aritmética de movimientos,
  transiciones de estado, validaciones y separador SQL de migraciones.

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

## Pruebas y CI

### Pruebas unitarias (Rust, sin Firebird)

Cubren la lógica de dominio pura: aritmética de movimientos (incluida la regresión del AJUSTE
a 0), matriz de transiciones de estado, validadores, escapado CSV y separador SQL de
migraciones.

```bash
cd src-tauri
cargo test          # 23 pruebas · no requieren Firebird ni fbclient.dll
```

El smoke test E2E cubre además el **login local** (hash Argon2id, contraseña incorrecta
rechazada, cambio de contraseña con re-verificación contra la BD) y verifica que **todas las
acciones de la bitácora quedan atribuidas al usuario con sesión** («Administrador»), no al
genérico «Sistema local».

### Smoke test E2E contra Firebird real (opcional, local)

`src-tauri/tests/firebird_smoke.rs` recorre **el mismo camino que `bun run tauri dev` en el
primer arranque** contra un motor Firebird 5 Embedded de verdad: bootstrap (crear BD + 4
migraciones + seed), dashboard, alta/edición de paciente con auditoría, ítem con movimientos
ENTRADA / AJUSTE(0) / SALIDA-rechazada y kardex, cirugía completa con transición de estado
PROGRAMADA → EN_CURSO → COMPLETADA y consumo transaccional de inventario, control
postoperatorio cumplido y bitácora global con los 3 módulos.

Requisito previo: la librería del cliente ya copiada en `src-tauri/binaries/firebird/`
(`fbclient.dll` en Windows, `libfbclient.so`/`.dylib` en Linux/macOS) — exactamente la misma
que usa la app; no hay que instalar ni configurar nada más.

```bash
cd src-tauri
cargo test --test firebird_smoke -- --ignored --nocapture
```

Detalles útiles:

- Está marcado `#[ignore]` a propósito: `cargo test` normal nunca lo intenta sin la librería y
  si `fbclient` no está disponible el test se salta solo (imprime `SKIP: ...`, no falla).
- Usa una **base de datos temporal** en `%TEMP%` (`vst-smoke-<tag>-<pid>.fdb`): jamás toca la
  base real de `%APPDATA%`.
- Es el test que detectó el bug de «string right truncation» al completar una cirugía (tipo
  inferido desde el literal SQL) — por eso se considera bloqueante.

### Smoke tests de UI con Playwright (tema + layout móvil)

`e2e/` automatiza la verificación visual manual sobre la UI real (vite) contra el mock de IPC
(`scripts/dev-ipc-mock.js`, inyectado con `addInitScript` — la app empaquetada nunca lo ve).
Dos proyectos: **desktop** (1280×800) y **mobile** (Pixel 5, 393×851 — bajo el breakpoint de
720px donde las tablas se apilan en tarjetas).

Cubren:

- **Tema**: `data-theme` inicial light, toggle a dark con cambio real de fondo, persistencia en
  `localStorage` entre recargas, y KPIs con fondo opaco en ambos temas.
- **Viewport angosto**: el valor KPI «Valor inventario» no parte cifras (`$ 1.500.000` en una
  línea), etiquetas del gráfico «Documentos impresos» con elipsis (no envueltas), tablas
  apiladas con `data-label` bajo 720px y **cero scroll horizontal** en las 5 vistas principales.
- **Funciones recientes**: columna «Impresiones» del listado de Pacientes (orden y total del
  mock), chip de impresiones en la ficha, pestañas y filtro de estado de Admin, búsqueda de
  usuarios con estado vacío, Bitácora con filtros + «Exportar CSV», y tarjeta «Documentos
  impresos» con conteos ordenados desc + «Ver bitácora».

```bash
bun run test:e2e                     # ambos proyectos (18 pruebas)
bunx playwright test --project=mobile   # solo móvil
bunx playwright test --ui            # modo exploratorio
```

La primera vez hay que descargar el navegador: `bunx playwright install chromium` (en CI se
hace solo con `--with-deps`). El job de **Frontend** de CI los ejecuta tras el build.

### CI (GitHub Actions)

`.github/workflows/ci.yml` corre en cada push a `master`/`main` y en cada PR, con trabajos en
paralelo:

| Trabajo | Runner | Pasos |
|---|---|---|
| **Frontend** | ubuntu | `bun install --frozen-lockfile` → `tsc --noEmit` → `bun run build` → **smoke tests Playwright** (Chromium, desktop + móvil) |
| **Rust · Linux** | ubuntu | prereqs GTK/webkit de Tauri → `cargo check --locked` → `clippy -D warnings` → `cargo test --locked` |
| **Rust · Windows** | windows | ídem **+ smoke test E2E contra Firebird Embedded real** (la pila completa está versionada en el repo) |

Los trabajos de Rust no dependen del frontend: `tauri-build` no necesita `dist/` para compilar
check/tests (verificado). Las cachés de compilación van con `Swatinem/rust-cache` y el lockfile
se respeta con `--locked` en todo el job de Rust.

#### Protección de la rama (recomendado)

> **✅ Configurada.** `master` ya está protegida vía API con los tres checks requeridos
> (`Frontend · typecheck + build`, `Rust · check + tests`, `Rust · tests + Firebird smoke`),
> «branches up to date» (strict), **enforce_admins** activo y sin force-push ni borrado.
> Approvals requeridos: 0 (unipersonal) — súbelo a 1 en Settings si se suma gente. Si algún día
> renombras un job del workflow, actualiza los contexts en *Settings → Branches → master*.

Para que el badge signifique algo, configura `master` para **no aceptar nada que no haya pasado
CI** — GitHub → *Settings → Branches → Add branch protection rule* sobre `master`:

- ✅ **Require a pull request before merging** — evita pushes directos al trunk.
- ✅ **Require status checks to pass before merging** → selecciona los tres checks del workflow:
  `Frontend · typecheck + build`, `Rust · check + tests` (ubuntu) y `Rust · tests + Firebird
  smoke` (windows).
- ✅ **Require branches to be up to date before merging** — el PR se vuelve a correr si `master`
  avanzó mientras tanto (evita sorpresas de «pasaba en mi branch pero no combinado»).
- Opcional en equipos pequeños: ✅ **Require approvals: 1** y deja **Do not allow bypassing the
  above settings** activado también para administradores.

Con esto, lo que está en `master` (y por tanto el estado del badge) siempre compila y pasa las
23 pruebas unitarias + el smoke test E2E contra Firebird real.

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

El backend está verificado contra **Firebird 5 Embedded real** (23 pruebas unitarias + smoke
test E2E end-to-end, ver «Pruebas y CI»). El frontend se verifica con `tsc --noEmit` y build de
producción en cada push mediante el workflow de GitHub Actions. Si al compilar en tu máquina
`cargo` reporta algún ajuste menor (p. ej. versión de crates), revísalo siguiendo los mensajes
del compilador — la lógica de dominio está replicada del backend web ya verificado.
