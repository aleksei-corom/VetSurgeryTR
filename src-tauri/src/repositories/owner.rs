use rsfbclient::prelude::*;
use rsfbclient::SimpleConnection;

use crate::error::AppError;
use crate::models::owner::{CreateOwnerInput, Owner};
use crate::repositories::next_id;

/// Columnas de un propietario.
const OWNER_SELECT: &str = "
    SELECT ID, DOCUMENT_TYPE, DOCUMENT_NUMBER, FULL_NAME, PHONE, EMAIL,
           ADDRESS, CITY, NOTES, LEFT(CAST(CREATED_AT AS VARCHAR(60)), 19)
    FROM OWNERS";

pub(crate) type OwnerRow = (
    i32,            // id
    String,         // document_type
    String,         // document_number
    String,         // full_name
    Option<String>, // phone
    Option<String>, // email
    Option<String>, // address
    Option<String>, // city
    Option<String>, // notes
    String,         // created_at
);

pub(crate) fn map_owner(r: OwnerRow) -> Owner {
    Owner {
        id: r.0,
        document_type: r.1,
        document_number: r.2,
        full_name: r.3,
        phone: r.4,
        email: r.5,
        address: r.6,
        city: r.7,
        notes: r.8,
        created_at: r.9,
    }
}

/// Listado de propietarios con filtro por nombre, documento, teléfono o ciudad.
pub fn list(conn: &mut SimpleConnection, search: Option<&str>) -> Result<Vec<Owner>, AppError> {
    let like = search
        .map(|s| format!("%{}%", s.trim()))
        .filter(|s| !s.trim_matches('%').is_empty());

    let rows: Vec<OwnerRow> = conn
        .query(
            &format!(
                "{OWNER_SELECT}
                 WHERE (? IS NULL
                        OR UPPER(FULL_NAME) LIKE UPPER(?)
                        OR DOCUMENT_NUMBER LIKE ?
                        OR UPPER(COALESCE(PHONE, '')) LIKE UPPER(?)
                        OR UPPER(COALESCE(CITY, '')) LIKE UPPER(?))
                 ORDER BY FULL_NAME"
            ),
            (&like, &like, &like, &like, &like),
        )
        .map_err(AppError::from)?;

    Ok(rows.into_iter().map(map_owner).collect())
}

pub fn get(conn: &mut SimpleConnection, id: i32) -> Result<Option<Owner>, AppError> {
    let row: Option<OwnerRow> = conn
        .query_first(&format!("{OWNER_SELECT} WHERE ID = ?"), (&id,))
        .map_err(AppError::from)?;
    Ok(row.map(map_owner))
}

/// Busca un propietario por su documento único (tipo + número).
pub fn find_by_document(
    conn: &mut SimpleConnection,
    document_type: &str,
    document_number: &str,
) -> Result<Option<Owner>, AppError> {
    let row: Option<OwnerRow> = conn
        .query_first(
            &format!("{OWNER_SELECT} WHERE DOCUMENT_TYPE = ? AND DOCUMENT_NUMBER = ?"),
            (document_type, document_number),
        )
        .map_err(AppError::from)?;
    Ok(row.map(map_owner))
}

/// Crea un propietario validando la unicidad de documento (400-equivalente
/// de la web: "Ya existe un propietario con ese documento").
pub fn create(conn: &mut SimpleConnection, input: &CreateOwnerInput) -> Result<Owner, AppError> {
    if find_by_document(conn, &input.document_type, &input.document_number)?.is_some() {
        return Err(AppError::Validation(
            "Ya existe un propietario con ese documento".into(),
        ));
    }

    let id = next_id(conn, "GEN_OWNERS_ID")?;
    conn.execute(
        "INSERT INTO OWNERS
            (ID, DOCUMENT_TYPE, DOCUMENT_NUMBER, FULL_NAME, PHONE, EMAIL, ADDRESS, CITY, NOTES)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            &id,
            &input.document_type,
            &input.document_number,
            &input.full_name,
            &input.phone,
            &input.email,
            &input.address,
            &input.city,
            &input.notes,
        ),
    )
    .map_err(AppError::from)?;

    get(conn, id)?.ok_or_else(|| AppError::Internal("Propietario creado pero no recuperado".into()))
}

/// Upsert del propietario usado al crear pacientes (misma semántica que
/// POST /api/patients de la web): si el documento existe se actualizan el
/// nombre y los datos de contacto provistos; si no, se crea.
/// Devuelve el ID del propietario.
pub fn find_or_create(conn: &mut SimpleConnection, input: &CreateOwnerInput) -> Result<i32, AppError> {
    if let Some(existing) = find_by_document(conn, &input.document_type, &input.document_number)? {
        // Actualiza el nombre siempre y los contactos que vengan provistos.
        let phone = input.phone.clone().or(existing.phone);
        let email = input.email.clone().or(existing.email);
        let address = input.address.clone().or(existing.address);
        let city = input.city.clone().or(existing.city);
        conn.execute(
            "UPDATE OWNERS
                SET FULL_NAME = ?, PHONE = ?, EMAIL = ?, ADDRESS = ?, CITY = ?,
                    UPDATED_AT = CURRENT_TIMESTAMP
              WHERE ID = ?",
            (
                &input.full_name,
                &phone,
                &email,
                &address,
                &city,
                &existing.id,
            ),
        )
        .map_err(AppError::from)?;
        return Ok(existing.id);
    }

    let id = next_id(conn, "GEN_OWNERS_ID")?;
    conn.execute(
        "INSERT INTO OWNERS
            (ID, DOCUMENT_TYPE, DOCUMENT_NUMBER, FULL_NAME, PHONE, EMAIL, ADDRESS, CITY, NOTES)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            &id,
            &input.document_type,
            &input.document_number,
            &input.full_name,
            &input.phone,
            &input.email,
            &input.address,
            &input.city,
            &input.notes,
        ),
    )
    .map_err(AppError::from)?;
    Ok(id)
}
