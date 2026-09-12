use tauri::State;

use crate::commands::{
    require_in, require_non_empty, validate_date, ANESTHESIA_TYPES, LATERALITIES, SURGERY_STATUSES,
};
use crate::error::AppError;
use crate::models::surgery::{CreateSurgeryInput, Surgery, SurgeryDetail, UpdateSurgeryInput};
use crate::repositories::surgery as surgery_repo;
use crate::state::AppState;

/// Agenda quirúrgica con filtros por estado, paciente y búsqueda global
/// (paciente, código, propietario o procedimiento).
#[tauri::command]
pub async fn list_surgeries(
    state: State<'_, AppState>,
    status: Option<String>,
    search: Option<String>,
    patient_id: Option<i32>,
) -> Result<Vec<Surgery>, AppError> {
    if let Some(s) = status.as_deref() {
        require_in(s, SURGERY_STATUSES, "el estado de cirugía es inválido")?;
    }
    state.require_session()?;
    let mut pooled = state.pool.acquire()?;
    surgery_repo::list(pooled.conn(), status.as_deref(), search.as_deref(), patient_id)
}

/// Ficha completa de la cirugía (materiales + controles postoperatorios).
#[tauri::command]
pub async fn get_surgery(state: State<'_, AppState>, id: i32) -> Result<Option<SurgeryDetail>, AppError> {
    state.require_session()?;
    let mut pooled = state.pool.acquire()?;
    surgery_repo::get_detail(pooled.conn(), id)
}

/// Programa una cirugía (código CIR-YYYY-NNNN, estado inicial PROGRAMADA).
#[tauri::command]
pub async fn create_surgery(
    state: State<'_, AppState>,
    input: CreateSurgeryInput,
) -> Result<SurgeryDetail, AppError> {
    require_non_empty(&input.procedure_type, "el tipo de procedimiento es requerido")?;
    validate_date(&input.scheduled_at)?;
    validate_surgery_fields(
        input.duration_min,
        input.anesthesia_type.as_deref(),
        input.asa_risk,
        input.laterality.as_deref(),
        input.estimated_cost,
    )?;

    state.require_session()?;
    let mut pooled = state.pool.acquire()?;
    surgery_repo::create(pooled.conn(), &input, &state.actor())
}

/// Actualización dual (PATCH de la web):
///  a) transición de estado: PROGRAMADA→EN_CURSO/COMPLETADA/CANCELADA,
///     EN_CURSO→COMPLETADA/CANCELADA; STARTED_AT/COMPLETED_AT automáticos y
///     consumo de inventario transaccional al completar;
///  b) campos editables + sincronización de materials[] (bloqueada si la
///     cirugía ya está COMPLETADA).
#[tauri::command]
pub async fn update_surgery(
    state: State<'_, AppState>,
    id: i32,
    input: UpdateSurgeryInput,
) -> Result<SurgeryDetail, AppError> {
    if let Some(s) = input.status.as_deref() {
        require_in(s, SURGERY_STATUSES, "el estado de cirugía es inválido")?;
    }
    if let Some(p) = input.procedure_type.as_deref() {
        require_non_empty(p, "el tipo de procedimiento es requerido")?;
    }
    if let Some(d) = input.scheduled_at.as_deref() {
        validate_date(d)?;
    }
    validate_surgery_fields(
        input.duration_min,
        input.anesthesia_type.as_deref(),
        input.asa_risk,
        input.laterality.as_deref(),
        input.estimated_cost,
    )?;
    if let Some(materials) = &input.materials {
        for m in materials {
            if m.qty_planned <= 0.0 {
                return Err(AppError::Validation(
                    "qtyPlanned debe ser mayor a 0".into(),
                ));
            }
            if let Some(used) = m.qty_used {
                if used < 0.0 {
                    return Err(AppError::Validation(
                        "qtyUsed no puede ser negativo".into(),
                    ));
                }
            }
        }
    }

    state.require_session()?;
    let mut pooled = state.pool.acquire()?;
    surgery_repo::update(pooled.conn(), id, &input, &state.actor())
}

/// Validaciones compartidas por create/update.
fn validate_surgery_fields(
    duration_min: Option<i32>,
    anesthesia_type: Option<&str>,
    asa_risk: Option<i32>,
    laterality: Option<&str>,
    estimated_cost: Option<f64>,
) -> Result<(), AppError> {
    if let Some(d) = duration_min {
        if d <= 0 || d > 1440 {
            return Err(AppError::Validation(
                "la duración debe estar entre 1 y 1440 minutos".into(),
            ));
        }
    }
    if let Some(a) = anesthesia_type {
        require_in(a, ANESTHESIA_TYPES, "el tipo de anestesia es inválido")?;
    }
    if let Some(asa) = asa_risk {
        if !(1..=5).contains(&asa) {
            return Err(AppError::Validation("el riesgo ASA debe estar entre 1 y 5".into()));
        }
    }
    if let Some(l) = laterality {
        require_in(l, LATERALITIES, "la lateralidad es inválida")?;
    }
    if let Some(c) = estimated_cost {
        if c < 0.0 {
            return Err(AppError::Validation(
                "el costo estimado no puede ser negativo".into(),
            ));
        }
    }
    Ok(())
}
