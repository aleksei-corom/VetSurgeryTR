use rsfbclient::prelude::*;
use rsfbclient::SimpleConnection;

use crate::error::AppError;
use crate::models::audit::AuditEntry;
use crate::models::patient::UpdatePatientInput;
use crate::repositories::{fmt_qty, next_id};

const AUDIT_SELECT: &str = "
    SELECT a.ID, a.ENTITY_TYPE, a.ENTITY_ID, a.ENTITY_CODE, a.ACTION, a.DETAIL,
           a.ACTOR, LEFT(CAST(a.CREATED_AT AS VARCHAR(60)), 19)
    FROM AUDIT_LOG a";

pub(crate) type AuditRow = (
    i32,            // id
    String,         // entity_type
    Option<i32>,    // entity_id
    Option<String>, // entity_code
    String,         // action
    Option<String>, // detail
    String,         // actor
    String,         // created_at
);

fn map_entry(r: AuditRow) -> AuditEntry {
    AuditEntry {
        id: r.0,
        entity_type: r.1,
        entity_id: r.2,
        entity_code: r.3,
        action: r.4,
        detail: r.5,
        actor: r.6,
        created_at: r.7,
    }
}

/// Inserta una entrada de auditoría. DEBE llamarse dentro de la transacción
/// de la operación que se audita: si la operación falla y hace ROLLBACK, la
/// entrada desaparece con ella (solo queda registrado lo que ocurrió).
///
/// `actor` es el nombre visible del usuario autenticado (sesión local); la
/// acción queda atribuida a él en la bitácora.
pub(crate) fn log(
    conn: &mut SimpleConnection,
    actor: &str,
    entity_type: &str,
    entity_id: Option<i32>,
    entity_code: Option<&str>,
    action: &str,
    detail: Option<String>,
) -> Result<(), AppError> {
    let id = next_id(conn, "GEN_AUDIT_LOG_ID")?;
    conn.execute(
        "INSERT INTO AUDIT_LOG (ID, ENTITY_TYPE, ENTITY_ID, ENTITY_CODE, ACTION, DETAIL, ACTOR)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            &id,
            &entity_type,
            &entity_id,
            &entity_code,
            &action,
            &detail,
            &actor,
        ),
    )
    .map_err(AppError::from)?;
    Ok(())
}

/// Registra la impresión de un documento clínico (entidad DOCUMENTO, acción
/// IMPRIMIR). Pública porque la usan el comando `log_document_print` y el
/// smoke test; internamente delega en `log`.
pub fn log_document_print(
    conn: &mut SimpleConnection,
    actor: &str,
    entity_id: Option<i32>,
    entity_code: &str,
    document: &str,
) -> Result<(), AppError> {
    log(
        conn,
        actor,
        "DOCUMENTO",
        entity_id,
        Some(entity_code),
        "IMPRIMIR",
        Some(format!("Documento impreso: {document}")),
    )
}

/// Conteo de impresiones por tipo de documento para una entidad de origen
/// (CIR-2026-0001 o PAC-2026-0001): cuántas veces salió cada documento y
/// cuándo fue la última. Alimenta la fila de impresiones del detalle de
/// cirugía. Solo imprime tipos con count > 0 (orden descendente).
pub fn print_counts_for(
    conn: &mut SimpleConnection,
    entity_code: &str,
) -> Result<Vec<(String, i32, Option<String>)>, AppError> {
    let rows: Vec<(String, i32, Option<String>)> = conn
        .query(
            "SELECT REPLACE(a.DETAIL, 'Documento impreso: ', ''),
                    CAST(COUNT(*) AS INTEGER),
                    MAX(LEFT(CAST(a.CREATED_AT AS VARCHAR(60)), 19))
             FROM AUDIT_LOG a
             WHERE a.ENTITY_TYPE = 'DOCUMENTO'
               AND a.ACTION = 'IMPRIMIR'
               AND a.ENTITY_CODE = ?
             GROUP BY 1
             ORDER BY 2 DESC",
            (&entity_code,),
        )
        .map_err(AppError::from)?;
    Ok(rows)
}

/// Total de impresiones por código de entidad con el prefijo dado (p. ej.
/// «PAC-» para pacientes): una sola consulta agrupada para alimentar la
/// columna «Impresiones» del listado — en vez de N consultas individuales.
/// Solo devuelve códigos con al menos una impresión.
pub fn print_totals_by_prefix(
    conn: &mut SimpleConnection,
    prefix: &str,
) -> Result<Vec<(String, i32)>, AppError> {
    let like = format!("{prefix}%");
    let rows: Vec<(String, i32)> = conn
        .query(
            "SELECT a.ENTITY_CODE, CAST(COUNT(*) AS INTEGER)
             FROM AUDIT_LOG a
             WHERE a.ENTITY_TYPE = 'DOCUMENTO'
               AND a.ACTION = 'IMPRIMIR'
               AND a.ENTITY_CODE LIKE ?
             GROUP BY a.ENTITY_CODE",
            (&like,),
        )
        .map_err(AppError::from)?;
    Ok(rows)
}

