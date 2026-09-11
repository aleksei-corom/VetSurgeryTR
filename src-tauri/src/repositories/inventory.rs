use rsfbclient::prelude::*;
use rsfbclient::SimpleConnection;

use crate::error::AppError;
use crate::models::inventory::{
    CreateInventoryItemInput, InventoryItem, InventoryItemDetail, UpdateInventoryItemInput,
};
use crate::repositories::{movement as movement_repo, next_id, with_tx};

/// Columnas de un ítem del inventario ortopédico.
const ITEM_SELECT: &str = "
    SELECT i.ID, i.CODE, i.NAME, i.CATEGORY, i.SUB_TYPE, i.MATERIAL, i.ITEM_SIZE,
           i.UNIT, i.STOCK_QTY, i.MIN_STOCK, i.UNIT_COST, i.SUPPLIER, i.LOT_NUMBER,
           CAST(i.EXPIRES_AT AS VARCHAR(10)), i.LOCATION, i.ACTIVE, i.NOTES,
           LEFT(CAST(i.CREATED_AT AS VARCHAR(60)), 19),
           LEFT(CAST(i.UPDATED_AT AS VARCHAR(60)), 19)
    FROM INVENTORY_ITEMS i";

pub(crate) type ItemRow = (
    i32,            // id
    String,         // code
    String,         // name
    String,         // category
    Option<String>, // sub_type
    Option<String>, // material
    Option<String>, // size
    String,         // unit
    f64,            // stock_qty
    f64,            // min_stock
    Option<f64>,    // unit_cost
    Option<String>, // supplier
    Option<String>, // lot_number
    Option<String>, // expires_at
    Option<String>, // location
    bool,           // active
    Option<String>, // notes
    String,         // created_at
    String,         // updated_at
);

pub(crate) fn map_item(r: ItemRow) -> InventoryItem {
    InventoryItem {
        id: r.0,
        code: r.1,
        name: r.2,
        category: r.3,
        sub_type: r.4,
        material: r.5,
        size: r.6,
        unit: r.7,
        stock_qty: r.8,
        min_stock: r.9,
        unit_cost: r.10,
        supplier: r.11,
        lot_number: r.12,
        expires_at: r.13,
        location: r.14,
        active: r.15,
        notes: r.16,
        created_at: r.17,
        updated_at: r.18,
    }
}

/// Listado con búsqueda (nombre/código/subtipo/talla/proveedor), categoría y
/// filtro de stock bajo (STOCK_QTY <= MIN_STOCK se compara columna a columna,
/// algo que Prisma no podía y aquí sí es SQL puro).
pub fn list(
    conn: &mut SimpleConnection,
    search: Option<&str>,
    category: Option<&str>,
    low_stock: bool,
) -> Result<Vec<InventoryItem>, AppError> {
    let like = search
        .map(|s| format!("%{}%", s.trim()))
        .filter(|s| !s.trim_matches('%').is_empty());
    let low = if low_stock { Some(true) } else { None };

    let rows: Vec<ItemRow> = conn
        .query(
            &format!(
                "{ITEM_SELECT}
                 WHERE (? IS NULL
                        OR UPPER(i.NAME) LIKE UPPER(?)
                        OR UPPER(i.CODE) LIKE UPPER(?)
                        OR UPPER(COALESCE(i.SUB_TYPE, '')) LIKE UPPER(?)
                        OR UPPER(COALESCE(i.ITEM_SIZE, '')) LIKE UPPER(?)
                        OR UPPER(COALESCE(i.SUPPLIER, '')) LIKE UPPER(?))
                   AND (? IS NULL OR i.CATEGORY = ?)
                   AND (? IS NULL OR (i.ACTIVE = TRUE AND i.STOCK_QTY <= i.MIN_STOCK))
                 ORDER BY i.CATEGORY, i.NAME"
            ),
            (
                &like, &like, &like, &like, &like, &like,
                &category, &category, &low,
            ),
        )
        .map_err(AppError::from)?;

    Ok(rows.into_iter().map(map_item).collect())
}

pub fn get(conn: &mut SimpleConnection, id: i32) -> Result<Option<InventoryItem>, AppError> {
    let row: Option<ItemRow> = conn
        .query_first(&format!("{ITEM_SELECT} WHERE i.ID = ?"), (&id,))
        .map_err(AppError::from)?;
    Ok(row.map(map_item))
}

/// Existencia de un ítem (validación al registrar materiales/movimientos).
pub fn exists(conn: &mut SimpleConnection, id: i32) -> Result<bool, AppError> {
    let row: Option<(i32,)> = conn
        .query_first("SELECT ID FROM INVENTORY_ITEMS WHERE ID = ?", (&id,))
        .map_err(AppError::from)?;
    Ok(row.is_some())
}

