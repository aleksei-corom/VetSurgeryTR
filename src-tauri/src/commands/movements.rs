use tauri::State;

use crate::commands::{require_in, MOVEMENT_TYPES};
use crate::error::AppError;
use crate::models::inventory::{CreateMovementInput, InventoryMovement, MovementResult};
use crate::repositories::movement as movement_repo;
use crate::state::AppState;

/// Registra un movimiento de inventario y actualiza el stock en una
/// transacción: ENTRADA suma · SALIDA resta (valida "Stock insuficiente:
/// disponible X") · AJUSTE fija el valor absoluto contado (0 válido:
/// «existencia agotada»).
#[tauri::command]
pub async fn create_movement(
    state: State<'_, AppState>,
    item_id: i32,
    input: CreateMovementInput,
) -> Result<MovementResult, AppError> {
    require_in(
        &input.movement_type,
        MOVEMENT_TYPES,
        "el tipo de movimiento es inválido (ENTRADA, SALIDA o AJUSTE)",
    )?;
    if !input.qty.is_finite() {
        return Err(AppError::Validation(
            "la cantidad debe ser un número válido".into(),
        ));
    }
    // ENTRADA/SALIDA: delta > 0 · AJUSTE: valor absoluto >= 0 (conteo vacío).
    match input.movement_type.as_str() {
        "AJUSTE" if input.qty < 0.0 => {
            return Err(AppError::Validation(
                "el stock contado no puede ser negativo".into(),
            ));
        }
        t if t != "AJUSTE" && input.qty <= 0.0 => {
            return Err(AppError::Validation(
                "la cantidad debe ser mayor a 0".into(),
            ));
        }
        _ => {}
    }
    if let Some(cost) = input.unit_cost {
        if !cost.is_finite() || cost < 0.0 {
            return Err(AppError::Validation(
                "el costo unitario no puede ser negativo".into(),
            ));
        }
    }

    state.require_session()?;
    let mut pooled = state.pool.acquire()?;
    movement_repo::create(pooled.conn(), item_id, &input, &state.actor())
}

/// Kardex global de movimientos (más recientes primero) con filtros
/// opcionales: ítem, tipo y búsqueda por nombre/código del ítem.
#[tauri::command]
pub async fn list_movements(
    state: State<'_, AppState>,
    item_id: Option<i32>,
    movement_type: Option<String>,
    search: Option<String>,
    limit: Option<i32>,
) -> Result<Vec<InventoryMovement>, AppError> {
    if let Some(t) = movement_type.as_deref() {
        require_in(t, MOVEMENT_TYPES, "el tipo de movimiento es inválido")?;
    }
    let limit = limit.unwrap_or(100).clamp(1, 500);

    state.require_session()?;
    let mut pooled = state.pool.acquire()?;
    movement_repo::list_all(
        pooled.conn(),
        item_id,
        movement_type.as_deref(),
        search.as_deref(),
        limit,
    )
}
