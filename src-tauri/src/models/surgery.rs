use serde::{Deserialize, Serialize};

use crate::models::owner::OwnerRef;
use crate::models::vet::VetRef;

/// Ítem resumido dentro de un material de cirugía (con stock para decidir
/// si se puede consumir).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaterialItemRef {
    pub id: i32,
    pub code: String,
    pub name: String,
    pub category: String,
    pub size: Option<String>,
    pub unit: String,
    pub stock_qty: f64,
    pub min_stock: f64,
}

/// Material planificado/consumido por una cirugía.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SurgeryMaterial {
    pub id: i32,
    pub surgery_id: i32,
    pub item_id: i32,
    pub qty_planned: f64,
    /// Se registra al completar la cirugía (dispara la SALIDA de inventario).
    pub qty_used: Option<f64>,
    /// Snapshot del costo unitario
    pub unit_cost: Option<f64>,
    pub notes: Option<String>,
    pub item: MaterialItemRef,
}

/// Datos para añadir/actualizar un material de la cirugía (upsert sobre la
/// clave cirugía+ítem).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertMaterialInput {
    pub item_id: i32,
    /// > 0
    pub qty_planned: f64,
    pub qty_used: Option<f64>,
    pub notes: Option<String>,
}

/// Paciente resumido dentro de una cirugía (agenda y detalle).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SurgeryPatientRef {
    pub id: i32,
    pub code: String,
    pub name: String,
    pub species: String,
    pub breed: Option<String>,
    pub sex: String,
    /// kg
    pub weight: Option<f64>,
    /// YYYY-MM-DD
    pub birth_date: Option<String>,
    pub age_months: Option<i32>,
    pub owner: OwnerRef,
}

/// Cirugía ortopédica con paciente y veterinario unidos.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Surgery {
    pub id: i32,
    /// CIR-YYYY-NNNN
    pub code: String,
    pub patient_id: i32,
    pub vet_id: Option<i32>,
    /// TPLO | TTA | Reparación de fractura | ...
    pub procedure_type: String,
    /// Fémur distal, Tibia proximal...
    pub body_region: Option<String>,
    /// Izquierda | Derecha | Bilateral | No aplica
    pub laterality: Option<String>,
    pub description: Option<String>,
    /// Diagnóstico presuntivo (antes/durante la cirugía: motivo quirúrgico).
    pub presumptive_diagnosis: Option<String>,
    /// Diagnóstico definitivo (hallazgo confirmado, postoperatorio).
    pub definitive_diagnosis: Option<String>,
    /// YYYY-MM-DD HH:MM:SS
    pub scheduled_at: String,
    /// Duración quirúrgica estimada (minutos)
    pub duration_min: Option<i32>,
    pub anesthesia_type: Option<String>,
    /// ASA I–V (1-5)
    pub asa_risk: Option<i32>,
    pub preoperative_notes: Option<String>,
    pub postoperative_notes: Option<String>,
    /// COP
    pub estimated_cost: Option<f64>,
    /// PROGRAMADA | EN_CURSO | COMPLETADA | CANCELADA
    pub status: String,
    /// Se fija al pasar a EN_CURSO. YYYY-MM-DD HH:MM:SS
    pub started_at: Option<String>,
    /// Se fija al pasar a COMPLETADA. YYYY-MM-DD HH:MM:SS
    pub completed_at: Option<String>,
    /// YYYY-MM-DD HH:MM:SS
    pub created_at: String,
    /// YYYY-MM-DD HH:MM:SS
    pub updated_at: String,
    pub patient: SurgeryPatientRef,
    pub vet: Option<VetRef>,
    pub materials_count: i32,
    /// Σ qtyUsed × unitCost de los materiales
    pub materials_cost: f64,
}

/// Ficha completa de la cirugía: base + materiales + controles postoperatorios.
#[derive(Debug, Clone, Serialize)]
pub struct SurgeryDetail {
    #[serde(flatten)]
    pub surgery: Surgery,
    pub materials: Vec<SurgeryMaterial>,
    pub follow_ups: Vec<crate::models::follow_up::FollowUp>,
}

/// Datos para programar una cirugía.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSurgeryInput {
    pub patient_id: i32,
    pub vet_id: Option<i32>,
    pub procedure_type: String,
    pub body_region: Option<String>,
    pub laterality: Option<String>,
    pub description: Option<String>,
    pub presumptive_diagnosis: Option<String>,
    /// YYYY-MM-DD HH:MM:SS (acepta también YYYY-MM-DD)
    pub scheduled_at: String,
    pub duration_min: Option<i32>,
    pub anesthesia_type: Option<String>,
    pub asa_risk: Option<i32>,
    pub preoperative_notes: Option<String>,
    pub postoperative_notes: Option<String>,
    pub estimated_cost: Option<f64>,
}

/// Actualización de cirugía. Cubre los DOS usos del PATCH web:
///  a) `status`: transición validada; al pasar a COMPLETADA se consume el
///     inventario de los materiales con qtyUsed (SALIDA transaccional).
///  b) Campos editables + sincronización opcional de `materials`
///     (upsert/delete sobre la clave cirugía+ítem).
///
/// Nota: a diferencia del PATCH web (que distingue null de ausente), aquí
/// None significa "no tocar el campo".
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSurgeryInput {
    pub status: Option<String>,
    pub procedure_type: Option<String>,
    pub body_region: Option<String>,
    pub laterality: Option<String>,
    pub description: Option<String>,
    pub presumptive_diagnosis: Option<String>,
    pub definitive_diagnosis: Option<String>,
    pub scheduled_at: Option<String>,
    pub duration_min: Option<i32>,
    pub anesthesia_type: Option<String>,
    pub asa_risk: Option<i32>,
    pub preoperative_notes: Option<String>,
    pub postoperative_notes: Option<String>,
    pub estimated_cost: Option<f64>,
    pub vet_id: Option<i32>,
    /// Sincronización completa de materiales (upsert + borrado de ausentes).
    pub materials: Option<Vec<UpsertMaterialInput>>,
}
