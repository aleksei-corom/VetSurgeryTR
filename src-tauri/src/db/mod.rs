pub mod migrations;

use std::collections::VecDeque;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use rsfbclient::SimpleConnection;
use tauri::{AppHandle, Manager};

use crate::error::AppError;

/// Conexiones de uso general para los comandos.
const POOL_SIZE: usize = 4;

/// Pool simple de conexiones Firebird Embedded (patrón ISALAB-TR).
///
/// Firebird Embedded admite varias conexiones por proceso; el pool las
/// reutiliza. `SimpleConnection` es `Send`, por lo que puede moverse entre
/// hilos (comandos de Tauri). Cada `PooledConn` se toma de una en una, así
/// que las transacciones explícitas (`with_tx`) nunca cruzan conexiones.
#[derive(Clone)]
pub struct DbPool(Arc<Mutex<VecDeque<SimpleConnection>>>);

impl DbPool {
    pub fn empty() -> Self {
        Self(Arc::new(Mutex::new(VecDeque::new())))
    }

    pub fn acquire(&self) -> Result<PooledConn, AppError> {
        let mut q = self
            .0
            .lock()
            .map_err(|_| AppError::db("Pool de conexiones bloqueado"))?;
        let conn = q.pop_front().ok_or_else(|| {
            AppError::db("Sin conexiones Firebird disponibles (motor no inicializado)")
        })?;
        Ok(PooledConn {
            pool: self.clone(),
            conn: Some(conn),
        })
    }

    fn release(&self, conn: SimpleConnection) {
        if let Ok(mut q) = self.0.lock() {
            if q.len() < POOL_SIZE {
                q.push_back(conn);
            }
        }
    }
}

/// Guard que devuelve la conexión al pool al soltarse.
pub struct PooledConn {
    pool: DbPool,
    conn: Option<SimpleConnection>,
}

impl PooledConn {
    pub fn conn(&mut self) -> &mut SimpleConnection {
        self.conn.as_mut().expect("conexión ya liberada")
    }
}

impl Drop for PooledConn {
    fn drop(&mut self) {
        if let Some(conn) = self.conn.take() {
            self.pool.release(conn);
        }
    }
}

/// Firebird en Windows acepta barras normales en rutas.
fn normalize_db_path(p: &Path) -> String {
    p.to_string_lossy().replace('\\', "/")
}

/// Nombre de la librería cliente según el sistema operativo.
fn fbclient_filename() -> &'static str {
    if cfg!(target_os = "windows") {
        "fbclient.dll"
    } else if cfg!(target_os = "macos") {
        "libfbclient.dylib"
    } else {
        "libfbclient.so"
    }
}

/// Localiza la librería cliente de Firebird 5 Embedded empaquetada como
/// recurso (`binaries/firebird/`). Orden de búsqueda:
///
/// 1. `$RESOURCE/binaries/firebird/<lib-del-sistema>` (bundle/instalador).
/// 2. `$RESOURCE/binaries/firebird/fbclient.dll` (compatibilidad).
/// 3. Rutas relativas al ejecutable: cubren `target/debug` y
///    `target/release` en desarrollo (`src-tauri/binaries/firebird/...`).
/// 4. Directorio de trabajo actual.
///
/// Si no aparece en ningún sitio se devuelve la ruta canónica del recurso
/// para que el mensaje de error apunte al sitio esperado (ver README.md de
/// binaries/firebird).
pub fn resolve_fbclient(app: &AppHandle) -> PathBuf {
    let mut candidates: Vec<PathBuf> = Vec::new();

    for name in [fbclient_filename(), "fbclient.dll", "libfbclient.so"] {
        if let Ok(p) = app
            .path()
            .resolve(format!("binaries/firebird/{name}"), tauri::path::BaseDirectory::Resource)
        {
            candidates.push(p);
        }
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            for name in [fbclient_filename(), "fbclient.dll", "libfbclient.so"] {
                // target/debug y target/release → src-tauri/binaries/firebird.
                let src_tauri = dir
                    .parent()
                    .and_then(|p| p.parent())
                    .map(|p| p.join("binaries/firebird").join(name));
                if let Some(p) = src_tauri {
                    candidates.push(p);
                }
                // Junto al ejecutable (recurso copiado al bundle).
                candidates.push(dir.join("binaries/firebird").join(name));
            }
        }
    }

    candidates.push(PathBuf::from("binaries/firebird").join(fbclient_filename()));

    for p in &candidates {
        if p.exists() {
            return p.clone();
        }
    }
    // Ruta canónica para el mensaje de error.
    candidates
        .first()
        .cloned()
        .unwrap_or_else(|| PathBuf::from("binaries/firebird/fbclient.dll"))
}

