use rsfbclient::prelude::*;
use rsfbclient::SimpleConnection;

use crate::error::AppError;
use crate::models::follow_up::{
    CreateFollowUpInput, FollowUp, FollowUpDueItem, FollowUpPatientRef, FollowUpSurgeryRef,
    UpdateFollowUpInput,
};
use crate::repositories::next_id;

/// Columnas de un control postoperatorio (ver también FOLLOW_UP_SELECT en
/// repositories/surgery.rs, que mantiene la misma forma).
const FOLLOW_UP_SELECT: &str = "
    SELECT f.ID, f.SURGERY_ID, LEFT(CAST(f.SCHEDULED_DATE AS VARCHAR(60)), 19),
           f.CONTROL_TYPE, f.NOTES, f.STATUS, LEFT(CAST(f.DONE_AT AS VARCHAR(60)), 19),
           LEFT(CAST(f.CREATED_AT AS VARCHAR(60)), 19)
    FROM FOLLOW_UPS f";

pub(crate) type FollowUpRow = (
    i32,            // id
    i32,            // surgery_id
    String,         // scheduled_date
    String,         // type
    Option<String>, // notes
    String,         // status
    Option<String>, // done_at
    String,         // created_at
);

pub(crate) fn map_follow_up(r: FollowUpRow) -> FollowUp {
    FollowUp {
        id: r.0,
        surgery_id: r.1,
        scheduled_date: r.2,
        followup_type: r.3,
        notes: r.4,
        status: r.5,
        done_at: r.6,
        created_at: r.7,
    }
}

/// Controles de una cirugía ordenados por fecha.
pub fn list_by_surgery(
    conn: &mut SimpleConnection,
    surgery_id: i32,
) -> Result<Vec<FollowUp>, AppError> {
    let rows: Vec<FollowUpRow> = conn
        .query(
            &format!(
                "{FOLLOW_UP_SELECT}
                 WHERE f.SURGERY_ID = ?
                 ORDER BY f.SCHEDULED_DATE ASC"
            ),
            (&surgery_id,),
        )
        .map_err(AppError::from)?;
    Ok(rows.into_iter().map(map_follow_up).collect())
}

fn get(conn: &mut SimpleConnection, id: i32) -> Result<Option<FollowUp>, AppError> {
    let row: Option<FollowUpRow> = conn
        .query_first(&format!("{FOLLOW_UP_SELECT} WHERE f.ID = ?"), (&id,))
        .map_err(AppError::from)?;
    Ok(row.map(map_follow_up))
}

/// Agenda un control postoperatorio (estado inicial PENDIENTE).
pub fn create(
    conn: &mut SimpleConnection,
    surgery_id: i32,
    input: &CreateFollowUpInput,
) -> Result<FollowUp, AppError> {
    let surgery: Option<(i32,)> = conn
        .query_first("SELECT ID FROM SURGERIES WHERE ID = ?", (&surgery_id,))
        .map_err(AppError::from)?;
    if surgery.is_none() {
        return Err(AppError::NotFound("Cirugía no encontrada".into()));
    }

    let id = next_id(conn, "GEN_FOLLOW_UPS_ID")?;
    // STATUS toma el DEFAULT 'PENDIENTE' de la columna.
    conn.execute(
        "INSERT INTO FOLLOW_UPS (ID, SURGERY_ID, SCHEDULED_DATE, CONTROL_TYPE, NOTES)
         VALUES (?, ?, ?, ?, ?)",
        (
            &id,
            &surgery_id,
            &input.scheduled_date,
            &input.followup_type,
            &input.notes,
        ),
    )
    .map_err(AppError::from)?;

    get(conn, id)?.ok_or_else(|| AppError::Internal("Control creado pero no recuperado".into()))
}

