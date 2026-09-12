use serde::{Deserialize, Serialize};

/// Identidad de la clínica (fila única, ID = 1). Alimenta el encabezado y el
/// pie de los documentos imprimibles; todo menos el nombre es opcional.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClinicSettings {
    pub clinic_name: Option<String>,
    /// NIT / registro tributario
    pub tax_id: Option<String>,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    /// Licencia / registro profesional del establecimiento
    pub license: Option<String>,
    /// Logo como data URL (p. ej. «data:image/png;base64,…»)
    pub logo_data_url: Option<String>,
    /// YYYY-MM-DD HH:MM:SS
    pub updated_at: Option<String>,
}

/// Actualización de la configuración (solo admins). Campos None = dejar sin
/// cambio; strings vacíos se interpretan como «quitar el dato» (NULL),
/// consistente con la edición de veterinarios y pacientes.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateClinicSettingsInput {
    pub clinic_name: Option<String>,
    pub tax_id: Option<String>,
    pub address: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub license: Option<String>,
    pub logo_data_url: Option<String>,
}
