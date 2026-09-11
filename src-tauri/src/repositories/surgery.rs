use rsfbclient::prelude::*;
use rsfbclient::SimpleConnection;

use crate::error::AppError;
use crate::models::follow_up::FollowUp;
use crate::models::owner::OwnerRef;
use crate::models::surgery::{
    CreateSurgeryInput, MaterialItemRef, Surgery, SurgeryDetail, SurgeryMaterial,
    SurgeryPatientRef, UpdateSurgeryInput, UpsertMaterialInput,
};
use crate::models::vet::VetRef;
use crate::repositories::movement as movement_repo;
use crate::repositories::{fmt_qty, next_id, with_tx};

/// Columnas de una cirugía con veterinario unido y agregados de materiales.
/// El paciente (con propietario) se trae en una segunda consulta para no
/// exceder el límite de columnas por fila (26 en rsfbclient).
const SURGERY_SELECT: &str = "
    SELECT s.ID, s.CODE, s.PATIENT_ID, s.VET_ID, s.PROCEDURE_TYPE, s.BODY_REGION,
           s.LATERALITY, s.DESCRIPTION,
           LEFT(CAST(s.SCHEDULED_AT AS VARCHAR(60)), 19), s.DURATION_MIN,
           s.ANESTHESIA_TYPE, s.ASA_RISK, s.PREOPERATIVE_NOTES, s.POSTOPERATIVE_NOTES,
           s.ESTIMATED_COST, s.STATUS,
           LEFT(CAST(s.STARTED_AT AS VARCHAR(60)), 19),
           LEFT(CAST(s.COMPLETED_AT AS VARCHAR(60)), 19),
           LEFT(CAST(s.CREATED_AT AS VARCHAR(60)), 19),
           LEFT(CAST(s.UPDATED_AT AS VARCHAR(60)), 19),
           v.ID, v.FULL_NAME, v.SPECIALTY,
           (SELECT CAST(COUNT(*) AS INTEGER) FROM SURGERY_MATERIALS sm
             WHERE sm.SURGERY_ID = s.ID),
           (SELECT CAST(COALESCE(SUM(sm.QTY_USED * sm.UNIT_COST), 0) AS DOUBLE PRECISION)
              FROM SURGERY_MATERIALS sm WHERE sm.SURGERY_ID = s.ID)
    FROM SURGERIES s
    LEFT JOIN VETS v ON v.ID = s.VET_ID
    JOIN PATIENTS p ON p.ID = s.PATIENT_ID
    JOIN OWNERS o ON o.ID = p.OWNER_ID";

/// Paciente resumido con propietario (para anidar en la cirugía).
const PATIENT_REF_SELECT: &str = "
    SELECT p.ID, p.CODE, p.NAME, p.SPECIES, p.BREED, p.SEX, p.WEIGHT,
           CAST(p.BIRTH_DATE AS VARCHAR(10)),
           CAST(DATEDIFF(MONTH, p.BIRTH_DATE, CURRENT_TIMESTAMP) AS INTEGER),
           o.ID, o.FULL_NAME, o.PHONE, o.CITY
    FROM PATIENTS p
    JOIN OWNERS o ON o.ID = p.OWNER_ID";

/// Columnas de un material con su ítem de inventario unido.
const MATERIAL_SELECT: &str = "
    SELECT sm.ID, sm.SURGERY_ID, sm.ITEM_ID, sm.QTY_PLANNED, sm.QTY_USED, sm.UNIT_COST,
           sm.NOTES, i.ID, i.CODE, i.NAME, i.CATEGORY, i.ITEM_SIZE, i.UNIT,
           i.STOCK_QTY, i.MIN_STOCK
    FROM SURGERY_MATERIALS sm
    JOIN INVENTORY_ITEMS i ON i.ID = sm.ITEM_ID";

/// Columnas de un control postoperatorio.
const FOLLOW_UP_SELECT: &str = "
    SELECT f.ID, f.SURGERY_ID, LEFT(CAST(f.SCHEDULED_DATE AS VARCHAR(60)), 19),
           f.CONTROL_TYPE, f.NOTES, f.STATUS, LEFT(CAST(f.DONE_AT AS VARCHAR(60)), 19),
           LEFT(CAST(f.CREATED_AT AS VARCHAR(60)), 19)
    FROM FOLLOW_UPS f";

