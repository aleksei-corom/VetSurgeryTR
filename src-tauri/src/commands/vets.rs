use tauri::State;

use crate::commands::require_non_empty;
use crate::error::AppError;
use crate::models::vet::{CreateVetInput, UpdateVetInput, Vet};
use crate::repositories::vet as vet_repo;
use crate::state::AppState;

/// Solo los administradores gestionan el cuerpo de veterinarios: los roles
/// VET pueden listar (para agendar) pero no crear ni desactivar.
fn require_admin(state: &AppState) -> Result<(), AppError> {
    let session = state.require_session()?;
    if session.user.role != "ADMIN" {
        return Err(AppError::Validation(
            "Solo los administradores pueden gestionar veterinarios".into(),
        ));
    }
    Ok(())
}

/// Veterinarios activos (agendar cirugías). Requiere sesión.
#[tauri::command]
pub async fn list_vets(state: State<'_, AppState>) -> Result<Vec<Vet>, AppError> {
    state.require_session()?;
    let mut pooled = state.pool.acquire()?;
    vet_repo::list(pooled.conn())
}

/// Todos los veterinarios, incluidos inactivos (gestión). Solo admins.
#[tauri::command]
pub async fn list_all_vets(state: State<'_, AppState>) -> Result<Vec<Vet>, AppError> {
    require_admin(&state)?;
    let mut pooled = state.pool.acquire()?;
    vet_repo::list_all(pooled.conn())
}

/// Crea un veterinario (alta del cuerpo clínico). Solo admins. Auditado.
#[tauri::command]
pub async fn create_vet(
    state: State<'_, AppState>,
    input: CreateVetInput,
) -> Result<Vet, AppError> {
    let session = crate::commands::require_admin_pub(&state)?;
    require_non_empty(&input.full_name, "el nombre completo es requerido")?;

    let mut pooled = state.pool.acquire()?;
    vet_repo::create(pooled.conn(), &input, &session.user.display_name)
}

/// Edita los datos de un veterinario (nombre, T.P., especialidad, contacto).
/// Solo admins. Auditado con diff campo a campo.
#[tauri::command]
pub async fn update_vet(
    state: State<'_, AppState>,
    vet_id: i32,
    input: UpdateVetInput,
) -> Result<Vet, AppError> {
    let session = crate::commands::require_admin_pub(&state)?;
    if let Some(name) = input.full_name.as_deref() {
        require_non_empty(name, "el nombre completo es requerido")?;
    }

    let mut pooled = state.pool.acquire()?;
    vet_repo::update(pooled.conn(), vet_id, &input, &session.user.display_name)
}

/// Activa/desactiva un veterinario (soft-delete: conserva su historial
/// quirúrgico). Solo admins. Auditado.
#[tauri::command]
pub async fn set_vet_active(
    state: State<'_, AppState>,
    vet_id: i32,
    active: bool,
) -> Result<Vet, AppError> {
    let session = crate::commands::require_admin_pub(&state)?;
    let mut pooled = state.pool.acquire()?;
    vet_repo::set_active(pooled.conn(), vet_id, active, &session.user.display_name)
}
