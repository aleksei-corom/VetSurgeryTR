use tauri::State;

use crate::commands::require_non_empty;
use crate::error::AppError;
use crate::models::vet::{CreateVetInput, Vet};
use crate::repositories::vet as vet_repo;
use crate::state::AppState;

/// Veterinarios activos.
#[tauri::command]
pub fn list_vets(state: State<'_, AppState>) -> Result<Vec<Vet>, AppError> {
    let mut pooled = state.pool.acquire()?;
    vet_repo::list(pooled.conn())
}

/// Crea un veterinario.
#[tauri::command]
pub fn create_vet(state: State<'_, AppState>, input: CreateVetInput) -> Result<Vet, AppError> {
    require_non_empty(&input.full_name, "el nombre completo es requerido")?;

    let mut pooled = state.pool.acquire()?;
    vet_repo::create(pooled.conn(), &input)
}
