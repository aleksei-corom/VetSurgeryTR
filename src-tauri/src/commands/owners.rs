use tauri::State;

use crate::commands::{require_in, require_non_empty, DOCUMENT_TYPES};
use crate::error::AppError;
use crate::models::owner::{CreateOwnerInput, Owner};
use crate::repositories::owner as owner_repo;
use crate::state::AppState;

/// Listado de propietarios con búsqueda por nombre, documento, teléfono o ciudad.
#[tauri::command]
pub fn list_owners(state: State<'_, AppState>, search: Option<String>) -> Result<Vec<Owner>, AppError> {
    let mut pooled = state.pool.acquire()?;
    owner_repo::list(pooled.conn(), search.as_deref())
}

/// Crea un propietario. Documento único (tipo+número) con el mismo mensaje
/// de la web si ya existe.
#[tauri::command]
pub fn create_owner(state: State<'_, AppState>, input: CreateOwnerInput) -> Result<Owner, AppError> {
    require_in(
        &input.document_type,
        DOCUMENT_TYPES,
        "el tipo de documento es inválido (CC, TI, CE, NIT o PA)",
    )?;
    require_non_empty(&input.document_number, "el número de documento es requerido")?;
    require_non_empty(&input.full_name, "el nombre completo es requerido")?;

    let mut pooled = state.pool.acquire()?;
    owner_repo::create(pooled.conn(), &input)
}
