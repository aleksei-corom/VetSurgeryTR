use std::fs;
use std::path::PathBuf;

use chrono::Local;
use tauri::State;

use crate::error::AppError;
use crate::repositories::audit as audit_repo;
use crate::repositories::inventory as inventory_repo;
use crate::repositories::movement as movement_repo;
use crate::state::AppState;

/// Exporta a CSV con separador `;` y BOM UTF-8: al abrirlo con doble clic,
/// Excel en configuración regional es-CO lo parsea y muestra los acentos
/// correctamente, sin asistente de importación.
const CSV_SEP: char = ';';

/// Escapa un valor según RFC 4180 adaptado a `;`: si contiene el separador,
/// comillas o saltos de línea, se envuelve en comillas doblando las internas.
fn csv_escape(value: &str) -> String {
    if value.contains(CSV_SEP) || value.contains('"') || value.contains('\n') || value.contains('\r') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

/// Une una fila de valores (cualquier cosa con Display) en una línea CSV.
macro_rules! csv_row {
    ($($v:expr),+ $(,)?) => {{
        [$(
            csv_escape(&format!("{}", $v)),
        )+]
        .join(&CSV_SEP.to_string())
    }};
}

/// Muestra la carpeta elegida por el usuario, validando que exista.
fn picked_dir(dir: PathBuf) -> Result<PathBuf, AppError> {
    if !dir.is_dir() {
        return Err(AppError::Validation(
            "La carpeta seleccionada ya no existe".into(),
        ));
    }
    Ok(dir)
}

/// Escribe el contenido CSV y devuelve la ruta final.
fn write_csv(dir: &std::path::Path, file_name: &str, content: String) -> Result<PathBuf, AppError> {
    let path = dir.join(file_name);
    fs::write(&path, content).map_err(|e| {
        AppError::db(format!("No se pudo escribir {} ({e})", path.display()))
    })?;
    Ok(path)
}

fn stamp_now() -> String {
    Local::now().format("%Y%m%d-%H%M%S").to_string()
}

/// Inventario completo (activos e inactivos, orden categoría + nombre) con
/// costo y valor en stock — la forma más útil para conciliar físicamente.
#[tauri::command]
pub async fn export_inventory_csv(
    state: State<'_, AppState>,
    dir: PathBuf,
) -> Result<String, AppError> {
    // Exporta datos clínicos/comerciales a una carpeta elegida: exige sesión.
    state.require_session()?;
    let dir = picked_dir(dir)?;
    let mut pooled = state.pool.acquire()?;
    let items = inventory_repo::list(pooled.conn(), None, None, false)?;

    let mut out = String::with_capacity(4096 + items.len() * 96);
    out.push('\u{FEFF}'); // BOM UTF-8 para Excel
    out.push_str(&csv_row!(
        "Código", "Nombre", "Categoría", "Tipo/Modelo", "Material", "Tamaño", "Unidad",
        "Stock", "Stock mínimo", "Costo unitario", "Valor en stock", "Proveedor", "Lote",
        "Vencimiento", "Ubicación", "Activo", "Notas"
    ));
    out.push('\n');

    for i in &items {
        out.push_str(&csv_row!(
            i.code, i.name, i.category,
            i.sub_type.as_deref().unwrap_or(""),
            i.material.as_deref().unwrap_or(""),
            i.size.as_deref().unwrap_or(""),
            i.unit,
            crate::repositories::fmt_qty(i.stock_qty),
            crate::repositories::fmt_qty(i.min_stock),
            i.unit_cost.map(|c| c.to_string()).unwrap_or_default(),
            crate::repositories::fmt_qty(i.stock_qty * i.unit_cost.unwrap_or(0.0)),
            i.supplier.as_deref().unwrap_or(""),
            i.lot_number.as_deref().unwrap_or(""),
            i.expires_at.as_deref().unwrap_or(""),
            i.location.as_deref().unwrap_or(""),
            if i.active { "Sí" } else { "No" },
            i.notes.as_deref().unwrap_or(""),
        ));
        out.push('\n');
    }

    let path = write_csv(&dir, &format!("inventario-{}.csv", stamp_now()), out)?;
    Ok(path.display().to_string())
}

/// Kardex completo (hasta 5.000 movimientos recientes) con ítem, cirugía de
/// origen, motivo y snapshot del stock resultante.
#[tauri::command]
pub async fn export_kardex_csv(
    state: State<'_, AppState>,
    dir: PathBuf,
) -> Result<String, AppError> {
    state.require_session()?;
    let dir = picked_dir(dir)?;
    let mut pooled = state.pool.acquire()?;
    let movements = movement_repo::list_all(pooled.conn(), None, None, None, 5_000)?;

    let mut out = String::with_capacity(4096 + movements.len() * 96);
    out.push('\u{FEFF}');
    out.push_str(&csv_row!(
        "Fecha", "Tipo", "Ítem (código)", "Ítem", "Cantidad", "Unidad",
        "Stock resultante", "Costo unitario", "Motivo", "Cirugía", "Paciente"
    ));
    out.push('\n');

    for m in &movements {
        out.push_str(&csv_row!(
            m.created_at, m.movement_type,
            m.item.as_ref().map(|i| i.code.as_str()).unwrap_or(""),
            m.item.as_ref().map(|i| i.name.as_str()).unwrap_or(""),
            crate::repositories::fmt_qty(m.qty),
            m.item.as_ref().map(|i| i.unit.as_str()).unwrap_or(""),
            crate::repositories::fmt_qty(m.stock_after),
            m.unit_cost.map(|c| c.to_string()).unwrap_or_default(),
            m.reason.as_deref().unwrap_or(""),
            m.surgery_code.as_deref().unwrap_or(""),
            m.patient_name.as_deref().unwrap_or(""),
        ));
        out.push('\n');
    }

    let path = write_csv(&dir, &format!("kardex-{}.csv", stamp_now()), out)?;
    Ok(path.display().to_string())
}

/// Bitácora de auditoría completa (hasta 5.000 entradas recientes, más
/// antiguas → más nuevas para lectura cronológica): incluye movimientos de
/// inventario, cirugías, pacientes, usuarios, veterinarios, configuración y
/// las impresiones de documentos clínicos (DOCUMENTO/IMPRIMIR).
#[tauri::command]
pub async fn export_audit_csv(state: State<'_, AppState>, dir: PathBuf) -> Result<String, AppError> {
    state.require_session()?;
    let dir = picked_dir(dir)?;
    let mut pooled = state.pool.acquire()?;
    // Sin filtros: el export es la foto completa; los filtros son tarea de la
    // vista. Máx. 5.000 como el kardex para no degenerar en archivos enormes.
    let entries = audit_repo::list(pooled.conn(), None, None, None, 5_000)?;

    let mut out = String::with_capacity(4096 + entries.len() * 128);
    out.push('\u{FEFF}');
    out.push_str(&csv_row!(
        "Fecha", "Módulo", "Acción", "Entidad (código)", "Entidad (ID)", "Detalle", "Usuario"
    ));
    out.push('\n');

    // list() viene DESC (más recientes primero); el CSV se entrega en orden
    // cronológico para lectura directa en Excel.
    for a in entries.iter().rev() {
        out.push_str(&csv_row!(
            a.created_at,
            a.entity_type,
            a.action,
            a.entity_code.as_deref().unwrap_or(""),
            a.entity_id.map(|id| id.to_string()).unwrap_or_default(),
            a.detail.as_deref().unwrap_or(""),
            a.actor,
        ));
        out.push('\n');
    }

    let path = write_csv(&dir, &format!("bitacora-{}.csv", stamp_now()), out)?;
    Ok(path.display().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valores_simples_no_se_envuelven() {
        assert_eq!(csv_escape("INV-0001"), "INV-0001");
        assert_eq!(csv_escape("Platina LCP"), "Platina LCP");
        assert_eq!(csv_escape(""), "");
    }

    #[test]
    fn valores_con_separador_comillas_o_saltos() {
        assert_eq!(csv_escape("a;b"), "\"a;b\"");
        assert_eq!(csv_escape("dijo \"hola\""), "\"dijo \"\"hola\"\"\"");
        assert_eq!(csv_escape("línea1\nlínea2"), "\"línea1\nlínea2\"");
        assert_eq!(csv_escape("otra\r"), "\"otra\r\"");
    }

    #[test]
    fn fila_compuesta_usa_punto_y_coma() {
        let row = csv_row!("INV-0001", "Platina", 6, "Sí");
        assert_eq!(row, "INV-0001;Platina;6;Sí");
    }
}