/// Bitácora con filtros opcionales: entidad, acción y búsqueda en código y
/// detalle. Más recientes primero.
pub fn list(
    conn: &mut SimpleConnection,
    entity_type: Option<&str>,
    action: Option<&str>,
    search: Option<&str>,
    limit: i32,
) -> Result<Vec<AuditEntry>, AppError> {
    let like = search
        .map(|s| format!("%{}%", s.trim()))
        .filter(|s| !s.trim_matches('%').is_empty());

    let rows: Vec<AuditRow> = conn
        .query(
            &format!(
                "{AUDIT_SELECT}
                 WHERE (? IS NULL OR a.ENTITY_TYPE = ?)
                   AND (? IS NULL OR a.ACTION = ?)
                   AND (? IS NULL
                        OR UPPER(COALESCE(a.ENTITY_CODE, '')) LIKE UPPER(?)
                        OR UPPER(COALESCE(a.DETAIL, '')) LIKE UPPER(?))
                 ORDER BY a.CREATED_AT DESC, a.ID DESC
                 ROWS {limit}"
            ),
            (
                &entity_type, &entity_type,
                &action, &action,
                &like, &like, &like,
            ),
        )
        .map_err(AppError::from)?;
    Ok(rows.into_iter().map(map_entry).collect())
}

/// Diff legible campo a campo entre el paciente actual y el input de
/// actualización. `None` = «no tocar» (no se reporta).
pub fn patient_diff(current: &crate::models::patient::Patient, input: &UpdatePatientInput) -> Option<String> {
    let mut changes: Vec<String> = Vec::new();

    if let Some(v) = &input.name {
        if *v != current.name {
            changes.push(format!("Nombre: «{}» → «{}»", current.name, v));
        }
    }
    if let Some(v) = &input.species {
        if *v != current.species {
            changes.push(format!("Especie: {} → {}", current.species, v));
        }
    }
    if let Some(v) = input.sex.as_deref() {
        if v != current.sex {
            changes.push(format!("Sexo: {} → {}", current.sex, v));
        }
    }
    if let Some(v) = input.weight {
        if current.weight != Some(v) {
            let from = current.weight.map(|w| format!("{} kg", fmt_qty(w))).unwrap_or_else(|| "—".into());
            changes.push(format!("Peso: {} → {} kg", from, fmt_qty(v)));
        }
    }
    if let Some(v) = input.active {
        if v != current.active {
            changes.push(format!(
                "Estado: {} → {}",
                if current.active { "Activo" } else { "Inactivo" },
                if v { "Activo" } else { "Inactivo" }
            ));
        }
    }
    if let Some(v) = &input.microchip {
        if current.microchip.as_deref() != Some(v.as_str()) {
            changes.push(format!("Microchip: {} → {}", current.microchip.as_deref().unwrap_or("—"), v));
        }
    }
    if let Some(v) = input.neutered {
        if v != current.neutered {
            changes.push(format!("Esterilizado: {} → {}", if current.neutered { "Sí" } else { "No" }, if v { "Sí" } else { "No" }));
        }
    }

    if changes.is_empty() {
        None
    } else {
        Some(changes.join(" · "))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base_patient() -> crate::models::patient::Patient {
        crate::models::patient::Patient {
            id: 1,
            code: "PAC-2026-0001".into(),
            owner_id: 1,
            name: "Rocky".into(),
            species: "Canino".into(),
            breed: None,
            sex: "M".into(),
            birth_date: None,
            weight: Some(28.5),
            neutered: false,
            color: None,
            microchip: None,
            active: true,
            notes: None,
            created_at: "2026-01-01 00:00:00".into(),
            owner_name: "Dueño".into(),
            owner_phone: None,
            age_months: Some(36),
            surgery_count: 0,
            last_surgery_at: None,
        }
    }

    #[test]
    fn diff_vacio_cuando_no_hay_cambios_reales() {
        let p = base_patient();
        // Campos iguales → sin diff.
        assert!(patient_diff(&p, &UpdatePatientInput { name: Some("Rocky".into()), ..Default::default() }).is_none());
        // Sin campos → sin diff.
        assert!(patient_diff(&p, &UpdatePatientInput::default()).is_none());
    }

    #[test]
    fn diff_reporta_cambios_legibles() {
        let p = base_patient();
        let diff = patient_diff(
            &p,
            &UpdatePatientInput {
                name: Some("Rocky II".into()),
                weight: Some(30.0),
                active: Some(false),
                ..Default::default()
            },
        )
        .unwrap();
        assert!(diff.contains("Nombre: «Rocky» → «Rocky II»"));
        assert!(diff.contains("Peso: 28.5 kg → 30 kg"));
        assert!(diff.contains("Estado: Activo → Inactivo"));
    }

    #[test]
    fn diff_formatea_peso_sin_decimales_colgantes() {
        let mut p = base_patient();
        p.weight = Some(28.0);
        let diff = patient_diff(&p, &UpdatePatientInput { weight: Some(30.0), ..Default::default() }).unwrap();
        // fmt_qty: 28 → "28" (no "28.0").
        assert!(diff.contains("Peso: 28 kg → 30 kg"));
    }
}