/// Abre una conexión Embedded a una base existente.
pub fn new_connection(db_path: &Path, fbclient: &Path) -> Result<SimpleConnection, AppError> {
    let mut b = rsfbclient::builder_native()
        .with_dyn_load(fbclient.to_string_lossy().to_string())
        .with_embedded();
    b.user("SYSDBA");
    b.db_name(normalize_db_path(db_path));
    let conn = b.connect().map_err(|e| {
        AppError::db(format!(
            "No se pudo conectar a Firebird Embedded ({}): {e}",
            db_path.display()
        ))
    })?;
    Ok(conn.into())
}

/// Crea la base de datos (.fdb) si no existe y devuelve una conexión.
pub fn create_database(db_path: &Path, fbclient: &Path) -> Result<SimpleConnection, AppError> {
    let mut b = rsfbclient::builder_native()
        .with_dyn_load(fbclient.to_string_lossy().to_string())
        .with_embedded();
    b.user("SYSDBA");
    b.db_name(normalize_db_path(db_path));
    b.page_size(16384);
    let conn = b.create_database().map_err(|e| {
        AppError::db(format!(
            "No se pudo crear la base de datos ({}): {e}",
            db_path.display()
        ))
    })?;
    Ok(conn.into())
}

/// Arranque: crea la BD si falta, ejecuta migraciones pendientes (incluido el
/// dataset de demostración en el primer arranque) y monta el pool.
pub fn bootstrap(db_path: &Path, fbclient: &Path) -> Result<(DbPool, i32), AppError> {
    if !fbclient.exists() {
        return Err(AppError::db(format!(
            "fbclient no encontrado en {}. Descarga Firebird 5 Embedded y coloca la librería ahí (ver binaries/firebird/README.md).",
            fbclient.display()
        )));
    }

    let exists = db_path.exists();
    let mut first = if exists {
        new_connection(db_path, fbclient)?
    } else {
        create_database(db_path, fbclient)?
    };

    let schema_version = migrations::run_migrations(&mut first)?;

    let pool = DbPool(Arc::new(Mutex::new(VecDeque::new())));
    pool.release(first);
    for _ in 1..POOL_SIZE {
        match new_connection(db_path, fbclient) {
            Ok(c) => pool.release(c),
            Err(_) => break,
        }
    }

    Ok((pool, schema_version))
}

/// Inicia una transacción explícita sobre la conexión y ejecuta la lógica.
/// Si la lógica falla se hace ROLLBACK (nada queda a medias); si tiene éxito,
/// COMMIT.
///
/// `SimpleConnection` confirma automáticamente cada sentencia salvo que se
/// abra una transacción con `begin_transaction`; así los flujos
/// multi-sentencia (crear paciente con propietario, movimiento con
/// actualización de stock, consumo de inventario al completar cirugía...)
/// son atómicos.
///
/// REGLA: nunca anidar — `with_tx` se usa una sola vez por operación de
/// comando y las funciones auxiliares reciben la conexión ya en transacción.
pub fn with_tx<T>(
    conn: &mut SimpleConnection,
    logic: impl FnOnce(&mut SimpleConnection) -> Result<T, AppError>,
) -> Result<T, AppError> {
    conn.begin_transaction().map_err(AppError::from)?;
    match logic(conn) {
        Ok(v) => {
            if conn.commit().is_err() {
                // Commit fallido: la conexión queda comprometida; se intenta
                // rollback para no devolverla al pool con transacción abierta.
                conn.rollback().ok();
                return Err(AppError::db("No se pudo confirmar la transacción"));
            }
            Ok(v)
        }
        Err(e) => {
            // El rollback es best-effort: el error original manda.
            conn.rollback().ok();
            Err(e)
        }
    }
}
