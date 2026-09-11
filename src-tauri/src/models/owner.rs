use serde::{Deserialize, Serialize};

/// Propietario de paciente. Único por (tipo, número) de documento.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Owner {
    pub id: i32,
    /// CC | TI | CE | NIT | PA
    pub document_type: String,
    pub document_number: String,
    pub full_name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub city: Option<String>,
    pub notes: Option<String>,
    /// YYYY-MM-DD HH:MM:SS
    pub created_at: String,
}

/// Datos para crear un propietario.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOwnerInput {
    pub document_type: String,
    pub document_number: String,
    pub full_name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub address: Option<String>,
    pub city: Option<String>,
    pub notes: Option<String>,
}

/// Propietario resumido dentro de una cirugía (solo lo que muestra la agenda).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnerRef {
    pub id: i32,
    pub full_name: String,
    pub phone: Option<String>,
    pub city: Option<String>,
}
