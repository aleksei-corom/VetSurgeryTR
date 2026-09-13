use tauri::State;

use crate::error::AppError;
use crate::models::audit::{AuditEntry, DocumentPrintCount, EntityPrintTotal};
use crate::repositories::audit as audit_repo;
use crate::state::AppState;

/// Tipo de entidad para los registros de impresión de documentos clínicos.
/// Validado también en `AUDIT_ENTITIES` más abajo.
pub const AUDIT_ENTITY_DOCUMENTO: &str = "DOCUMENTO";

pub const AUDIT_ENTITIES: &[&str] = &[
    "INVENTARIO", "CIRUGIA", "PACIENTE", "USUARIO", "DOCUMENTO",
];

/// Input de `log_document_print`: identificación del documento impreso.
#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogDocumentPrintInput {
    /// Tipo de documento legible: «Consentimiento informado»,
    /// «Fórmula médica postquirúrgica», «Historia clínica quirúrgica» o
    /// «Historia clínica del paciente».
    pub document: String,
    /// Código de la entidad de origen: CIR-2026-0001 (documentos de cirugía)
    /// o PAC-2026-0001 (historia del paciente). Informativo, sin FK.
    pub entity_code: String,
    /// ID de la cirugía o del paciente, si aplica (informativo).
    pub entity_id: Option<i32>,
}

/// Registra en la bitácora la impresión de un documento clínico: quién la
/// hizo y cuándo (CREATED_AT lo pone la BD). Requiere sesión activa: el
/// registro se atribuye al usuario autenticado; sin sesión no hay nada que
/// imprimir ni a quién atribuir.
///
/// Firebird no guarda campos generados: el frontend llama a este comando
/// justo cuando confirma la impresión (botón «Imprimir / PDF»), no al
/// abrirla vista previa — mirar no es imprimir.
#[tauri::command]
pub async fn log_document_print(
    state: State<'_, AppState>,
    input: LogDocumentPrintInput,
) -> Result<(), AppError> {
    let session = state.require_session()?;
    let document = input.document.trim();
    let code = input.entity_code.trim();
    if document.is_empty() || code.is_empty() {
        return Err(AppError::validation(
            "Documento y código de entidad son obligatorios para registrar la impresión",
        ));
    }

    let actor = session.user.display_name;
    let mut pooled = state.pool.acquire()?;
    audit_repo::log_document_print(pooled.conn(), &actor, input.entity_id, code, document)
}

/// Impresiones por tipo de documento de una entidad (cirugía CIR-… o
/// paciente PAC-…): conteo y última fecha. Requiere sesión; es solo lectura
/// y disponible para todo el personal (los datos de impresión no son
/// sensibles y guían la reimpresión).
#[tauri::command]
pub async fn get_document_prints(
    state: State<'_, AppState>,
    entity_code: String,
) -> Result<Vec<DocumentPrintCount>, AppError> {
    state.require_session()?;
    let code = entity_code.trim().to_uppercase();
    if code.is_empty() {
        return Err(AppError::validation(
            "El código de entidad es obligatorio (CIR-… o PAC-…)",
        ));
    }
    let mut pooled = state.pool.acquire()?;
    audit_repo::print_counts_for(pooled.conn(), &code)
        .map(|rows| {
            rows.into_iter()
                .map(|(document, count, last_printed_at)| DocumentPrintCount {
                    document,
                    count,
                    last_printed_at,
                })
                .collect()
        })
}

/// Total de impresiones de documentos por código de entidad, filtrado por
/// prefijo («PAC-» pacientes, «CIR-» cirugías): alimenta la columna
/// «Impresiones» de los listados con una sola consulta. Requiere sesión
/// (solo lectura); devuelve solo códigos con impresiones registradas.
#[tauri::command]
pub async fn get_print_totals(
    state: State<'_, AppState>,
    prefix: String,
) -> Result<Vec<EntityPrintTotal>, AppError> {
    state.require_session()?;
    let prefix = prefix.trim().to_uppercase();
    if prefix.is_empty() || !prefix.ends_with('-') {
        return Err(AppError::validation(
            "El prefijo es obligatorio y debe terminar en '-' (p. ej. PAC- o CIR-)",
        ));
    }
    let mut pooled = state.pool.acquire()?;
    audit_repo::print_totals_by_prefix(pooled.conn(), &prefix)
        .map(|rows| {
            rows.into_iter()
                .map(|(entity_code, count)| EntityPrintTotal { entity_code, count })
                .collect()
        })
}

/// Bitácora de auditoría (más recientes primero) con filtros por entidad y
/// búsqueda libre en código de entidad y detalle.
#[tauri::command]
pub async fn list_audit_log(
    state: State<'_, AppState>,
    entity_type: Option<String>,
    action: Option<String>,
    search: Option<String>,
    limit: Option<i32>,
) -> Result<Vec<AuditEntry>, AppError> {
    if let Some(e) = entity_type.as_deref() {
        if !AUDIT_ENTITIES.contains(&e) {
            return Err(AppError::Validation(
                "el tipo de entidad es inválido (INVENTARIO, CIRUGIA, PACIENTE, USUARIO o DOCUMENTO)".into(),
            ));
        }
    }
    let limit = limit.unwrap_or(200).clamp(1, 1000);

    state.require_session()?;
    let mut pooled = state.pool.acquire()?;
    audit_repo::list(
        pooled.conn(),
        entity_type.as_deref(),
        action.as_deref(),
        search.as_deref(),
        limit,
    )
}
