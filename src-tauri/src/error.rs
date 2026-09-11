use serde::Serialize;
use thiserror::Error;

/// Error tipado de la app. Se serializa como `{ code, message }` para el
/// frontend (los códigos son estables y los mensajes, en español, replican
/// los de la app web).
///
/// Códigos: `VALIDATION` (datos inválidos/400), `DUPLICATE` (violación de
/// unicidad/400), `NOT_FOUND` (404), `STOCK` (stock insuficiente/400) y
/// `DB` (errores del motor Firebird/500).
#[derive(Debug, Clone, Error, Serialize)]
#[error("{message}")]
pub struct AppError {
    pub code: String,
    pub message: String,
}

impl AppError {
    /// Datos inválidos (equivalente 400 de la web).
    pub fn validation(message: impl Into<String>) -> Self {
        Self {
            code: "VALIDATION".into(),
            message: message.into(),
        }
    }

    #[allow(non_snake_case)]
    pub fn Validation(message: String) -> Self {
        Self::validation(message)
    }

    /// Registro duplicado (unique del modelo).
    pub fn duplicate(message: impl Into<String>) -> Self {
        Self {
            code: "DUPLICATE".into(),
            message: message.into(),
        }
    }

    #[allow(non_snake_case)]
    pub fn Duplicate(message: String) -> Self {
        Self::duplicate(message)
    }

    /// Registro no encontrado (equivalente 404 de la web).
    pub fn not_found(message: impl Into<String>) -> Self {
        Self {
            code: "NOT_FOUND".into(),
            message: message.into(),
        }
    }

    #[allow(non_snake_case)]
    pub fn NotFound(message: String) -> Self {
        Self::not_found(message)
    }

    /// Stock insuficiente para una SALIDA o un consumo quirúrgico.
    pub fn stock(message: impl Into<String>) -> Self {
        Self {
            code: "STOCK".into(),
            message: message.into(),
        }
    }

    #[allow(non_snake_case)]
    pub fn Stock(message: String) -> Self {
        Self::stock(message)
    }

    /// Error del motor Firebird (conexión, SQL, constraints no previstas).
    pub fn db(message: impl Into<String>) -> Self {
        Self {
            code: "DB".into(),
            message: message.into(),
        }
    }

    #[allow(non_snake_case)]
    pub fn Db(message: String) -> Self {
        Self::db(message)
    }

    /// Error interno inesperado (se reporta como DB).
    pub fn internal(message: impl Into<String>) -> Self {
        Self {
            code: "DB".into(),
            message: message.into(),
        }
    }

    #[allow(non_snake_case)]
    pub fn Internal(message: String) -> Self {
        Self::internal(message)
    }
}

impl From<rsfbclient::FbError> for AppError {
    /// Convierte errores de Firebird. Mapea las violaciones de unicidad por
    /// nombre de constraint a los mismos mensajes en español que produce la
    /// web al capturar el P2002 de Prisma (red de seguridad: la app valida
    /// casi todo antes de tocar la BD).
    fn from(e: rsfbclient::FbError) -> Self {
        let msg = e.to_string();
        if msg.contains("UNQ_OWNERS_DOC") {
            AppError::duplicate("Ya existe un propietario con ese documento")
        } else if msg.contains("UNQ_PATIENTS_MICROCHIP") || msg.contains("MICROCHIP") {
            AppError::duplicate("Ya existe un paciente con ese microchip")
        } else if msg.contains("UNQ_") || msg.contains("UNIQUE") {
            AppError::duplicate("Ya existe un registro con ese código")
        } else if msg.contains("violation of FOREIGN KEY") || msg.contains("FK") {
            AppError::db(format!("Registro referenciado no encontrado: {msg}"))
        } else {
            AppError::db(msg)
        }
    }
}