/// Detalle con historial de movimientos (máx. 50, igual que la web).
pub fn get_detail(
    conn: &mut SimpleConnection,
    id: i32,
) -> Result<Option<InventoryItemDetail>, AppError> {
    let Some(item) = get(conn, id)? else {
        return Ok(None);
    };
    let movements = movement_repo::list_by_item(conn, id)?;
    Ok(Some(InventoryItemDetail { item, movements }))
}

/// Crea un ítem. El código INV-NNNN lo genera el trigger BI_INVENTORY_ITEMS;
/// se recupera con INSERT ... RETURNING (execute_returnable). Si el stock
/// inicial es > 0 se registra la ENTRADA para que existencias y movimientos
/// cuadren, todo en una transacción.
pub fn create(
    conn: &mut SimpleConnection,
    input: &CreateInventoryItemInput,
) -> Result<InventoryItem, AppError> {
    with_tx(conn, |conn| {
        let stock_qty = input.stock_qty.unwrap_or(0.0);
        let min_stock = input.min_stock.unwrap_or(0.0);

        let (id, _code): (i32, String) = conn
            .execute_returnable(
                "INSERT INTO INVENTORY_ITEMS
                    (NAME, CATEGORY, SUB_TYPE, MATERIAL, ITEM_SIZE, UNIT,
                     STOCK_QTY, MIN_STOCK, UNIT_COST, SUPPLIER, LOT_NUMBER,
                     EXPIRES_AT, LOCATION, NOTES)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 RETURNING ID, CODE",
                (
                    &input.name,
                    &input.category,
                    &input.sub_type,
                    &input.material,
                    &input.size,
                    &input.unit,
                    &stock_qty,
                    &min_stock,
                    &input.unit_cost,
                    &input.supplier,
                    &input.lot_number,
                    &input.expires_at,
                    &input.location,
                    &input.notes,
                ),
            )
            .map_err(AppError::from)?;

        if stock_qty > 0.0 {
            movement_repo::insert_raw(
                conn,
                id,
                "ENTRADA",
                stock_qty,
                stock_qty,
                input.unit_cost,
                &Some("Inventario inicial".to_string()),
                &None,
            )?;
        }

        get(conn, id)?.ok_or_else(|| AppError::Internal("Ítem creado pero no recuperado".into()))
    })
}

/// Actualización parcial (None = dejar sin cambio). El stock NUNCA se edita
/// por aquí: siempre mediante movimientos ENTRADA/SALIDA/AJUSTE.
pub fn update(
    conn: &mut SimpleConnection,
    id: i32,
    input: &UpdateInventoryItemInput,
) -> Result<InventoryItem, AppError> {
    let current = get(conn, id)?
        .ok_or_else(|| AppError::NotFound(format!("Item de inventario {id} no encontrado")))?;

    let name = input.name.clone().unwrap_or(current.name);
    let category = input.category.clone().unwrap_or(current.category);
    let sub_type = input.sub_type.clone().or(current.sub_type);
    let material = input.material.clone().or(current.material);
    let size = input.size.clone().or(current.size);
    let unit = input.unit.clone().unwrap_or(current.unit);
    let min_stock = input.min_stock.unwrap_or(current.min_stock);
    let unit_cost = input.unit_cost.or(current.unit_cost);
    let supplier = input.supplier.clone().or(current.supplier);
    let lot_number = input.lot_number.clone().or(current.lot_number);
    let expires_at = input.expires_at.clone().or(current.expires_at);
    let location = input.location.clone().or(current.location);
    let active = input.active.unwrap_or(current.active);
    let notes = input.notes.clone().or(current.notes);

    conn.execute(
        "UPDATE INVENTORY_ITEMS
            SET NAME = ?, CATEGORY = ?, SUB_TYPE = ?, MATERIAL = ?, ITEM_SIZE = ?,
                UNIT = ?, MIN_STOCK = ?, UNIT_COST = ?, SUPPLIER = ?, LOT_NUMBER = ?,
                EXPIRES_AT = ?, LOCATION = ?, ACTIVE = ?, NOTES = ?,
                UPDATED_AT = CURRENT_TIMESTAMP
          WHERE ID = ?",
        (
            &name, &category, &sub_type, &material, &size, &unit, &min_stock,
            &unit_cost, &supplier, &lot_number, &expires_at, &location, &active,
            &notes, &id,
        ),
    )
    .map_err(AppError::from)?;

    get(conn, id)?.ok_or_else(|| AppError::Internal("Ítem actualizado pero no recuperado".into()))
}
