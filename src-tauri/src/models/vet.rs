use serde::{Deserialize, Serialize};

/// Veterinario responsable de cirugías.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Vet {
    pub id: i32,
    pub full_name: String,
    /// Tarjeta profesional MV
    pub license: Option<String>,
    pub specialty: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub active: bool,
    /// YYYY-MM-DD HH:MM:SS
    pub created_at: String,
}

/// Datos para crear un veterinario.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateVetInput {
    pub full_name: String,
    pub license: Option<String>,
    pub specialty: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
}

/// Edición de un veterinario (solo admins). Campos None = dejar sin cambio;
/// strings vacíos se interpretan como «quitar el dato» (NULL).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateVetInput {
    pub full_name: Option<String>,
    pub license: Option<String>,
    pub specialty: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
}

/// Veterinario resumido dentro de una cirugía.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VetRef {
    pub id: i32,
    pub full_name: String,
    pub specialty: Option<String>,
}
