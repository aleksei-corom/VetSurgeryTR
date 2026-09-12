use serde::{Deserialize, Serialize};

/// Usuario local de la app de escritorio (sin el hash: jamás sale al UI).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct User {
    pub id: i32,
    pub username: String,
    pub display_name: String,
    /// ADMIN | VET
    pub role: String,
    pub active: bool,
}

/// Sesión local en memoria (solo vive mientras la app esté abierta).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub user: User,
    /// Momento del login: YYYY-MM-DD HH:MM:SS.
    pub logged_in_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginInput {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangePasswordInput {
    pub current_password: String,
    pub new_password: String,
}

/// Alta de usuario por un administrador (gestión de acceso de la clínica).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateUserInput {
    pub username: String,
    pub display_name: String,
    pub password: String,
    /// ADMIN | VET
    pub role: String,
}

/// Restablecimiento de contraseña por un administrador (sin conocer la
/// actual: es para cuando un usuario la olvidó).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResetPasswordInput {
    pub new_password: String,
}

/// Edición de un usuario por un administrador (nombre visible y/o rol).
/// Campos None = dejar sin cambio. El username NO se editable (es su
/// identidad en la bitácora y en los ingresos).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateUserInput {
    pub display_name: Option<String>,
    /// ADMIN | VET
    pub role: Option<String>,
}