/// Cambia el estado de un control; al pasar a CUMPLIDO se fija DONE_AT.
pub fn update(
    conn: &mut SimpleConnection,
    surgery_id: i32,
    follow_up_id: i32,
    input: &UpdateFollowUpInput,
) -> Result<FollowUp, AppError> {
    let surgery: Option<(i32,)> = conn
        .query_first("SELECT ID FROM SURGERIES WHERE ID = ?", (&surgery_id,))
        .map_err(AppError::from)?;
    if surgery.is_none() {
        return Err(AppError::NotFound("Cirugía no encontrada".into()));
    }

    let current = get(conn, follow_up_id)?;
    let Some(current) = current else {
        return Err(AppError::NotFound(
            "Control postoperatorio no encontrado en esta cirugía".into(),
        ));
    };
    if current.surgery_id != surgery_id {
        return Err(AppError::NotFound(
            "Control postoperatorio no encontrado en esta cirugía".into(),
        ));
    }

    let notes = input.notes.clone().or(current.notes);

    // Flag entero en vez de comparar ? contra el literal 'CUMPLIDO' (8
    // chars): Firebird inferiría VARCHAR(8) y rechazaría 'PENDIENTE' (9)
    // con "string right truncation".
    let done_flag: i32 = if input.status == "CUMPLIDO" { 1 } else { 0 };

    conn.execute(
        "UPDATE FOLLOW_UPS
            SET STATUS = ?, NOTES = ?,
                DONE_AT = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE DONE_AT END
          WHERE ID = ?",
        (&input.status, &notes, &done_flag, &follow_up_id),
    )
    .map_err(AppError::from)?;

    get(conn, follow_up_id)?
        .ok_or_else(|| AppError::Internal("Control actualizado pero no recuperado".into()))
}

/// Fila plana de controles vencidos (rsfbclient solo extrae tuplas planas).
type FollowUpDueRow = (
    i32,
    i32,
    String,
    String,
    Option<String>,
    String,
    Option<String>,
    String,
    String,
    String,
    String,
    String,
);

/// Controles PENDIENTE vencidos (fecha <= hoy) con su cirugía y paciente
/// (lista del dashboard). Máx. `limit`.
pub fn list_due(
    conn: &mut SimpleConnection,
    limit: i32,
) -> Result<Vec<FollowUpDueItem>, AppError> {
    let rows: Vec<FollowUpDueRow> = conn
        .query(
            &format!(
                "SELECT f.ID, f.SURGERY_ID, LEFT(CAST(f.SCHEDULED_DATE AS VARCHAR(60)), 19),
                        f.CONTROL_TYPE, f.NOTES, f.STATUS, LEFT(CAST(f.DONE_AT AS VARCHAR(60)), 19),
                        LEFT(CAST(f.CREATED_AT AS VARCHAR(60)), 19),
                        s.CODE, s.PROCEDURE_TYPE, p.NAME, p.SPECIES
                 FROM FOLLOW_UPS f
                 JOIN SURGERIES s ON s.ID = f.SURGERY_ID
                 JOIN PATIENTS p ON p.ID = s.PATIENT_ID
                 WHERE f.STATUS = 'PENDIENTE'
                   AND f.SCHEDULED_DATE < DATEADD(1 DAY TO CAST(CURRENT_DATE AS TIMESTAMP))
                 ORDER BY f.SCHEDULED_DATE ASC
                 ROWS {limit}"
            ),
            (),
        )
        .map_err(AppError::from)?;

    Ok(rows
        .into_iter()
        .map(|r| FollowUpDueItem {
            follow_up: FollowUp {
                id: r.0,
                surgery_id: r.1,
                scheduled_date: r.2,
                followup_type: r.3,
                notes: r.4,
                status: r.5,
                done_at: r.6,
                created_at: r.7,
            },
            surgery: FollowUpSurgeryRef {
                code: r.8,
                procedure_type: r.9,
                patient: FollowUpPatientRef {
                    name: r.10,
                    species: r.11,
                },
            },
        })
        .collect())
}
