use rsfbclient::prelude::*;
use rsfbclient::SimpleConnection;

use crate::error::AppError;
use crate::models::vet::{CreateVetInput, Vet};
use crate::repositories::next_id;

/// Columnas de un veterinario.
const VET_SELECT: &str = "
    SELECT ID, FULL_NAME, LICENSE, SPECIALTY, PHONE, EMAIL, ACTIVE,
           LEFT(CAST(CREATED_AT AS VARCHAR(60)), 19)
    FROM VETS";

pub(crate) type VetRow = (
    i32,            // id
    String,         // full_name
    Option<String>, // license
    Option<String>, // specialty
    Option<String>, // phone
    Option<String>, // email
    bool,           // active
    String,         // created_at
);

pub(crate) fn map_vet(r: VetRow) -> Vet {
    Vet {
        id: r.0,
        full_name: r.1,
        license: r.2,
        specialty: r.3,
        phone: r.4,
        email: r.5,
        active: r.6,
        created_at: r.7,
    }
}

/// Veterinarios activos (para asignar a cirugías).
pub fn list(conn: &mut SimpleConnection) -> Result<Vec<Vet>, AppError> {
    let rows: Vec<VetRow> = conn
        .query(
            &format!("{VET_SELECT} WHERE ACTIVE = TRUE ORDER BY FULL_NAME"),
            (),
        )
        .map_err(AppError::from)?;
    Ok(rows.into_iter().map(map_vet).collect())
}

pub fn get(conn: &mut SimpleConnection, id: i32) -> Result<Option<Vet>, AppError> {
    let row: Option<VetRow> = conn
        .query_first(&format!("{VET_SELECT} WHERE ID = ?"), (&id,))
        .map_err(AppError::from)?;
    Ok(row.map(map_vet))
}

/// Existencia de un veterinario (validación al crear/actualizar cirugías).
pub fn exists(conn: &mut SimpleConnection, id: i32) -> Result<bool, AppError> {
    let row: Option<(i32,)> = conn
        .query_first("SELECT ID FROM VETS WHERE ID = ?", (&id,))
        .map_err(AppError::from)?;
    Ok(row.is_some())
}

pub fn create(conn: &mut SimpleConnection, input: &CreateVetInput) -> Result<Vet, AppError> {
    let id = next_id(conn, "GEN_VETS_ID")?;
    conn.execute(
        "INSERT INTO VETS (ID, FULL_NAME, LICENSE, SPECIALTY, PHONE, EMAIL)
         VALUES (?, ?, ?, ?, ?, ?)",
        (
            &id,
            &input.full_name,
            &input.license,
            &input.specialty,
            &input.phone,
            &input.email,
        ),
    )
    .map_err(AppError::from)?;

    get(conn, id)?.ok_or_else(|| AppError::Internal("Veterinario creado pero no recuperado".into()))
}
