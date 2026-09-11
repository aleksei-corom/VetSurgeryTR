use tauri::State;

use crate::models::dashboard::DbStatus;
use crate::state::AppState;

/// Estado del arranque de Firebird: la UI lo consulta al abrir para mostrar
/// el banner de configuración si falta fbclient o falló la migración.
#[tauri::command]
pub fn db_status(state: State<'_, AppState>) -> DbStatus {
    DbStatus {
        ok: state.init_error.is_none(),
        init_error: state.init_error.clone(),
        db_path: state.db_path.display().to_string(),
        fbclient_path: state.fbclient_path.display().to_string(),
        schema_version: state.schema_version,
    }
}
