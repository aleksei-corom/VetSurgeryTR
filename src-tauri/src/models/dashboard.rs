use serde::Serialize;

use crate::models::follow_up::FollowUpDueItem;
use crate::models::inventory::InventoryItem;
use crate::models::surgery::Surgery;

/// KPIs del panel de control (idénticos a los de la app web).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardStats {
    pub patients_active: i32,
    pub surgeries_scheduled: i32,
    pub surgeries_in_progress: i32,
    pub surgeries_completed_month: i32,
    pub low_stock_count: i32,
    pub follow_ups_due: i32,
    /// COP: Σ stockQty × unitCost de los ítems activos
    pub inventory_value: f64,
}

/// Cirugías creadas por mes: YYYY-MM.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthCount {
    pub month: String,
    pub count: i32,
}

/// Ítems de inventario por categoría.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryCount {
    pub category: String,
    pub count: i32,
}

/// Payload completo del dashboard (stats + listas de apoyo).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardData {
    pub stats: DashboardStats,
    /// Próximas cirugías PROGRAMADA/EN_CURSO desde hoy (máx. 6).
    pub upcoming_surgeries: Vec<Surgery>,
    /// Ítems con stock <= mínimo, ordenados por déficit (máx. 8).
    pub low_stock_items: Vec<InventoryItem>,
    /// Controles PENDIENTE con fecha vencida (máx. 6).
    pub follow_ups_due_list: Vec<FollowUpDueItem>,
    /// Cirugías creadas en los últimos 6 meses (incluido el actual).
    pub monthly_surgeries: Vec<MonthCount>,
    /// Ítems activos agrupados por categoría (orden descendente).
    pub category_distribution: Vec<CategoryCount>,
}

/// Estado del arranque de Firebird (banner de configuración en la UI).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbStatus {
    pub ok: bool,
    pub init_error: Option<String>,
    pub db_path: String,
    pub fbclient_path: String,
    pub schema_version: i32,
}
