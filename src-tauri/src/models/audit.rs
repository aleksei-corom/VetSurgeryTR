use serde::Serialize;

/// Entrada de la bitácora de auditoría: quién hizo qué y cuándo sobre una
/// entidad del dominio (inventario, cirugías, pacientes).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditEntry {
    pub id: i32,
    /// INVENTARIO | CIRUGIA | PACIENTE | USUARIO | VETERINARIO
    pub entity_type: String,
    pub entity_id: Option<i32>,
    /// INV-0001 / CIR-2026-0001 / PAC-2026-0001
    pub entity_code: Option<String>,
    /// ENTRADA | SALIDA | AJUSTE | ESTADO | EDITAR
    pub action: String,
    /// Resumen legible (p. ej. «Platina LCP: 2 pie → stock 8» o diff de campos).
    pub detail: Option<String>,
    /// Autor de la acción: nombre visible del usuario de la sesión local
    /// (p. ej. «Administrador»); entra con login desde la migración 0005.
    pub actor: String,
    /// YYYY-MM-DD HH:MM:SS
    pub created_at: String,
}

/// Actor de respaldo para operaciones internas que no provienen de un
/// usuario autenticado (seed/migraciones); el resto siempre trae sesión.
pub const SYSTEM_ACTOR: &str = "Sistema local";

/// Impresiones de un documento clínico para una entidad de origen
/// (cirugía o paciente): cuántas veces salió y cuándo fue la última.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentPrintCount {
    /// Tipo de documento: «Consentimiento informado», «Fórmula médica
    /// postquirúrgica», «Historia clínica quirúrgica» o «Historia clínica
    /// del paciente».
    pub document: String,
    /// Impresiones registradas.
    pub count: i32,
    /// Fecha de la última impresión (YYYY-MM-DD HH:MM:SS), si existe.
    pub last_printed_at: Option<String>,
}
