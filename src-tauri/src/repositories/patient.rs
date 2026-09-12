use rsfbclient::prelude::*;
use rsfbclient::SimpleConnection;

use crate::error::AppError;
use crate::models::patient::{
    CreatePatientInput, Patient, PatientDetail, PatientSurgerySummary, UpdatePatientInput,
};
use crate::repositories::{next_id, owner as owner_repo, with_tx};

/// Columnas de un paciente con propietario unido, conteo de cirugías y
/// última cirugía (subconsultas correlacionadas).
const PATIENT_SELECT: &str = "
    SELECT p.ID, p.CODE, p.OWNER_ID, p.NAME, p.SPECIES, p.BREED, p.SEX,
           CAST(p.BIRTH_DATE AS VARCHAR(10)), p.WEIGHT, p.NEUTERED, p.COLOR,
           p.MICROCHIP, p.ACTIVE, p.NOTES,
           LEFT(CAST(p.CREATED_AT AS VARCHAR(60)), 19),
           o.FULL_NAME, o.PHONE,
           CAST(DATEDIFF(MONTH, p.BIRTH_DATE, CURRENT_TIMESTAMP) AS INTEGER),
           (SELECT CAST(COUNT(*) AS INTEGER) FROM SURGERIES sc
             WHERE sc.PATIENT_ID = p.ID),
           (SELECT LEFT(CAST(MAX(sc.SCHEDULED_AT) AS VARCHAR(60)), 19) FROM SURGERIES sc
             WHERE sc.PATIENT_ID = p.ID)
    FROM PATIENTS p
    JOIN OWNERS o ON o.ID = p.OWNER_ID";

pub(crate) type PatientRow = (
    i32,            // id
    String,         // code
    i32,            // owner_id
    String,         // name
    String,         // species
    Option<String>, // breed
    String,         // sex
    Option<String>, // birth_date
    Option<f64>,    // weight
    bool,           // neutered
    Option<String>, // color
    Option<String>, // microchip
    bool,           // active
    Option<String>, // notes
    String,         // created_at
    String,         // owner_name
    Option<String>, // owner_phone
    Option<i32>,    // age_months
    i32,            // surgery_count
    Option<String>, // last_surgery_at
);

pub(crate) fn map_patient(r: PatientRow) -> Patient {
    Patient {
        id: r.0,
        code: r.1,
        owner_id: r.2,
        name: r.3,
        species: r.4,
        breed: r.5,
        sex: r.6,
        birth_date: r.7,
        weight: r.8,
        neutered: r.9,
        color: r.10,
        microchip: r.11,
        active: r.12,
        notes: r.13,
        created_at: r.14,
        owner_name: r.15,
        owner_phone: r.16,
        age_months: r.17,
        surgery_count: r.18,
        last_surgery_at: r.19,
    }
}

/// Listado con filtros de búsqueda (nombre/código/propietario/microchip),
/// especie y estado activo (misma semántica que GET /api/patients).
pub fn list(
    conn: &mut SimpleConnection,
    search: Option<&str>,
    species: Option<&str>,
    active: Option<bool>,
) -> Result<Vec<Patient>, AppError> {
    let like = search
        .map(|s| format!("%{}%", s.trim()))
        .filter(|s| !s.trim_matches('%').is_empty());

    let rows: Vec<PatientRow> = conn
        .query(
            &format!(
                "{PATIENT_SELECT}
                 WHERE (? IS NULL
                        OR UPPER(p.NAME) LIKE UPPER(?)
                        OR UPPER(p.CODE) LIKE UPPER(?)
                        OR UPPER(o.FULL_NAME) LIKE UPPER(?)
                        OR p.MICROCHIP LIKE ?)
                   AND (? IS NULL OR p.SPECIES = ?)
                   AND (? IS NULL OR p.ACTIVE = ?)
                 ORDER BY p.CREATED_AT DESC, p.ID DESC"
            ),
            (&like, &like, &like, &like, &like, &species, &species, &active, &active),
        )
        .map_err(AppError::from)?;

    Ok(rows.into_iter().map(map_patient).collect())
}

pub fn get(conn: &mut SimpleConnection, id: i32) -> Result<Option<Patient>, AppError> {
    let row: Option<PatientRow> = conn
        .query_first(&format!("{PATIENT_SELECT} WHERE p.ID = ?"), (&id,))
        .map_err(AppError::from)?;
    Ok(row.map(map_patient))
}

/// Ficha completa: paciente + historial quirúrgico resumido.
pub fn get_detail(conn: &mut SimpleConnection, id: i32) -> Result<Option<PatientDetail>, AppError> {
    let Some(patient) = get(conn, id)? else {
        return Ok(None);
    };

/// Fila del historial quirúrgico dentro de la ficha del paciente:
/// (id, código, procedimiento, fecha, estado, región, lateralidad, vet_id, vet_nombre).
type PatientSurgeryRow = (
    i32,
    String,
    String,
    String,
    String,
    Option<String>,
    Option<String>,
    Option<i32>,
    Option<String>,
);

let rows: Vec<PatientSurgeryRow> = conn
        .query(
            "SELECT s.ID, s.CODE, s.PROCEDURE_TYPE,
                    LEFT(CAST(s.SCHEDULED_AT AS VARCHAR(60)), 19),
                    s.STATUS, s.BODY_REGION, s.LATERALITY, v.ID, v.FULL_NAME
             FROM SURGERIES s
             LEFT JOIN VETS v ON v.ID = s.VET_ID
             WHERE s.PATIENT_ID = ?
             ORDER BY s.SCHEDULED_AT DESC",
            (&id,),
        )
        .map_err(AppError::from)?;

    let surgeries = rows
        .into_iter()
        .map(|r| PatientSurgerySummary {
            id: r.0,
            code: r.1,
            procedure_type: r.2,
            scheduled_at: r.3,
            status: r.4,
            body_region: r.5,
            laterality: r.6,
            vet: r.7.map(|vid| crate::models::patient::PatientSurgeryVetRef {
                id: vid,
                full_name: r.8.unwrap_or_default(),
            }),
        })
        .collect();

    Ok(Some(PatientDetail {
        patient,
        surgeries,
    }))
}

