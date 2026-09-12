use tauri::State;

use crate::commands::{require_in, require_non_empty, validate_date, INVENTORY_CATEGORIES};
use crate::error::AppError;
use crate::models::inventory::{
    CreateInventoryItemInput, InventoryItem, InventoryItemDetail, UpdateInventoryItemInput,
};
use crate::repositories::inventory as inventory_repo;
use crate::state::AppState;

/// Inventario ortopédico con búsqueda (nombre/código/subtipo/talla/proveedor),
/// filtro por categoría y de stock bajo (STOCK_QTY <= MIN_STOCK).
#[tauri::command]
pub async fn list_inventory_items(
    state: State<'_, AppState>,
    search: Option<String>,
    category: Option<String>,
    low_stock: Option<bool>,
) -> Result<Vec<InventoryItem>, AppError> {
    state.require_session()?;
    let mut pooled = state.pool.acquire()?;
    inventory_repo::list(
        pooled.conn(),
        search.as_deref(),
        category.as_deref(),
        low_stock.unwrap_or(false),
    )
}

/// Detalle de un ítem con su historial de movimientos (máx. 50).
#[tauri::command]
pub async fn get_inventory_item(
    state: State<'_, AppState>,
    id: i32,
) -> Result<Option<InventoryItemDetail>, AppError> {
    state.require_session()?;
    let mut pooled = state.pool.acquire()?;
    inventory_repo::get_detail(pooled.conn(), id)
}

/// Crea un ítem (código INV-NNNN). Si stockQty > 0 registra la ENTRADA
/// inicial para que existencias y movimientos cuadren.
#[tauri::command]
pub async fn create_inventory_item(
    state: State<'_, AppState>,
    input: CreateInventoryItemInput,
) -> Result<InventoryItem, AppError> {
    require_non_empty(&input.name, "el nombre es requerido")?;
    require_in(
        &input.category,
        INVENTORY_CATEGORIES,
        "la categoría es inválida (PLACAS, TORNILLOS, PINES, ALAMBRES, FIJADORES, INJERTOS, INSTRUMENTAL, SUTURAS, MEDICAMENTOS o INSUMOS)",
    )?;
    require_non_empty(&input.unit, "la unidad es requerida")?;
    if let Some(stock) = input.stock_qty {
        if stock < 0.0 {
            return Err(AppError::Validation("el stock inicial no puede ser negativo".into()));
        }
    }
    if let Some(min) = input.min_stock {
        if min < 0.0 {
            return Err(AppError::Validation("el stock mínimo no puede ser negativo".into()));
        }
    }
    if let Some(cost) = input.unit_cost {
        if cost < 0.0 {
            return Err(AppError::Validation("el costo unitario no puede ser negativo".into()));
        }
    }
    if let Some(expires) = input.expires_at.as_deref() {
        validate_date(expires)?;
    }

    state.require_session()?;
    let mut pooled = state.pool.acquire()?;
    inventory_repo::create(pooled.conn(), &input)
}

/// Actualización parcial del ítem (el stock solo cambia por movimientos).
#[tauri::command]
pub async fn update_inventory_item(
    state: State<'_, AppState>,
    id: i32,
    input: UpdateInventoryItemInput,
) -> Result<InventoryItem, AppError> {
    if let Some(name) = input.name.as_deref() {
        require_non_empty(name, "el nombre es requerido")?;
    }
    if let Some(category) = input.category.as_deref() {
        require_in(category, INVENTORY_CATEGORIES, "la categoría es inválida")?;
    }
    if let Some(min) = input.min_stock {
        if min < 0.0 {
            return Err(AppError::Validation("el stock mínimo no puede ser negativo".into()));
        }
    }
    if let Some(cost) = input.unit_cost {
        if cost < 0.0 {
            return Err(AppError::Validation("el costo unitario no puede ser negativo".into()));
        }
    }
    if let Some(expires) = input.expires_at.as_deref() {
        validate_date(expires)?;
    }

    state.require_session()?;
    let mut pooled = state.pool.acquire()?;
    inventory_repo::update(pooled.conn(), id, &input)
}
