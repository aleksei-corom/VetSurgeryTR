# Firebird 5 Embedded — librerías nativas

Este directorio se empaqueta completo como recurso de Tauri
(`bundle.resources` en `tauri.conf.json`) y se carga en tiempo de ejecución
por `rsfbclient` (feature `dynamic_loading`). Los binarios NO se incluyen en
el repositorio (`.gitignore`).

## Windows (producción, instalador NSIS)

1. Descarga **Firebird 5.0.x (64-bit) — variante EMBEDDED (ZIP)** desde
   https://firebirdsql.org/en/firebird-5-0/ y descomprímelo.
2. Copia aquí, desde la carpeta del ZIP:
   - `fbclient.dll`   ← obligatorio (el motor Embedded de Firebird 3+ ES esta DLL)
   - `firebird.msg`   ← recomendado (mensajes de error legibles)
   - `firebird.conf`  ← opcional
   - `icudt*.dll`, `icuin*.dll`, `icuuc*.dll` ← solo si tu fbclient los exige

> Con Embedded no se necesita `security5.fdb` ni servicio alguno: la app
> conecta como `SYSDBA` sin contraseña (modo embedded estándar de Firebird 3+).

## Linux (desarrollo)

Coloca `libfbclient.so` aquí (p. ej. del paquete `firebird` de tu distro o del
tarball oficial). También se admite `fbclient.dll` para pruebas cruzadas.

## macOS

Coloca `libfbclient.dylib` aquí (del DMG oficial de Firebird 5). `rsfbclient`
la localiza por nombre en `db/mod.rs::resolve_fbclient`.

## Resolución en tiempo de ejecución

`src/db/mod.rs::resolve_fbclient` busca la librería en este orden:

1. `binaries/firebird/<lib-del-sistema>` en el directorio de recursos de Tauri
   ($RESOURCE, junto al ejecutable en el bundle).
2. Rutas relativas al ejecutable (cubren `target/debug` y `target/release`
   en desarrollo: `src-tauri/binaries/firebird/...`).
3. Directorio de trabajo actual.

Si falta la librería, el arranque no aborta: `db_status` reporta
`fbclientFound = false` y los comandos devuelven un error `DB` con la ruta
esperada. La base de datos (`vetsurgerytr.fdb`) se crea automáticamente en
`app_data_dir` al primer arranque válido y las migraciones SQL (incluido el
seed de demostración) se aplican solas; para regenerar todo basta con borrar
el `.fdb`.
