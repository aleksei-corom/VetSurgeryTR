use rsfbclient::prelude::*;
use rsfbclient::SimpleConnection;

use crate::error::AppError;
use crate::models::inventory::{
    CreateMovementInput, InventoryMovement, MovementItemRef, MovementResult,
};
use crate::repositories::{fmt_qty, next_id};

/// Columnas de un movimiento con ítem y cirugía (paciente) unidos.
const MOVEMENT_SELECT: &str = "
    SELECT m.ID, m.ITEM_ID, m.TYPE, m.QTY, m.STOCK_AFTER, m.UNIT_COST, m.REASON,
           m.SURGERY_ID, LEFT(CAST(m.CREATED_AT AS VARCHAR(60)), 19),
           i.CODE, i.NAME, i.UNIT, s.CODE, p.NAME
    FROM INVENTORY_MOVEMENTS m
    JOIN INVENTORY_ITEMS i ON i.ID = m.ITEM_ID
    LEFT JOIN SURGERIES s ON s.ID = m.SURGERY_ID
    LEFT JOIN PATIENTS p ON p.ID = s.PATIENT_ID";

pub(crate) type MovementRow = (
    i32,            // id
    i32,            // item_id
    String,         // type
    f64,            // qty
    f64,            // stock_after
    Option<f64>,    // unit_cost
    Option<String>, // reason
    Option<i32>,    // surgery_id
    String,         // created_at
    String,         // item_code
    String,         // item_name
    String,         // item_unit
    Option<String>, // surgery_code
    Option<String>, // patient_name
);

pub(crate) fn map_movement(r: MovementRow) -> InventoryMovement {
    InventoryMovement {
        id: r.0,
        item_id: r.1,
        movement_type: r.2,
        qty: r.3,
        stock_after: r.4,
        unit_cost: r.5,
        reason: r.6,
        surgery_id: r.7,
        created_at: r.8,
        surgery_code: r.12,
        patient_name: r.13,
        item: Some(MovementItemRef {
            id: r.1,
            code: r.9,
            name: r.10,
            unit: r.11,
        }),
    }
}

/// Historial de movimientos de un ítem (máx. 50, igual que la web).
pub fn list_by_item(
    conn: &mut SimpleConnection,
    item_id: i32,
) -> Result<Vec<InventoryMovement>, AppError> {
    let rows: Vec<MovementRow> = conn
        .query(
            &format!(
                "{MOVEMENT_SELECT}
                 WHERE m.ITEM_ID = ?
                 ORDER BY m.CREATED_AT DESC, m.ID DESC
                 ROWS 50"
            ),
            (&item_id,),
        )
        .map_err(AppError::from)?;
    Ok(rows.into_iter().map(map_movement).collect())
}

fn get(conn: &mut SimpleConnection, id: i32) -> Result<Option<InventoryMovement>, AppError> {
    let row: Option<MovementRow> = conn
        .query_first(&format!("{MOVEMENT_SELECT} WHERE m.ID = ?"), (&id,))
        .map_err(AppError::from)?;
    Ok(row.map(map_movement))
}

/// INSERT de bajo nivel compartido (entrada inicial, consumo quirúrgico...).
/// El llamador se encarga de haber actualizado el stock antes y de estar
/// dentro de una transacción cuando corresponde.
pub(crate) fn insert_raw(
    conn: &mut SimpleConnection,
    item_id: i32,
    movement_type: &str,
    qty: f64,
    stock_after: f64,
    unit_cost: Option<f64>,
    reason: &Option<String>,
    surgery_id: &Option<i32>,
) -> Result<i32, AppError> {
    let id = next_id(conn, "GEN_INVENTORY_MOVEMENTS_ID")?;
    conn.execute(
        "INSERT INTO INVENTORY_MOVEMENTS
            (ID, ITEM_ID, TYPE, QTY, STOCK_AFTER, UNIT_COST, REASON, SURGERY_ID)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (
            &id,
            &item_id,
            &movement_type,
            &qty,
            &stock_after,
            &unit_cost,
            reason,
            surgery_id,
        ),
    )
    .map_err(AppError::from)?;
    Ok(id)
}

/// Registra un movimiento y actualiza el stock del ítem en una transacción:
/// ENTRADA suma · SALIDA resta (valida stock suficiente) · AJUSTE fija el
/// valor absoluto contado. Devuelve el movimiento y el ítem actualizado.
pub fn create(
    conn: &mut SimpleConnection,
    item_id: i32,
    input: &CreateMovementInput,
) -> Result<MovementResult, AppError> {
    // El ítem debe existir (404-equivalente de la web).
    let (current_stock,): (f64,) = conn
        .query_first(
            "SELECT STOCK_QTY FROM INVENTORY_ITEMS WHERE ID = ?",
            (&item_id,),
        )
        .map_err(AppError::from)?
        .ok_or_else(|| AppError::NotFound("Item de inventario no encontrado".into()))?;

    // La cirugía de origen (salidas quirúrgicas) debe existir.
    if let Some(surgery_id) = input.surgery_id {
        let row: Option<(i32,)> = conn
            .query_first("SELECT ID FROM SURGERIES WHERE ID = ?", (&surgery_id,))
            .map_err(AppError::from)?;
        if row.is_none() {
            return Err(AppError::Validation("Cirugía no encontrada".into()));
        }
    }

    let new_stock = match input.movement_type.as_str() {
        "ENTRADA" => current_stock + input.qty,
        "SALIDA" => {
            let s = current_stock - input.qty;
            if s < 0.0 {
                return Err(AppError::Validation(format!(
                    "Stock insuficiente: disponible {}",
                    fmt_qty(current_stock)
                )));
            }
            s
        }
        "AJUSTE" => input.qty, // qty = stock físico contado (valor final)
        other => {
            return Err(AppError::Validation(format!(
                "Tipo de movimiento inválido: {other} (ENTRADA, SALIDA o AJUSTE)"
            )));
        }
    };

    conn.begin_transaction().map_err(AppError::from)?;
    let result = (|| {
        conn.execute(
            "UPDATE INVENTORY_ITEMS
                SET STOCK_QTY = ?, UPDATED_AT = CURRENT_TIMESTAMP
              WHERE ID = ?",
            (&new_stock, &item_id),
        )
        .map_err(AppError::from)?;

        let movement_id = insert_raw(
            conn,
            item_id,
            &input.movement_type,
            input.qty,
            new_stock,
            input.unit_cost,
            &input.reason,
            &input.surgery_id,
        )?;

        let movement = get(conn, movement_id)?
            .ok_or_else(|| AppError::Internal("Movimiento creado pero no recuperado".into()))?;
        let item = crate::repositories::inventory::get(conn, item_id)?
            .ok_or_else(|| AppError::Internal("Ítem no recuperado tras el movimiento".into()))?;
        Ok(MovementResult { movement, item })
    })();

    match result {
        Ok(v) => {
            conn.commit().map_err(AppError::from)?;
            Ok(v)
        }
        Err(e) => {
            conn.rollback().ok();
            Err(e)
        }
    }
}
