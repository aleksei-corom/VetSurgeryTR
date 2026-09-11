pub mod dashboard;
pub mod db;
pub mod follow_ups;
pub mod inventory;
pub mod materials;
pub mod movements;
pub mod owners;
pub mod patients;
pub mod surgeries;
pub mod vets;

use crate::error::AppError;

// ============================ CATÁLOGOS =====================================
// Idénticos a src/types.ts (frontend) y a la app web.

pub const DOCUMENT_TYPES: &[&str] = &["CC", "TI", "CE", "NIT", "PA"];

pub const SURGERY_STATUSES: &[&str] = &["PROGRAMADA", "EN_CURSO", "COMPLETADA", "CANCELADA"];

pub const ANESTHESIA_TYPES: &[&str] = &[
    "General inhalatoria",
    "General inyectable",
    "Local / regional",
    "Sedación + local",
    "Sin anestesia",
];

pub const LATERALITIES: &[&str] = &["Izquierda", "Derecha", "Bilateral", "No aplica"];

pub const FOLLOW_UP_TYPES: &[&str] = &[
    "CONTROL_RADIOGRAFICO",
    "CURACION",
    "RETIRO_PUNTOS",
    "EVALUACION",
    "RETIRO_IMPLANTES",
];

pub const FOLLOW_UP_STATUSES: &[&str] = &["PENDIENTE", "CUMPLIDO", "PERDIDO"];

pub const MOVEMENT_TYPES: &[&str] = &["ENTRADA", "SALIDA", "AJUSTE"];

pub const INVENTORY_CATEGORIES: &[&str] = &[
    "PLACAS",
    "TORNILLOS",
    "PINES",
    "ALAMBRES",
    "FIJADORES",
    "INJERTOS",
    "INSTRUMENTAL",
    "SUTURAS",
    "MEDICAMENTOS",
    "INSUMOS",
];

// =========================== VALIDACIONES ===================================

/// Campo textual requerido (trim). El mensaje replica el de la web.
pub fn require_non_empty(value: &str, message: &str) -> Result<(), AppError> {
    if value.trim().is_empty() {
        Err(AppError::Validation(message.into()))
    } else {
        Ok(())
    }
}

/// Valor dentro del catálogo.
pub fn require_in(value: &str, catalog: &[&str], message: &str) -> Result<(), AppError> {
    if catalog.contains(&value) {
        Ok(())
    } else {
        Err(AppError::Validation(message.into()))
    }
}

/// Fecha "YYYY-MM-DD" o "YYYY-MM-DD HH:MM:SS" (lo que viaja por el IPC).
pub fn validate_date(value: &str) -> Result<(), AppError> {
    let ok = chrono::NaiveDate::parse_from_str(value, "%Y-%m-%d").is_ok()
        || chrono::NaiveDateTime::parse_from_str(value, "%Y-%m-%d %H:%M:%S").is_ok();
    if ok {
        Ok(())
    } else {
        Err(AppError::Validation("fecha ISO inválida".into()))
    }
}