/// Crea un paciente (código PAC-YYYY-NNNN por trigger) reutilizando el
/// propietario por documento. Todo en una transacción.
pub fn create(
    conn: &mut SimpleConnection,
    input: &CreatePatientInput,
    actor: &str,
) -> Result<Patient, AppError> {
    with_tx(conn, |conn| {
        // Unicidad de microchip con mensaje amable (la BD también la exige).
        if let Some(chip) = input.microchip.as_deref().filter(|c| !c.trim().is_empty()) {
            let dup: Option<(i32,)> = conn
                .query_first("SELECT ID FROM PATIENTS WHERE MICROCHIP = ?", (chip,))
                .map_err(AppError::from)?;
            if dup.is_some() {
                return Err(AppError::Validation(
                    "Ya existe un paciente con ese microchip".into(),
                ));
            }
        }

        let owner_id = owner_repo::find_or_create(conn, &input.owner)?;
        let id = next_id(conn, "GEN_PATIENTS_ID")?;

        // CODE se omite: el trigger BI_PATIENTS genera PAC-YYYY-NNNN.
        let neutered = input.neutered.unwrap_or(false);
        conn.execute(
            "INSERT INTO PATIENTS
                (ID, OWNER_ID, NAME, SPECIES, BREED, SEX, BIRTH_DATE, WEIGHT,
                 NEUTERED, COLOR, MICROCHIP, NOTES)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                &id,
                &owner_id,
                &input.name,
                &input.species,
                &input.breed,
                &input.sex,
                &input.birth_date,
                &input.weight,
                &neutered,
                &input.color,
                &input.microchip,
                &input.notes,
            ),
        )
        .map_err(AppError::from)?;

        // Bitácora: alta de paciente (misma transacción).
        let created = get(conn, id)?
            .ok_or_else(|| AppError::Internal("Paciente creado pero no recuperado".into()))?;
        crate::repositories::audit::log(
            conn,
            actor,
            "PACIENTE",
            Some(id),
            Some(&created.code),
            "CREAR",
            Some(format!(
                "Alta de paciente: {} ({}) · propietario {}",
                created.name, created.species,
                input.owner.full_name
            )),
        )?;
        Ok(created)
    })
}

/// Actualización parcial (None = dejar sin cambio). Se fusiona con el valor
/// actual y se escribe la fila completa.
pub fn update(
    conn: &mut SimpleConnection,
    id: i32,
    input: &UpdatePatientInput,
    actor: &str,
) -> Result<Patient, AppError> {
    let current = get(conn, id)?
        .ok_or_else(|| AppError::NotFound(format!("Paciente {id} no encontrado")))?;

    // Diff para la bitácora ANTES de fusionar (solo campos realmente cambiados).
    let audit_detail = crate::repositories::audit::patient_diff(&current, input);

    let name = input.name.clone().unwrap_or(current.name);
    let species = input.species.clone().unwrap_or(current.species);
    let breed = input.breed.clone().or(current.breed);
    let sex = input.sex.clone().unwrap_or(current.sex);
    let birth_date = input.birth_date.clone().or(current.birth_date);
    let weight = input.weight.or(current.weight);
    let neutered = input.neutered.unwrap_or(current.neutered);
    let color = input.color.clone().or(current.color);
    let microchip = input.microchip.clone().or(current.microchip);
    let active = input.active.unwrap_or(current.active);
    let notes = input.notes.clone().or(current.notes);

    conn.execute(
        "UPDATE PATIENTS
            SET NAME = ?, SPECIES = ?, BREED = ?, SEX = ?, BIRTH_DATE = ?,
                WEIGHT = ?, NEUTERED = ?, COLOR = ?, MICROCHIP = ?, ACTIVE = ?,
                NOTES = ?, UPDATED_AT = CURRENT_TIMESTAMP
          WHERE ID = ?",
        (
            &name, &species, &breed, &sex, &birth_date, &weight, &neutered,
            &color, &microchip, &active, &notes, &id,
        ),
    )
    .map_err(AppError::from)?;

    let updated = get(conn, id)?
        .ok_or_else(|| AppError::Internal("Paciente actualizado pero no recuperado".into()))?;

    // Auditoría: solo si hubo cambios reales (misma transacción del UPDATE).
    if let Some(detail) = audit_detail {
        crate::repositories::audit::log(conn, actor, "PACIENTE", Some(id), Some(&current.code), "EDITAR", Some(detail))?;
    }

    Ok(updated)
}
