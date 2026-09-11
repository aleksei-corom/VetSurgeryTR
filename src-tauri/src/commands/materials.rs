use tauri::State;

use crate::error::AppError;
use crate::models::surgery::{SurgeryMaterial, UpsertMaterialInput};
use crate::repositories::surgery as surgery_repo;
use crate::state::AppState;

/// Añade o actualiza un material de la cirugía (upsert sobre cirugía+ítem,
/// con el costo unitario vigente). Bloqueado si la cirugía está COMPLETADA.
#[tauri::command]
pub fn upsert_surgery_material(
    state: State<'_, AppState>,
    surgery_id: i32,
    input: UpsertMaterialInput,
) -> Result<SurgeryMaterial, AppError> {
    if input.qty_planned <= 0.0 {
        return Err(AppError::Validation("qtyPlanned debe ser mayor a 0".into()));
    }
    if let Some(used) = input.qty_used {
        if used < 0.0 {
            return Err(AppError::Validation("qtyUsed no puede ser negativo".into()));
        }
    }

    let mut pooled = state.pool.acquire()?;
    surgery_repo::upsert_material(pooled.conn(), surgery_id, &input)
}

/// Elimina un material de la cirugía. Bloqueado si está COMPLETADA.
#[tauri::command]
pub fn remove_surgery_material(
    state: State<'_, AppState>,
    surgery_id: i32,
    material_id: i32,
) -> Result<(), AppError> {
    let mut pooled = state.pool.acquire()?;
    surgery_repo::remove_material(pooled.conn(), surgery_id, material_id)
}