pub(crate) type SurgeryRow = (
    i32,            // id
    String,         // code
    i32,            // patient_id
    Option<i32>,    // vet_id
    String,         // procedure_type
    Option<String>, // body_region
    Option<String>, // laterality
    Option<String>, // description
    String,         // scheduled_at
    Option<i32>,    // duration_min
    Option<String>, // anesthesia_type
    Option<i32>,    // asa_risk
    Option<String>, // preoperative_notes
    Option<String>, // postoperative_notes
    Option<f64>,    // estimated_cost
    String,         // status
    Option<String>, // started_at
    Option<String>, // completed_at
    String,         // created_at
    String,         // updated_at
    Option<i32>,    // vet ref: id
    Option<String>, // vet ref: full_name
    Option<String>, // vet ref: specialty
    i32,            // materials_count
    f64,            // materials_cost
);

/// Resuelve el paciente anidado de una cirugía.
fn patient_ref(conn: &mut SimpleConnection, patient_id: i32) -> Result<SurgeryPatientRef, AppError> {
    let row: Option<(
        i32,
        String,
        String,
        String,
        Option<String>,
        String,
        Option<f64>,
        Option<String>,
        Option<i32>,
        i32,
        String,
        Option<String>,
        Option<String>,
    )> = conn
        .query_first(&format!("{PATIENT_REF_SELECT} WHERE p.ID = ?"), (&patient_id,))
        .map_err(AppError::from)?;

    let r = row
        .ok_or_else(|| AppError::Internal(format!("Paciente {patient_id} no encontrado")))?;
    Ok(SurgeryPatientRef {
        id: r.0,
        code: r.1,
        name: r.2,
        species: r.3,
        breed: r.4,
        sex: r.5,
        weight: r.6,
        birth_date: r.7,
        age_months: r.8,
        owner: OwnerRef {
            id: r.9,
            full_name: r.10,
            phone: r.11,
            city: r.12,
        },
    })
}

/// Construye la entidad Surgery a partir de la fila base + paciente anidado.
fn map_surgery(r: SurgeryRow, patient: SurgeryPatientRef) -> Surgery {
    Surgery {
        id: r.0,
        code: r.1,
        patient_id: r.2,
        vet_id: r.3,
        procedure_type: r.4,
        body_region: r.5,
        laterality: r.6,
        description: r.7,
        scheduled_at: r.8,
        duration_min: r.9,
        anesthesia_type: r.10,
        asa_risk: r.11,
        preoperative_notes: r.12,
        postoperative_notes: r.13,
        estimated_cost: r.14,
        status: r.15,
        started_at: r.16,
        completed_at: r.17,
        created_at: r.18,
        updated_at: r.19,
        vet: r.20.map(|vid| VetRef {
            id: vid,
            full_name: r.21.unwrap_or_default(),
            specialty: r.22,
        }),
        materials_count: r.23,
        materials_cost: r.24,
        patient,
    }
}

fn load_surgery_row(
    conn: &mut SimpleConnection,
    where_clause: &str,
    params: (&i32,),
) -> Result<Option<Surgery>, AppError> {
    let row: Option<SurgeryRow> = conn
        .query_first(&format!("{SURGERY_SELECT} {where_clause}"), params)
        .map_err(AppError::from)?;
    match row {
        Some(r) => {
            let patient = patient_ref(conn, r.2)?;
            Ok(Some(map_surgery(r, patient)))
        }
        None => Ok(None),
    }
}

pub fn get(conn: &mut SimpleConnection, id: i32) -> Result<Option<Surgery>, AppError> {
    load_surgery_row(conn, "WHERE s.ID = ?", (&id,))
}

pub fn exists(conn: &mut SimpleConnection, id: i32) -> Result<bool, AppError> {
    let row: Option<(i32,)> = conn
        .query_first("SELECT ID FROM SURGERIES WHERE ID = ?", (&id,))
        .map_err(AppError::from)?;
    Ok(row.is_some())
}

