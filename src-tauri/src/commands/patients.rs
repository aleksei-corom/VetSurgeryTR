use tauri::State;

use crate::commands::{require_in, require_non_empty, validate_date, DOCUMENT_TYPES};
use crate::error::AppError;
use crate::models::patient::{CreatePatientInput, PatientDetail, UpdatePatientInput};
use crate::repositories::patient as patient_repo;
use crate::state::AppState;

/// Listado de pacientes con búsqueda (nombre/código/propietario/microchip),
/// filtro por especie y por estado activo.
#[tauri::command]
pub async fn list_patients(
    state: State<'_, AppState>,
    search: Option<String>,
    species: Option<String>,
    active: Option<bool>,
) -> Result<Vec<crate::models::patient::Patient>, AppError> {
    state.require_session()?;
    let mut pooled = state.pool.acquire()?;
    patient_repo::list(pooled.conn(), search.as_deref(), species.as_deref(), active)
}

/// Ficha del paciente con su historial quirúrgico.
#[tauri::command]
pub async fn get_patient(
    state: State<'_, AppState>,
    id: i32,
) -> Result<Option<PatientDetail>, AppError> {
    state.require_session()?;
    let mut pooled = state.pool.acquire()?;
    patient_repo::get_detail(pooled.conn(), id)
}

/// Crea un paciente (código PAC-YYYY-NNNN). El propietario se reutiliza por
/// documento único: si existe se actualizan nombre y contactos provistos.
#[tauri::command]
pub async fn create_patient(
    state: State<'_, AppState>,
    input: CreatePatientInput,
) -> Result<crate::models::patient::Patient, AppError> {
    require_in(
        &input.owner.document_type,
        DOCUMENT_TYPES,
        "el tipo de documento es inválido (CC, TI, CE, NIT o PA)",
    )?;
    require_non_empty(
        &input.owner.document_number,
        "el número de documento es requerido",
    )?;
    require_non_empty(&input.owner.full_name, "el nombre del propietario es requerido")?;
    require_non_empty(&input.name, "el nombre del paciente es requerido")?;
    require_non_empty(&input.species, "la especie es requerida")?;
    require_in(&input.sex, &["M", "F"], "el sexo debe ser M o F")?;
    if let Some(weight) = input.weight {
        if weight <= 0.0 {
            return Err(AppError::Validation("el peso debe ser mayor a 0".into()));
        }
    }
    if let Some(birth) = input.birth_date.as_deref() {
        validate_date(birth)?;
    }

    state.require_session()?;
    let mut pooled = state.pool.acquire()?;
    patient_repo::create(pooled.conn(), &input, &state.actor())
}

/// Actualización parcial de paciente (None = dejar sin cambio).
#[tauri::command]
pub async fn update_patient(
    state: State<'_, AppState>,
    id: i32,
    input: UpdatePatientInput,
) -> Result<crate::models::patient::Patient, AppError> {
    if let Some(name) = input.name.as_deref() {
        require_non_empty(name, "el nombre del paciente es requerido")?;
    }
    if let Some(species) = input.species.as_deref() {
        require_non_empty(species, "la especie es requerida")?;
    }
    if let Some(sex) = input.sex.as_deref() {
        require_in(sex, &["M", "F"], "el sexo debe ser M o F")?;
    }
    if let Some(weight) = input.weight {
        if weight <= 0.0 {
            return Err(AppError::Validation("el peso debe ser mayor a 0".into()));
        }
    }
    if let Some(birth) = input.birth_date.as_deref() {
        validate_date(birth)?;
    }

    state.require_session()?;
    let mut pooled = state.pool.acquire()?;
    patient_repo::update(pooled.conn(), id, &input, &state.actor())
}
