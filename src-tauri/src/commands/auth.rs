use tauri::State;

use crate::error::AppError;
use crate::models::user::{ChangePasswordInput, CreateUserInput, LoginInput, Session, User};
use crate::repositories::user as user_repo;
use crate::state::AppState;

/// Exige una sesión activa con rol ADMIN. Toda la gestión de usuarios y
/// veterinarios pasa por aquí: los roles VET quedan fuera, incluso si
/// invocan el comando directamente por IPC.
fn require_admin(state: &AppState) -> Result<Session, AppError> {
    let session = state.require_session()?;
    if session.user.role != "ADMIN" {
        return Err(AppError::Validation(
            "Solo los administradores pueden gestionar usuarios y veterinarios".into(),
        ));
    }
    Ok(session)
}

/// Inicia sesión local (usuario + contraseña con hash Argon2id). La sesión
/// vive en memoria mientras la app esté abierta: todas las acciones quedan
/// atribuidas en la bitácora a este usuario.
#[tauri::command]
pub async fn login(
    state: State<'_, AppState>,
    input: LoginInput,
) -> Result<Session, AppError> {
    if state.init_error.is_some() {
        return Err(AppError::db(
            "La base de datos no está disponible: no se puede iniciar sesión",
        ));
    }
    let mut pooled = state.pool.acquire()?;
    let session = user_repo::login(pooled.conn(), &input)?;
    if let Ok(mut guard) = state.session.write() {
        *guard = Some(session.clone());
    }
    Ok(session)
}

/// Usuario de la sesión actual (o null si nadie ha entrado). El frontend lo
/// consulta al arrancar (no sobrevive a un reinicio de la app, a propósito).
#[tauri::command]
pub async fn get_session(state: State<'_, AppState>) -> Result<Option<Session>, AppError> {
    Ok(state.session.read().ok().and_then(|s| s.clone()))
}

/// Cierra la sesión (vuelve a la pantalla de login). Inofensivo si no había.
#[tauri::command]
pub async fn logout(state: State<'_, AppState>) -> Result<(), AppError> {
    if let Ok(mut guard) = state.session.write() {
        *guard = None;
    }
    Ok(())
}

/// Cambia la contraseña del usuario autenticado (verifica la actual).
#[tauri::command]
pub async fn change_password(
    state: State<'_, AppState>,
    input: ChangePasswordInput,
) -> Result<(), AppError> {
    let session = state.require_session()?;
    let mut pooled = state.pool.acquire()?;
    user_repo::change_password(pooled.conn(), session.user.id, &input)
}

// ==================== GESTIÓN DE USUARIOS (SOLO ADMIN) =======================

/// Lista todos los usuarios (incluidos inactivos). Solo admins.
#[tauri::command]
pub async fn list_users(state: State<'_, AppState>) -> Result<Vec<User>, AppError> {
    require_admin(&state)?;
    let mut pooled = state.pool.acquire()?;
    user_repo::list(pooled.conn())
}

/// Crea un usuario (alta de acceso a la app). Solo admins. Auditado.
#[tauri::command]
pub async fn create_user(
    state: State<'_, AppState>,
    input: CreateUserInput,
) -> Result<User, AppError> {
    let session = require_admin(&state)?;
    let mut pooled = state.pool.acquire()?;
    user_repo::create_user(pooled.conn(), &input, &session.user.display_name)
}

/// Activa/desactiva un usuario. Solo admins. Protege el último ADMIN activo
/// y evita auto-desactivarse. Auditado.
#[tauri::command]
pub async fn set_user_active(
    state: State<'_, AppState>,
    user_id: i32,
    active: bool,
) -> Result<User, AppError> {
    let session = require_admin(&state)?;
    let mut pooled = state.pool.acquire()?;
    user_repo::set_user_active(
        pooled.conn(),
        user_id,
        active,
        session.user.id,
        &session.user.display_name,
    )
}

/// Edita el nombre visible y/o el rol de un usuario. Solo admins. Auditado
/// con diff. El username no se editable (es la identidad en la bitácora).
#[tauri::command]
pub async fn update_user(
    state: State<'_, AppState>,
    user_id: i32,
    input: crate::models::user::UpdateUserInput,
) -> Result<User, AppError> {
    let session = require_admin(&state)?;
    let mut pooled = state.pool.acquire()?;
    user_repo::update_user(
        pooled.conn(),
        user_id,
        &input,
        session.user.id,
        &session.user.display_name,
    )
}

/// Restablece la contraseña de cualquier usuario (para olvidos): el admin no
/// necesita la contraseña actual. Solo admins. Auditado.
#[tauri::command]
pub async fn reset_user_password(
    state: State<'_, AppState>,
    user_id: i32,
    new_password: String,
) -> Result<(), AppError> {
    let session = require_admin(&state)?;
    let mut pooled = state.pool.acquire()?;
    user_repo::reset_password(pooled.conn(), user_id, &new_password, &session.user.display_name)
}