/// Ficha completa: cirugía + materiales + controles postoperatorios.
pub fn get_detail(conn: &mut SimpleConnection, id: i32) -> Result<Option<SurgeryDetail>, AppError> {
    let Some(surgery) = get(conn, id)? else {
        return Ok(None);
    };
    let materials = list_materials(conn, id)?;
    let follow_ups = list_follow_ups(conn, id)?;
    Ok(Some(SurgeryDetail {
        surgery,
        materials,
        follow_ups,
    }))
}

/// Agenda quirúrgica con filtros por estado, paciente y búsqueda global
/// (paciente, código, propietario o procedimiento), igual que la web.
pub fn list(
    conn: &mut SimpleConnection,
    status: Option<&str>,
    search: Option<&str>,
    patient_id: Option<i32>,
) -> Result<Vec<Surgery>, AppError> {
    let like = search
        .map(|s| format!("%{}%", s.trim()))
        .filter(|s| !s.trim_matches('%').is_empty());

    let rows: Vec<SurgeryRow> = conn
        .query(
            &format!(
                "{SURGERY_SELECT}
                 WHERE (? IS NULL OR s.STATUS = ?)
                   AND (? IS NULL OR s.PATIENT_ID = ?)
                   AND (? IS NULL
                        OR UPPER(p.NAME) LIKE UPPER(?)
                        OR UPPER(p.CODE) LIKE UPPER(?)
                        OR UPPER(o.FULL_NAME) LIKE UPPER(?)
                        OR UPPER(s.PROCEDURE_TYPE) LIKE UPPER(?)
                        OR UPPER(s.CODE) LIKE UPPER(?))
                 ORDER BY s.SCHEDULED_AT DESC, s.ID DESC"
            ),
            (
                &status, &status, &patient_id, &patient_id,
                &like, &like, &like, &like, &like, &like,
            ),
        )
        .map_err(AppError::from)?;

    rows.into_iter()
        .map(|r| {
            let patient = patient_ref(conn, r.2)?;
            Ok(map_surgery(r, patient))
        })
        .collect()
}

/// Próximas cirugías (dashboard): PROGRAMADA/EN_CURSO desde hoy.
pub fn list_upcoming(conn: &mut SimpleConnection, limit: i32) -> Result<Vec<Surgery>, AppError> {
    let rows: Vec<SurgeryRow> = conn
        .query(
            &format!(
                "{SURGERY_SELECT}
                 WHERE s.STATUS IN ('PROGRAMADA', 'EN_CURSO')
                   AND s.SCHEDULED_AT >= CAST(CURRENT_DATE AS TIMESTAMP)
                 ORDER BY s.SCHEDULED_AT ASC
                 ROWS {limit}"
            ),
            (),
        )
        .map_err(AppError::from)?;

    rows.into_iter()
        .map(|r| {
            let patient = patient_ref(conn, r.2)?;
            Ok(map_surgery(r, patient))
        })
        .collect()
}

/// Materiales de una cirugía (con stock actual del ítem).
pub fn list_materials(
    conn: &mut SimpleConnection,
    surgery_id: i32,
) -> Result<Vec<SurgeryMaterial>, AppError> {
    let rows: Vec<(
        i32,
        i32,
        i32,
        f64,
        Option<f64>,
        Option<f64>,
        Option<String>,
        i32,
        String,
        String,
        String,
        Option<String>,
        String,
        f64,
        f64,
    )> = conn
        .query(
            &format!("{MATERIAL_SELECT} WHERE sm.SURGERY_ID = ? ORDER BY sm.ID"),
            (&surgery_id,),
        )
        .map_err(AppError::from)?;

    Ok(rows
        .into_iter()
        .map(|r| SurgeryMaterial {
            id: r.0,
            surgery_id: r.1,
            item_id: r.2,
            qty_planned: r.3,
            qty_used: r.4,
            unit_cost: r.5,
            notes: r.6,
            item: MaterialItemRef {
                id: r.7,
                code: r.8,
                name: r.9,
                category: r.10,
                size: r.11,
                unit: r.12,
                stock_qty: r.13,
                min_stock: r.14,
            },
        })
        .collect())
}

