use serde::{Deserialize, Serialize};

use crate::models::owner::CreateOwnerInput;

/// Paciente con datos del propietario unidos (listado y ficha).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Patient {
    pub id: i32,
    /// PAC-YYYY-NNNN
    pub code: String,
    pub owner_id: i32,
    pub name: String,
    /// Canino | Felino | Equino | ...
    pub species: String,
    pub breed: Option<String>,
    /// M | F
    pub sex: String,
    /// YYYY-MM-DD
    pub birth_date: Option<String>,
    /// kg — crítico para dosificación e implantes
    pub weight: Option<f64>,
    pub neutered: bool,
    pub color: Option<String>,
    pub microchip: Option<String>,
    pub active: bool,
    pub notes: Option<String>,
    /// YYYY-MM-DD HH:MM:SS
    pub created_at: String,
    pub owner_name: String,
    pub owner_phone: Option<String>,
    /// Edad calculada en meses (solo lectura, calculada en SQL).
    pub age_months: Option<i32>,
    pub surgery_count: i32,
    /// YYYY-MM-DD HH:MM:SS
    pub last_surgery_at: Option<String>,
}

/// Cirugía resumida dentro de la ficha del paciente (historial quirúrgico).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PatientSurgerySummary {
    pub id: i32,
    pub code: String,
    pub procedure_type: String,
    /// YYYY-MM-DD HH:MM:SS
    pub scheduled_at: String,
    /// PROGRAMADA | EN_CURSO | COMPLETADA | CANCELADA
    pub status: String,
    pub body_region: Option<String>,
    pub laterality: Option<String>,
    pub vet: Option<PatientSurgeryVetRef>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PatientSurgeryVetRef {
    pub id: i32,
    pub full_name: String,
}

/// Ficha completa: paciente + historial quirúrgico.
#[derive(Debug, Clone, Serialize)]
pub struct PatientDetail {
    #[serde(flatten)]
    pub patient: Patient,
    pub surgeries: Vec<PatientSurgerySummary>,
}

/// Datos para crear un paciente. El propietario se reutiliza por documento
/// (upsert) si ya existe, igual que en la app web.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePatientInput {
    pub owner: CreateOwnerInput,
    pub name: String,
    pub species: String,
    pub breed: Option<String>,
    /// M | F
    pub sex: String,
    /// YYYY-MM-DD
    pub birth_date: Option<String>,
    pub weight: Option<f64>,
    pub neutered: Option<bool>,
    pub color: Option<String>,
    pub microchip: Option<String>,
    pub notes: Option<String>,
}

/// Actualización parcial de paciente (None = dejar sin cambio). A diferencia
/// del PATCH web (que distingue null de ausente), aquí None significa "no
/// tocar el campo"; para limpiar un campo opcional se envía cadena vacía.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePatientInput {
    pub name: Option<String>,
    pub species: Option<String>,
    pub breed: Option<String>,
    pub sex: Option<String>,
    pub birth_date: Option<String>,
    pub weight: Option<f64>,
    pub neutered: Option<bool>,
    pub color: Option<String>,
    pub microchip: Option<String>,
    pub active: Option<bool>,
    pub notes: Option<String>,
}
