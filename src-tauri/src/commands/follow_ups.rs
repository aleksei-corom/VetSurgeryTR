use tauri::State;

use crate::commands::{require_in, validate_date, FOLLOW_UP_STATUSES, FOLLOW_UP_TYPES};
use crate::error::AppError;
use crate::models::follow_up::{CreateFollowUpInput, FollowUp, UpdateFollowUpInput};
use crate::repositories::follow_up as follow_up_repo;
use crate::state::AppState;

/// Agenda un control postoperatorio (estado inicial PENDIENTE).
#[tauri::command]
pub async fn create_follow_up(
    state: State<'_, AppState>,
    surgery_id: i32,
    input: CreateFollowUpInput,
) -> Result<FollowUp, AppError> {
    validate_date(&input.scheduled_date)?;
    require_in(
        &input.followup_type,
        FOLLOW_UP_TYPES,
        "el tipo de control es inválido",
    )?;

    state.require_session()?;
    let mut pooled = state.pool.acquire()?;
    follow_up_repo::create(pooled.conn(), surgery_id, &input)
}

/// Cambia el estado de un control (PENDIENTE | CUMPLIDO | PERDIDO). Al pasar
/// a CUMPLIDO se fija DONE_AT.
#[tauri::command]
pub async fn update_follow_up(
    state: State<'_, AppState>,
    surgery_id: i32,
    follow_up_id: i32,
    input: UpdateFollowUpInput,
) -> Result<FollowUp, AppError> {
    require_in(
        &input.status,
        FOLLOW_UP_STATUSES,
        "el estado del control es inválido (PENDIENTE, CUMPLIDO o PERDIDO)",
    )?;

    state.require_session()?;
    let mut pooled = state.pool.acquire()?;
    follow_up_repo::update(pooled.conn(), surgery_id, follow_up_id, &input)
}