/// Controles postoperatorios de una cirugía.
pub fn list_follow_ups(
    conn: &mut SimpleConnection,
    surgery_id: i32,
) -> Result<Vec<FollowUp>, AppError> {
    crate::repositories::follow_up::list_by_surgery(conn, surgery_id)
}

/// Valida la transición de estado (mapa idéntico al de la web):
/// PROGRAMADA→EN_CURSO/COMPLETADA/CANCELADA · EN_CURSO→COMPLETADA/CANCELADA.
pub fn transition_allowed(current: &str, new: &str) -> bool {
    matches!(
        (current, new),
        ("PROGRAMADA", "EN_CURSO")
            | ("PROGRAMADA", "COMPLETADA")
            | ("PROGRAMADA", "CANCELADA")
            | ("EN_CURSO", "COMPLETADA")
            | ("EN_CURSO", "CANCELADA")
    )
}

/// Programa una cirugía (código CIR-YYYY-NNNN por trigger) validando
/// paciente y veterinario, en transacción.
pub fn create(conn: &mut SimpleConnection, input: &CreateSurgeryInput) -> Result<SurgeryDetail, AppError> {
    let patient: Option<(i32,)> = conn
        .query_first("SELECT ID FROM PATIENTS WHERE ID = ?", (&input.patient_id,))
        .map_err(AppError::from)?;
    if patient.is_none() {
        return Err(AppError::Validation("Paciente no encontrado".into()));
    }
    if let Some(vet_id) = input.vet_id {
        if !crate::repositories::vet::exists(conn, vet_id)? {
            return Err(AppError::Validation("Veterinario no encontrado".into()));
        }
    }

    with_tx(conn, |conn| {
        let id = next_id(conn, "GEN_SURGERIES_ID")?;
        // CODE se omite: el trigger BI_SURGERIES genera CIR-YYYY-NNNN.
        conn.execute(
            "INSERT INTO SURGERIES
                (ID, PATIENT_ID, VET_ID, PROCEDURE_TYPE, BODY_REGION, LATERALITY,
                 DESCRIPTION, SCHEDULED_AT, DURATION_MIN, ANESTHESIA_TYPE, ASA_RISK,
                 PREOPERATIVE_NOTES, POSTOPERATIVE_NOTES, ESTIMATED_COST)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                &id,
                &input.patient_id,
                &input.vet_id,
                &input.procedure_type,
                &input.body_region,
                &input.laterality,
                &input.description,
                &input.scheduled_at,
                &input.duration_min,
                &input.anesthesia_type,
                &input.asa_risk,
                &input.preoperative_notes,
                &input.postoperative_notes,
                &input.estimated_cost,
            ),
        )
        .map_err(AppError::from)?;

        get_detail(conn, id)?
            .ok_or_else(|| AppError::Internal("Cirugía creada pero no recuperada".into()))
    })
}

