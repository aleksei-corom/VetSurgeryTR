use tauri::State;

use crate::error::AppError;
use crate::models::clinic::{ClinicSettings, UpdateClinicSettingsInput};
use crate::repositories::clinic as clinic_repo;
use crate::state::AppState;

/// Configuración de la clínica (identidad de los documentos). Requiere sesión:
/// cualquier usuario autenticado la necesita para imprimir. Los datos son
/// los mismos para todos; solo su edición está restringida a admins.
#[tauri::command]
pub async fn get_clinic_settings(state: State<'_, AppState>) -> Result<ClinicSettings, AppError> {
    state.require_session()?;
    let mut pooled = state.pool.acquire()?;
    clinic_repo::get(pooled.conn())
}

/// Guarda la configuración de la clínica. Solo administradores; auditado.
#[tauri::command]
pub async fn update_clinic_settings(
    state: State<'_, AppState>,
    input: UpdateClinicSettingsInput,
) -> Result<ClinicSettings, AppError> {
    let session = crate::commands::require_admin_pub(&state)?;
    let mut pooled = state.pool.acquire()?;
    clinic_repo::update(pooled.conn(), &input, &session.user.display_name)
}
