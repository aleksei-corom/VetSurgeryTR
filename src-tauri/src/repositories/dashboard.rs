use rsfbclient::prelude::*;
use rsfbclient::SimpleConnection;

use chrono::Datelike;

use crate::error::AppError;
use crate::models::dashboard::{CategoryCount, DashboardData, DashboardStats, MonthCount};
use crate::repositories::{inventory as inventory_repo, surgery as surgery_repo};

fn count(conn: &mut SimpleConnection, sql: &str) -> Result<i32, AppError> {
    conn.query_first(sql, ())
        .map_err(AppError::from)?
        .map(|(c,): (i32,)| c)
        .ok_or_else(|| AppError::Internal("COUNT sin resultado".into()))
}

/// Métricas del panel de control con las mismas ventanas temporales que la
/// app web (completadas del mes actual, controles vencidos hasta hoy y
/// cirugías creadas de los últimos 6 meses).
pub fn get_dashboard(conn: &mut SimpleConnection) -> Result<DashboardData, AppError> {
    // ---- Contadores ----
    let patients_active = count(
        conn,
        "SELECT CAST(COUNT(*) AS INTEGER) FROM PATIENTS WHERE ACTIVE = TRUE",
    )?;
    let surgeries_scheduled = count(
        conn,
        "SELECT CAST(COUNT(*) AS INTEGER) FROM SURGERIES WHERE STATUS = 'PROGRAMADA'",
    )?;
    let surgeries_in_progress = count(
        conn,
        "SELECT CAST(COUNT(*) AS INTEGER) FROM SURGERIES WHERE STATUS = 'EN_CURSO'",
    )?;
    // Completadas del mes actual: desde la medianoche del día 1.
    let surgeries_completed_month = count(
        conn,
        "SELECT CAST(COUNT(*) AS INTEGER) FROM SURGERIES
         WHERE STATUS = 'COMPLETADA'
           AND COMPLETED_AT >= CAST(DATEADD((1 - EXTRACT(DAY FROM CURRENT_DATE)) DAY TO CURRENT_DATE) AS DATE)",
    )?;
    // Controles pendientes con fecha vencida (hasta el final de hoy).
    let follow_ups_due = count(
        conn,
        "SELECT CAST(COUNT(*) AS INTEGER) FROM FOLLOW_UPS
         WHERE STATUS = 'PENDIENTE'
           AND SCHEDULED_DATE < DATEADD(1 DAY TO CAST(CURRENT_DATE AS TIMESTAMP))",
    )?;
    let low_stock_count = count(
        conn,
        "SELECT CAST(COUNT(*) AS INTEGER) FROM INVENTORY_ITEMS
         WHERE ACTIVE = TRUE AND STOCK_QTY <= MIN_STOCK",
    )?;
    let inventory_value: f64 = conn
        .query_first(
            "SELECT CAST(COALESCE(SUM(STOCK_QTY * UNIT_COST), 0) AS DOUBLE PRECISION)
             FROM INVENTORY_ITEMS WHERE ACTIVE = TRUE",
            (),
        )
        .map_err(AppError::from)?
        .map(|(v,): (f64,)| v)
        .unwrap_or(0.0);

    // ---- Listas de apoyo ----
    let upcoming_surgeries = surgery_repo::list_upcoming(conn, 6)?;

    // Controles pendientes vencidos (máx. 6).
    let follow_ups_due_list = crate::repositories::follow_up::list_due(conn, 6)?;

    // Stock bajo (STOCK_QTY <= MIN_STOCK) ordenado por déficit ascendente,
    // máx. 8 — misma regla que la web.
    let mut low_stock_items = inventory_repo::list(conn, None, None, true)?;
    low_stock_items.sort_by(|a, b| {
        (a.stock_qty - a.min_stock)
            .partial_cmp(&(b.stock_qty - b.min_stock))
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    let low_stock_items: Vec<_> = low_stock_items.into_iter().take(8).collect();

    // ---- Cirugías por mes (últimos 6 meses, incluido el actual) ----
    // Claves YYYY-MM desde hoy hacia atrás.
    let now = chrono::Local::now();
    let mut months: Vec<String> = Vec::with_capacity(6);
    for back in (0..6).rev() {
        // mes actual - back
        let (year, month) = {
            let m = now.month0() as i64 - back;
            let y = now.year() as i64 + m.div_euclid(12);
            let mm = m.rem_euclid(12) + 1;
            (y, mm)
        };
        months.push(format!("{year:04}-{month:02}"));
    }

    let counts: Vec<(String, i32)> = conn
        .query(
            "SELECT CAST(EXTRACT(YEAR FROM s.CREATED_AT) AS VARCHAR(4)) || '-' ||
                    LPAD(TRIM(CAST(EXTRACT(MONTH FROM s.CREATED_AT) AS VARCHAR(3))), 2, '0') AS MES,
                    CAST(COUNT(*) AS INTEGER)
             FROM SURGERIES s
             WHERE s.CREATED_AT >= CAST(DATEADD((1 - EXTRACT(DAY FROM CURRENT_DATE)) DAY TO
                                      DATEADD(-5 MONTH TO CURRENT_DATE)) AS DATE)
             GROUP BY 1",
            (),
        )
        .map_err(AppError::from)?;

    let monthly_surgeries: Vec<MonthCount> = months
        .into_iter()
        .map(|m| MonthCount {
            count: counts
                .iter()
                .find(|(k, _)| *k == m)
                .map(|(_, c)| *c)
                .unwrap_or(0),
            month: m,
        })
        .collect();

    // ---- Ítems por categoría ----
    let rows: Vec<(String, i32)> = conn
        .query(
            "SELECT CATEGORY, CAST(COUNT(*) AS INTEGER)
             FROM INVENTORY_ITEMS WHERE ACTIVE = TRUE
             GROUP BY CATEGORY
             ORDER BY 2 DESC",
            (),
        )
        .map_err(AppError::from)?;
    let category_distribution = rows
        .into_iter()
        .map(|(category, count)| CategoryCount {
            category,
            count,
        })
        .collect();

    Ok(DashboardData {
        stats: DashboardStats {
            patients_active,
            surgeries_scheduled,
            surgeries_in_progress,
            surgeries_completed_month,
            low_stock_count,
            follow_ups_due,
            inventory_value,
        },
        upcoming_surgeries,
        low_stock_items,
        follow_ups_due_list,
        monthly_surgeries,
        category_distribution,
    })
}