/// Actualización dual (PATCH web):
///  a) transición de estado con STARTED_AT/COMPLETED_AT y consumo de
///     inventario al completar;
///  b) campos editables + sincronización de materials[].
/// Todo el flujo es atómico: si el consumo dejara stock negativo se aborta
/// con ROLLBACK (nada queda a medias).
pub fn update(
    conn: &mut SimpleConnection,
    id: i32,
    input: &UpdateSurgeryInput,
) -> Result<SurgeryDetail, AppError> {
    let current = get(conn, id)?
        .ok_or_else(|| AppError::NotFound(format!("Cirugía {id} no encontrada")))?;

    // ---- Validaciones previas (antes de tocar la BD) ----
    let new_status = input
        .status
        .as_deref()
        .filter(|s| *s != current.status)
        .map(str::to_string);

    if let Some(new) = &new_status {
        if !transition_allowed(&current.status, new) {
            return Err(AppError::Validation(format!(
                "Transición no permitida: {} → {}",
                current.status, new
            )));
        }
    }

    if input.materials.is_some() && current.status == "COMPLETADA" {
        return Err(AppError::Validation(
            "No se pueden modificar los materiales de una cirugía completada (el consumo ya fue registrado)".into(),
        ));
    }

    if let Some(vet_id) = input.vet_id {
        if !crate::repositories::vet::exists(conn, vet_id)? {
            return Err(AppError::Validation("Veterinario no encontrado".into()));
        }
    }

    // Sin cambios → devolver la ficha actual sin escribir.
    let has_changes = new_status.is_some()
        || input.materials.is_some()
        || input.procedure_type.is_some()
        || input.body_region.is_some()
        || input.laterality.is_some()
        || input.description.is_some()
        || input.scheduled_at.is_some()
        || input.duration_min.is_some()
        || input.anesthesia_type.is_some()
        || input.asa_risk.is_some()
        || input.preoperative_notes.is_some()
        || input.postoperative_notes.is_some()
        || input.estimated_cost.is_some()
        || input.vet_id.is_some();
    if !has_changes {
        return get_detail(conn, id)?
            .ok_or_else(|| AppError::Internal("Cirugía no recuperada".into()));
    }

    with_tx(conn, |conn| {
        // 1) Sincronizar materiales (upsert/delete sobre cirugía+ítem).
        if let Some(materials) = &input.materials {
            sync_materials(conn, id, materials)?;
        }

        // 2) Actualizar campos editables (fusionando con los actuales).
        let vet_id = input.vet_id.or(current.vet_id);
        let procedure_type = input.procedure_type.clone().unwrap_or(current.procedure_type);
        let body_region = input.body_region.clone().or(current.body_region);
        let laterality = input.laterality.clone().or(current.laterality);
        let description = input.description.clone().or(current.description);
        let scheduled_at = input.scheduled_at.clone().unwrap_or(current.scheduled_at);
        let duration_min = input.duration_min.or(current.duration_min);
        let anesthesia_type = input.anesthesia_type.clone().or(current.anesthesia_type);
        let asa_risk = input.asa_risk.or(current.asa_risk);
        let preoperative_notes = input.preoperative_notes.clone().or(current.preoperative_notes);
        let postoperative_notes = input.postoperative_notes.clone().or(current.postoperative_notes);
        let estimated_cost = input.estimated_cost.or(current.estimated_cost);

        conn.execute(
            "UPDATE SURGERIES
                SET VET_ID = ?, PROCEDURE_TYPE = ?, BODY_REGION = ?, LATERALITY = ?,
                    DESCRIPTION = ?, SCHEDULED_AT = ?, DURATION_MIN = ?,
                    ANESTHESIA_TYPE = ?, ASA_RISK = ?, PREOPERATIVE_NOTES = ?,
                    POSTOPERATIVE_NOTES = ?, ESTIMATED_COST = ?,
                    UPDATED_AT = CURRENT_TIMESTAMP
              WHERE ID = ?",
            (
                &vet_id, &procedure_type, &body_region, &laterality, &description,
                &scheduled_at, &duration_min, &anesthesia_type, &asa_risk,
                &preoperative_notes, &postoperative_notes, &estimated_cost, &id,
            ),
        )
        .map_err(AppError::from)?;

        // 3) Transición de estado: STARTED_AT al entrar en curso,
        //    COMPLETED_AT al completar.
        if let Some(new) = &new_status {
            conn.execute(
                "UPDATE SURGERIES
                    SET STATUS = ?,
                        STARTED_AT = CASE WHEN ? = 'EN_CURSO'
                                          THEN CURRENT_TIMESTAMP ELSE STARTED_AT END,
                        COMPLETED_AT = CASE WHEN ? = 'COMPLETADA'
                                            THEN CURRENT_TIMESTAMP ELSE COMPLETED_AT END,
                        UPDATED_AT = CURRENT_TIMESTAMP
                  WHERE ID = ?",
                (new, new, new, &id),
            )
            .map_err(AppError::from)?;

            // 4) Consumo de inventario AL COMPLETAR (una sola vez: solo se
            //    llega aquí desde PROGRAMADA/EN_CURSO).
            if new == "COMPLETADA" {
                consume_inventory(conn, id, &current.code)?;
            }
        }

        get_detail(conn, id)?
            .ok_or_else(|| AppError::Internal("Cirugía actualizada pero no recuperada".into()))
    })
}

