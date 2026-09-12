pub mod audit;
pub mod clinic;
pub mod dashboard;
pub mod follow_up;
pub mod inventory;
pub mod movement;
pub mod owner;
pub mod patient;
pub mod surgery;
pub mod user;
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

pub use crate::db::with_tx;
