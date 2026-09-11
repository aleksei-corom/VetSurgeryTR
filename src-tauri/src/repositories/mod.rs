pub mod dashboard;
pub mod follow_up;
pub mod inventory;
pub mod movement;
pub mod owner;
pub mod patient;
pub mod surgery;
pub mod vet;

use rsfbclient::prelude::*;
use rsfbclient::SimpleConnection;

use crate::error::AppError;

/// Obtiene el siguiente ID de un GENERATOR (con CAST a INTEGER).
pub fn next_id(conn: &mut SimpleConnection, generator: &str) -> Result<i32, AppError> {
    let sql = format!("SELECT CAST(GEN_ID({generator}, 1) AS INTEGER) FROM rdb$database");
    conn.query_first(&sql, ())
        .map_err(AppError::from)?
        .map(|(v,): (i32,)| v)
        .ok_or_else(|| AppError::Internal("Generador sin valor".into()))
}

/// Formatea una cantidad f64 sin decimales cuando es entera, para que los
/// mensajes de error queden idénticos a los de la app web
/// (p. ej. "Stock insuficiente: disponible 6" y no "disponible 6.0").
pub fn fmt_qty(v: f64) -> String {
    if v.is_finite() && v.fract() == 0.0 {
        format!("{}", v as i64)
    } else {
        format!("{v}")
    }
}

/// Inicia una transacción explícita y ejecuta la lógica. Si la lógica falla
/// se hace ROLLBACK (nada queda a medias); si éxito, COMMIT.
///
/// `SimpleConnection` confirma automáticamente cada sentencia salvo que se
/// abra una transacción con `begin_transaction` (ver src/connection/mod.rs
/// de rsfbclient); así los flujos multi-sentencia (crear paciente con
/// propietario, consumo de inventario al completar cirugía...) son atómicos.
pub fn with_tx<T>(
    conn: &mut SimpleConnection,
    logic: impl FnOnce(&mut SimpleConnection) -> Result<T, AppError>,
) -> Result<T, AppError> {
    conn.begin_transaction().map_err(AppError::from)?;
    match logic(conn) {
        Ok(v) => {
            conn.commit().map_err(AppError::from)?;
            Ok(v)
        }
        Err(e) => {
            // El rollback es best-effort: el error original manda.
            conn.rollback().ok();
            Err(e)
        }
    }
}