/// Sincroniza los materiales de una cirugía con la lista provista: borra los
/// que ya no vienen y hace upsert del resto (clave cirugía+ítem).
fn sync_materials(
    conn: &mut SimpleConnection,
    surgery_id: i32,
    materials: &[UpsertMaterialInput],
) -> Result<(), AppError> {
    // IDs de ítem actuales.
    let current_ids: Vec<(i32,)> = conn
        .query(
            "SELECT ITEM_ID FROM SURGERY_MATERIALS WHERE SURGERY_ID = ?",
            (&surgery_id,),
        )
        .map_err(AppError::from)?;
    let keep: Vec<i32> = materials.iter().map(|m| m.item_id).collect();

    for (item_id,) in &current_ids {
        if !keep.contains(item_id) {
            conn.execute(
                "DELETE FROM SURGERY_MATERIALS WHERE SURGERY_ID = ? AND ITEM_ID = ?",
                (&surgery_id, item_id),
            )
            .map_err(AppError::from)?;
        }
    }

    for m in materials {
        upsert_material_row(conn, surgery_id, m)?;
    }
    Ok(())
}

/// Upsert de una fila de material (usa el costo unitario actual del ítem).
fn upsert_material_row(
    conn: &mut SimpleConnection,
    surgery_id: i32,
    m: &UpsertMaterialInput,
) -> Result<(), AppError> {
    let item: Option<(Option<f64>,)> = conn
        .query_first(
            "SELECT UNIT_COST FROM INVENTORY_ITEMS WHERE ID = ?",
            (&m.item_id,),
        )
        .map_err(AppError::from)?;
    let Some((unit_cost,)) = item else {
        return Err(AppError::Validation(format!(
            "Item de inventario no encontrado: {}",
            m.item_id
        )));
    };

    let existing: Option<(i32,)> = conn
        .query_first(
            "SELECT ID FROM SURGERY_MATERIALS WHERE SURGERY_ID = ? AND ITEM_ID = ?",
            (&surgery_id, &m.item_id),
        )
        .map_err(AppError::from)?;

    match existing {
        Some((material_id,)) => conn.execute(
            "UPDATE SURGERY_MATERIALS
                SET QTY_PLANNED = ?, QTY_USED = ?, NOTES = ?,
                    UNIT_COST = COALESCE(?, UNIT_COST), UPDATED_AT = CURRENT_TIMESTAMP
              WHERE ID = ?",
            (&m.qty_planned, &m.qty_used, &m.notes, &unit_cost, &material_id),
        ),
        None => {
            let material_id = next_id(conn, "GEN_SURGERY_MATERIALS_ID")?;
            conn.execute(
                "INSERT INTO SURGERY_MATERIALS
                    (ID, SURGERY_ID, ITEM_ID, QTY_PLANNED, QTY_USED, UNIT_COST, NOTES)
                 VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    &material_id,
                    &surgery_id,
                    &m.item_id,
                    &m.qty_planned,
                    &m.qty_used,
                    &unit_cost,
                    &m.notes,
                ),
            )
        }
    }
    .map_err(AppError::from)?;
    Ok(())
}

/// Añade o actualiza un material de la cirugía (POST /materials de la web).
/// Bloqueado si la cirugía ya está COMPLETADA.
pub fn upsert_material(
    conn: &mut SimpleConnection,
    surgery_id: i32,
    input: &UpsertMaterialInput,
) -> Result<SurgeryMaterial, AppError> {
    let status: Option<(String,)> = conn
        .query_first("SELECT STATUS FROM SURGERIES WHERE ID = ?", (&surgery_id,))
        .map_err(AppError::from)?;
    let (status,) = status
        .ok_or_else(|| AppError::NotFound(format!("Cirugía {surgery_id} no encontrada")))?;

    if status == "COMPLETADA" {
        return Err(AppError::Validation(
            "No se pueden modificar los materiales de una cirugía completada (el consumo ya fue registrado)".into(),
        ));
    }

    with_tx(conn, |conn| {
        upsert_material_row(conn, surgery_id, input)?;
        let row: Option<(i32,)> = conn
            .query_first(
                "SELECT ID FROM SURGERY_MATERIALS WHERE SURGERY_ID = ? AND ITEM_ID = ?",
                (&surgery_id, &input.item_id),
            )
            .map_err(AppError::from)?;
        let (material_id,) =
            row.ok_or_else(|| AppError::Internal("Material no recuperado".into()))?;
        list_materials(conn, surgery_id)?
            .into_iter()
            .find(|m| m.id == material_id)
            .ok_or_else(|| AppError::Internal("Material no recuperado".into()))
    })
}

