use tauri::State;

use crate::error::AppError;
use crate::models::dashboard::DbStatus;
use crate::state::AppState;

/// Estado del arranque de Firebird: la UI lo consulta al abrir para mostrar
/// el banner de configuración si falta fbclient o falló la migración.
/// (Los comandos async con referencias deben devolver Result, regla de Tauri v2.)
#[tauri::command]
pub async fn db_status(state: State<'_, AppState>) -> Result<DbStatus, AppError> {
    Ok(DbStatus {
        ok: state.init_error.is_none(),
        init_error: state.init_error.clone(),
        db_path: state.db_path.display().to_string(),
        fbclient_path: state.fbclient_path.display().to_string(),
        schema_version: state.schema_version,
    })
}
