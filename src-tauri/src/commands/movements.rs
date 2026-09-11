use tauri::State;

use crate::commands::{require_in, MOVEMENT_TYPES};
use crate::error::AppError;
use crate::models::inventory::{CreateMovementInput, MovementResult};
use crate::repositories::movement as movement_repo;
use crate::state::AppState;

/// Registra un movimiento de inventario y actualiza el stock en una
/// transacción: ENTRADA suma · SALIDA resta (valida "Stock insuficiente:
/// disponible X") · AJUSTE fija el valor absoluto contado.
#[tauri::command]
pub fn create_movement(
    state: State<'_, AppState>,
    item_id: i32,
    input: CreateMovementInput,
) -> Result<MovementResult, AppError> {
    require_in(
        &input.movement_type,
        MOVEMENT_TYPES,
        "el tipo de movimiento es inválido (ENTRADA, SALIDA o AJUSTE)",
    )?;
    if input.qty <= 0.0 {
        return Err(AppError::Validation("la cantidad debe ser mayor a 0".into()));
    }
    if let Some(cost) = input.unit_cost {
        if cost < 0.0 {
            return Err(AppError::Validation("el costo unitario no puede ser negativo".into()));
        }
    }

    let mut pooled = state.pool.acquire()?;
    movement_repo::create(pooled.conn(), item_id, &input)
}