/// Elimina un material de la cirugía. Bloqueado si está COMPLETADA.
pub fn remove_material(
    conn: &mut SimpleConnection,
    surgery_id: i32,
    material_id: i32,
) -> Result<(), AppError> {
    let status: Option<(String,)> = conn
        .query_first("SELECT STATUS FROM SURGERIES WHERE ID = ?", (&surgery_id,))
        .map_err(AppError::from)?;
    let (status,) = status
        .ok_or_else(|| AppError::NotFound(format!("Cirugía {surgery_id} no encontrada")))?;

    if status == "COMPLETADA" {
        return Err(AppError::Validation(
            "No se pueden eliminar materiales de una cirugía completada (el consumo ya fue registrado)".into(),
        ));
    }

    let row: Option<(i32,)> = conn
        .query_first(
            "SELECT ID FROM SURGERY_MATERIALS WHERE ID = ? AND SURGERY_ID = ?",
            (&material_id, &surgery_id),
        )
        .map_err(AppError::from)?;
    if row.is_none() {
        return Err(AppError::NotFound(
            "Material no encontrado en esta cirugía".into(),
        ));
    }

    conn.execute(
        "DELETE FROM SURGERY_MATERIALS WHERE ID = ? AND SURGERY_ID = ?",
        (&material_id, &surgery_id),
    )
    .map_err(AppError::from)?;
    Ok(())
}

/// Consumo de inventario al completar la cirugía: por cada material con
/// QTY_USED genera una SALIDA con snapshot STOCK_AFTER y motivo
/// "Consumo cirugía <código>". Primero valida TODO el stock disponible y
/// solo entonces descuenta (si algo falta, no se toca nada).
fn consume_inventory(
    conn: &mut SimpleConnection,
    surgery_id: i32,
    surgery_code: &str,
) -> Result<(), AppError> {
    let rows: Vec<(i32, Option<f64>, String, f64)> = conn
        .query(
            "SELECT sm.ITEM_ID, sm.QTY_USED, i.NAME, i.STOCK_QTY
             FROM SURGERY_MATERIALS sm
             JOIN INVENTORY_ITEMS i ON i.ID = sm.ITEM_ID
             WHERE sm.SURGERY_ID = ?",
            (&surgery_id,),
        )
        .map_err(AppError::from)?;

    // 1) Validación completa antes de descontar nada.
    for (item_id, qty_used, name, stock) in &rows {
        if let Some(used) = qty_used {
            if stock - used < 0.0 {
                return Err(AppError::Validation(format!(
                    "Stock insuficiente para {name}: disponible {}, requerido {}",
                    fmt_qty(*stock),
                    fmt_qty(*used)
                )));
            }
        }
        let _ = item_id;
    }

    // 2) Descuento + SALIDA por cada material consumido.
    let reason = Some(format!("Consumo cirugía {surgery_code}"));
    for (item_id, qty_used, _name, stock) in &rows {
        if let Some(used) = qty_used {
            let new_stock = stock - used;
            conn.execute(
                "UPDATE INVENTORY_ITEMS
                    SET STOCK_QTY = ?, UPDATED_AT = CURRENT_TIMESTAMP
                  WHERE ID = ?",
                (&new_stock, item_id),
            )
            .map_err(AppError::from)?;

            movement_repo::insert_raw(
                conn,
                *item_id,
                "SALIDA",
                *used,
                new_stock,
                None,
                &reason,
                &Some(surgery_id),
            )?;
        }
    }
    Ok(())
}
