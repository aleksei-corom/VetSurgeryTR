//! Pruebas de integración lógicas del backend (sin Firebird): cubren las
//! funciones puras del dominio — transiciones de estado, validaciones y el
//! separador de sentencias SQL de las migraciones. Se ejecutan con `cargo test`.

use crate::commands::{require_in, require_non_empty, validate_date, INVENTORY_CATEGORIES, SURGERY_STATUSES};
use crate::db::migrations::split_statements;
use crate::error::AppError;
use crate::repositories::fmt_qty;
use crate::repositories::surgery::transition_allowed;

// ------------------------------ Transiciones ------------------------------

#[test]
fn transiciones_validas_de_cirugia() {
    assert!(transition_allowed("PROGRAMADA", "EN_CURSO"));
    assert!(transition_allowed("PROGRAMADA", "COMPLETADA"));
    assert!(transition_allowed("PROGRAMADA", "CANCELADA"));
    assert!(transition_allowed("EN_CURSO", "COMPLETADA"));
    assert!(transition_allowed("EN_CURSO", "CANCELADA"));
}

#[test]
fn transiciones_invalidas_de_cirugia() {
    // Una COMPLETADA o CANCELADA es terminal; no se reabre ni se reprograma.
    assert!(!transition_allowed("COMPLETADA", "PROGRAMADA"));
    assert!(!transition_allowed("CANCELADA", "PROGRAMADA"));
    assert!(!transition_allowed("COMPLETADA", "EN_CURSO"));
    // Misma estado no cuenta como transición.
    assert!(!transition_allowed("PROGRAMADA", "PROGRAMADA"));
    // Saltos que se saltan etapas tampoco (todas las combinaciones no listadas).
    assert!(!transition_allowed("EN_CURSO", "EN_CURSO"));
}

// ------------------------------ Validaciones ------------------------------

#[test]
fn validadores_basicos() {
    assert!(require_non_empty("  x  ", "falla").is_ok());
    let e = require_non_empty("   ", "campo requerido").unwrap_err();
    assert_eq!(e.code, "VALIDATION");

    assert!(require_in("PLACAS", INVENTORY_CATEGORIES, "cat").is_ok());
    assert!(require_in("MINERALES", INVENTORY_CATEGORIES, "cat").is_err());
    assert!(require_in("PROGRAMADA", SURGERY_STATUSES, "estado").is_ok());
}

#[test]
fn fechas_aceptadas_por_el_ipc() {
    assert!(validate_date("2026-02-14").is_ok());
    assert!(validate_date("2026-02-14 08:30:00").is_ok());
    assert!(validate_date("14/02/2026").is_err());
    assert!(validate_date("2026-13-40").is_err());
}

// ------------------------------ Formato ------------------------------

#[test]
fn cantidades_sin_decimales_colgantes() {
    assert_eq!(fmt_qty(6.0), "6");
    assert_eq!(fmt_qty(0.0), "0");
    assert_eq!(fmt_qty(4.25), "4.25");
    assert_eq!(fmt_qty(-1.5), "-1.5");
}

// --------------------------- Migraciones (SQL) ---------------------------

#[test]
fn separa_sentencias_sql_simple() {
    let sql = "CREATE TABLE A (ID INTEGER);\nCREATE TABLE B (ID INTEGER);";
    let stmts = split_statements(sql).unwrap();
    assert_eq!(stmts.len(), 2);
    assert!(stmts[0].starts_with("CREATE TABLE A"));
    assert!(stmts[1].starts_with("CREATE TABLE B"));
}

#[test]
fn respeta_set_term_para_triggers() {
    let sql = "SET TERM ^ ;\nCREATE TRIGGER T FOR A BEFORE INSERT AS\nBEGIN\n  NEW.ID = 1;\nEND^\nSET TERM ; ^\nCREATE TABLE B (ID INTEGER);";
    let stmts = split_statements(sql).unwrap();
    assert_eq!(stmts.len(), 2);
    // El trigger completo (con ';' internos) es UNA sola sentencia.
    assert!(stmts[0].starts_with("CREATE TRIGGER T"));
    assert!(stmts[0].contains("NEW.ID = 1;"));
    assert!(stmts[1].starts_with("CREATE TABLE B"));
}

#[test]
fn ignora_comentarios_y_lineas_vacias() {
    let sql = "-- comentario\n\nCREATE TABLE A (ID INTEGER); -- trailing\n";
    let stmts = split_statements(sql).unwrap();
    assert_eq!(stmts.len(), 1);
    assert!(!stmts[0].contains("comentario"));
}

#[test]
fn error_si_el_script_queda_incompleto() {
    let e = split_statements("CREATE TABLE A (ID INTEGER)").unwrap_err();
    assert!(matches!(e, AppError { .. }));
    assert!(e.message.contains("incompleta"));
}
