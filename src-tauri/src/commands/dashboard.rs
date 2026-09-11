use tauri::State;

use crate::error::AppError;
use crate::models::dashboard::DashboardData;
use crate::repositories::dashboard as dashboard_repo;
use crate::state::AppState;

/// Métricas del panel de control: 7 KPIs, próximas cirugías, alertas de
/// stock, controles vencidos, cirugías por mes (últimos 6) e ítems por
/// categoría — mismas reglas que GET /api/dashboard de la web.
#[tauri::command]
pub fn get_dashboard(state: State<'_, AppState>) -> Result<DashboardData, AppError> {
    let mut pooled = state.pool.acquire()?;
    dashboard_repo::get_dashboard(pooled.conn())
}
