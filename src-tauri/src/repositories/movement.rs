use rsfbclient::prelude::*;
use rsfbclient::SimpleConnection;

use crate::error::AppError;
use crate::models::inventory::{
    CreateMovementInput, InventoryMovement, MovementItemRef, MovementResult,
};
use crate::repositories::{fmt_qty, next_id};

/// Columnas de un movimiento con ítem y cirugía (paciente) unidos.
/// OJO: la columna discriminadora es MVMT_TYPE (TYPE es palabra reservada en
/// Firebird 3+; ver 0002_core.sql).
const MOVEMENT_SELECT: &str = "
    SELECT m.ID, m.ITEM_ID, m.MVMT_TYPE, m.QTY, m.STOCK_AFTER, m.UNIT_COST, m.REASON,
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

/// Kardex global: últimos movimientos con filtros opcionales por ítem, tipo
/// y búsqueda (nombre/código del ítem). Orden descendente por fecha.
pub fn list_all(
    conn: &mut SimpleConnection,
    item_id: Option<i32>,
    movement_type: Option<&str>,
    search: Option<&str>,
    limit: i32,
) -> Result<Vec<InventoryMovement>, AppError> {
    let like = search
        .map(|s| format!("%{}%", s.trim()))
        .filter(|s| !s.trim_matches('%').is_empty());

    let rows: Vec<MovementRow> = conn
        .query(
            &format!(
                "{MOVEMENT_SELECT}
                 WHERE (? IS NULL OR m.ITEM_ID = ?)
                   AND (? IS NULL OR m.MVMT_TYPE = ?)
                   AND (? IS NULL
                        OR UPPER(i.NAME) LIKE UPPER(?)
                        OR UPPER(i.CODE) LIKE UPPER(?))
                 ORDER BY m.CREATED_AT DESC, m.ID DESC
                 ROWS {limit}"
            ),
            (
                &item_id, &item_id,
                &movement_type, &movement_type,
                &like, &like, &like,
            ),
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
// clippy::too_many_arguments: firma espejo del INSERT (8 columnas); las
// partes ya forman el vocabulario del dominio (movimiento + snapshot).
#[allow(clippy::too_many_arguments)]
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
            (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, UNIT_COST, REASON, SURGERY_ID)
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

/// Stock resultante de aplicar un movimiento sobre el stock actual:
/// ENTRADA suma · SALIDA resta (valida stock suficiente) · AJUSTE fija el
/// valor absoluto contado (0 legítimo: «se agotó»).
/// Función pura, cubierta por pruebas unitarias.
pub(crate) fn compute_new_stock(
    current_stock: f64,
    movement_type: &str,
    qty: f64,
) -> Result<f64, AppError> {
    match movement_type {
        "ENTRADA" => Ok(current_stock + qty),
        "SALIDA" => {
            let s = current_stock - qty;
            if s < 0.0 {
                Err(AppError::Validation(format!(
                    "Stock insuficiente: disponible {}",
                    fmt_qty(current_stock)
                )))
            } else {
                Ok(s)
            }
        }
        "AJUSTE" => Ok(qty), // qty = stock físico contado (valor final)
        other => Err(AppError::Validation(format!(
            "Tipo de movimiento inválido: {other} (ENTRADA, SALIDA o AJUSTE)"
        ))),
    }
}

/// Registra un movimiento y actualiza el stock del ítem en una transacción:
/// ENTRADA suma · SALIDA resta (valida stock suficiente) · AJUSTE fija el
/// valor absoluto contado. Devuelve el movimiento y el ítem actualizado.
pub fn create(
    conn: &mut SimpleConnection,
    item_id: i32,
    input: &CreateMovementInput,
    actor: &str,
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

    let new_stock = compute_new_stock(current_stock, &input.movement_type, input.qty)?;

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

        // Auditoría (misma transacción: si algo falla, no queda registro).
        crate::repositories::audit::log(
            conn,
            actor,
            "INVENTARIO",
            Some(item_id),
            Some(&item.code),
            &input.movement_type,
            Some(format!(
                "{}: {} {} {} → stock {}{}",
                item.name,
                if input.movement_type == "AJUSTE" { "ajuste a" } else { if input.movement_type == "ENTRADA" { "+" } else { "−" } },
                crate::repositories::fmt_qty(input.qty),
                item.unit,
                crate::repositories::fmt_qty(new_stock),
                input.reason.as_deref().map(|r| format!(" · {r}")).unwrap_or_default(),
            )),
        )?;

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn entrada_suma() {
        assert_eq!(compute_new_stock(6.0, "ENTRADA", 4.0).unwrap(), 10.0);
        assert_eq!(compute_new_stock(0.0, "ENTRADA", 2.5).unwrap(), 2.5);
    }

    #[test]
    fn salida_resta_y_valida_stock() {
        assert_eq!(compute_new_stock(6.0, "SALIDA", 4.0).unwrap(), 2.0);
        assert_eq!(compute_new_stock(5.0, "SALIDA", 5.0).unwrap(), 0.0);
        let err = compute_new_stock(2.0, "SALIDA", 3.0).unwrap_err();
        assert!(err.message.contains("Stock insuficiente"));
        assert!(err.message.contains("disponible 2"));
    }

    #[test]
    fn ajuste_fija_el_absoluto_incluyendo_cero() {
        // Regresión: un conteo físico de 0 debe ser válido.
        assert_eq!(compute_new_stock(7.0, "AJUSTE", 0.0).unwrap(), 0.0);
        assert_eq!(compute_new_stock(7.0, "AJUSTE", 12.5).unwrap(), 12.5);
        assert_eq!(compute_new_stock(0.0, "AJUSTE", 0.0).unwrap(), 0.0);
    }

    #[test]
    fn tipo_invalido_rechazado() {
        assert!(compute_new_stock(1.0, "ROBO", 1.0).is_err());
    }
}
