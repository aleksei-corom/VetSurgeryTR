use std::path::PathBuf;
use std::sync::RwLock;

use tauri::{AppHandle, Manager};

use crate::db::{bootstrap, DbPool};
use crate::models::user::Session;

/// Estado global gestionado por Tauri (accesible en cada comando).
pub struct AppState {
    /// Directorio de datos de la app ($APPDATA): ahí vive el .fdb y ahí se
    /// guardan los respaldos/exportaciones.
    pub app_data_dir: PathBuf,
    /// Pool de conexiones Firebird Embedded.
    pub pool: DbPool,
    pub db_path: PathBuf,
    pub fbclient_path: PathBuf,
    pub schema_version: i32,
    /// Fallo del arranque de Firebird (fbclient ausente, disco, etc.). La UI
    /// lo consulta con `db_status` y muestra el banner de configuración; los
    /// comandos devuelven el error `DB` correspondiente.
    pub init_error: Option<String>,
    /// Sesión local (usuario que hizo login). Solo vive en memoria: al cerrar
    /// la app se pierde y hay que volver a entrar. Ninguna sesión = pantalla
    /// de login.
    pub session: RwLock<Option<Session>>,
}

impl AppState {
    /// Nombre visible del usuario autenticado para atribuir acciones en la
    /// bitácora. Panic-safe: si no hay sesión se usa el actor de sistema (los
    /// flujos que atribuyen acciones exigen sesión antes de llegar aquí).
    pub fn actor(&self) -> String {
        self.session
            .read()
            .ok()
            .and_then(|s| s.as_ref().map(|sess| sess.user.display_name.clone()))
            .unwrap_or_else(|| crate::models::audit::SYSTEM_ACTOR.to_string())
    }

    /// Exige sesión activa (comandos de autenticación).
    pub fn require_session(&self) -> Result<Session, crate::error::AppError> {
        self.session
            .read()
            .ok()
            .and_then(|s| s.clone())
            .ok_or_else(|| {
                crate::error::AppError::validation("No hay una sesión activa: inicia sesión")
            })
    }
}

impl AppState {
    /// Inicializa Firebird Embedded (crea la BD si falta, migra y monta el
    /// pool). Nunca aborta: si algo falla queda registrado en `init_error`
    /// y el frontend muestra el banner de setup con la causa exacta.
    pub fn init(app: &AppHandle) -> Self {
        let app_data = app
            .path()
            .app_data_dir()
            .unwrap_or_else(|_| PathBuf::from("."));
        let _ = std::fs::create_dir_all(&app_data);

        let db_path = app_data.join("vetsurgerytr.fdb");
        let fbclient_path = crate::db::resolve_fbclient(app);

        match bootstrap(&db_path, &fbclient_path) {
            Ok((pool, schema_version)) => Self {
                app_data_dir: app_data,
                pool,
                db_path,
                fbclient_path,
                schema_version,
                init_error: None,
                session: RwLock::new(None),
            },
            Err(e) => Self {
                app_data_dir: app_data,
                pool: DbPool::empty(),
                db_path,
                fbclient_path,
                schema_version: 0,
                init_error: Some(e.to_string()),
                session: RwLock::new(None),
            },
        }
    }
}
