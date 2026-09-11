use serde::{Deserialize, Serialize};

/// Control postoperatorio (radiografía de control, curación, retiro de
/// puntos/implantes...).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FollowUp {
    pub id: i32,
    pub surgery_id: i32,
    /// YYYY-MM-DD HH:MM:SS
    pub scheduled_date: String,
    /// CONTROL_RADIOGRAFICO | CURACION | RETIRO_PUNTOS | EVALUACION | RETIRO_IMPLANTES
    #[serde(rename = "type")]
    pub followup_type: String,
    pub notes: Option<String>,
    /// PENDIENTE | CUMPLIDO | PERDIDO
    pub status: String,
    /// Se fija al pasar a CUMPLIDO. YYYY-MM-DD HH:MM:SS
    pub done_at: Option<String>,
    /// YYYY-MM-DD HH:MM:SS
    pub created_at: String,
}

/// Datos para agendar un control.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateFollowUpInput {
    /// YYYY-MM-DD (acepta también YYYY-MM-DD HH:MM:SS)
    pub scheduled_date: String,
    #[serde(rename = "type")]
    pub followup_type: String,
    pub notes: Option<String>,
}

/// Cambio de estado de un control (PENDIENTE | CUMPLIDO | PERDIDO). Al pasar
/// a CUMPLIDO se fija DONE_AT.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateFollowUpInput {
    pub status: String,
    pub notes: Option<String>,
}

/// Cirugía resumida dentro de un control vencido (dashboard).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FollowUpSurgeryRef {
    pub code: String,
    pub procedure_type: String,
    pub patient: FollowUpPatientRef,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FollowUpPatientRef {
    pub name: String,
    pub species: String,
}

/// Control vencido/pendiente con su cirugía (lista del dashboard).
#[derive(Debug, Clone, Serialize)]
pub struct FollowUpDueItem {
    #[serde(flatten)]
    pub follow_up: FollowUp,
    pub surgery: FollowUpSurgeryRef,
}
