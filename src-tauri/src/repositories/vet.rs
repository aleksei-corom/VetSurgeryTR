use rsfbclient::prelude::*;
use rsfbclient::SimpleConnection;

use crate::error::AppError;
use crate::models::vet::{CreateVetInput, UpdateVetInput, Vet};
use crate::repositories::{next_id, with_tx};

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

/// Todos los veterinarios, incluidos inactivos (gestión de admins).
pub fn list_all(conn: &mut SimpleConnection) -> Result<Vec<Vet>, AppError> {
    let rows: Vec<VetRow> = conn
        .query(&format!("{VET_SELECT} ORDER BY FULL_NAME"), ())
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

/// Crea un veterinario y deja la alta en la bitácora (acción de admin).
pub fn create(
    conn: &mut SimpleConnection,
    input: &CreateVetInput,
    actor: &str,
) -> Result<Vet, AppError> {
    with_tx(conn, |conn| {
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

        let vet = get(conn, id)?
            .ok_or_else(|| AppError::Internal("Veterinario creado pero no recuperado".into()))?;

        crate::repositories::audit::log(
            conn,
            actor,
            "VETERINARIO",
            Some(id),
            None,
            "CREAR",
            Some(format!(
                "Alta de veterinario: {}{}",
                vet.full_name,
                vet.license.as_deref().map(|l| format!(" · T.P. {l}")).unwrap_or_default()
            )),
        )?;

        Ok(vet)
    })
}

/// Edita los datos de un veterinario (solo admins). Campos None = sin cambio;
/// `Some("")` limpia el dato (NULL). El nombre completo es obligatorio si viene.
/// Auditado con diff campo a campo (mismo estilo que pacientes).
pub fn update(
    conn: &mut SimpleConnection,
    vet_id: i32,
    input: &UpdateVetInput,
    actor: &str,
) -> Result<Vet, AppError> {
    let before = get(conn, vet_id)?
        .ok_or_else(|| AppError::NotFound("Veterinario no encontrado".into()))?;

    let full_name = match &input.full_name {
        Some(n) => {
            let n = n.trim();
            if n.is_empty() {
                return Err(AppError::Validation("el nombre completo es requerido".into()));
            }
            n.to_string()
        }
        None => before.full_name.clone(),
    };
    // Option<String> vacío → NULL (quitar el dato); None → dejar igual.
    let clean = |v: &Option<String>| -> Option<String> {
        v.as_ref()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
    };
    let license = if input.license.is_some() { clean(&input.license) } else { before.license.clone() };
    let specialty = if input.specialty.is_some() { clean(&input.specialty) } else { before.specialty.clone() };
    let phone = if input.phone.is_some() { clean(&input.phone) } else { before.phone.clone() };
    let email = if input.email.is_some() { clean(&input.email) } else { before.email.clone() };

    if full_name == before.full_name
        && license == before.license
        && specialty == before.specialty
        && phone == before.phone
        && email == before.email
    {
        return Err(AppError::Validation("No hay cambios por guardar".into()));
    }

    with_tx(conn, |conn| {
        conn.execute(
            "UPDATE VETS SET FULL_NAME = ?, LICENSE = ?, SPECIALTY = ?, PHONE = ?, EMAIL = ?,
             UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = ?",
            (&full_name, &license, &specialty, &phone, &email, &vet_id),
        )
        .map_err(AppError::from)?;

        let vet = get(conn, vet_id)?
            .ok_or_else(|| AppError::Internal("Veterinario editado pero no recuperado".into()))?;

        // Diff legible campo a campo (solo lo que cambió).
        let mut changes: Vec<String> = Vec::new();
        let cmp = |label: &str, a: &Option<String>, b: &Option<String>, changes: &mut Vec<String>| {
            if a != b {
                let fmt = |v: &Option<String>| v.clone().unwrap_or_else(|| "—".into());
                changes.push(format!("{}: {} → {}", label, fmt(a), fmt(b)));
            }
        };
        if full_name != before.full_name {
            changes.push(format!("Nombre: {} → {}", before.full_name, full_name));
        }
        cmp("T.P.", &before.license, &license, &mut changes);
        cmp("Especialidad", &before.specialty, &specialty, &mut changes);
        cmp("Teléfono", &before.phone, &phone, &mut changes);
        cmp("Correo", &before.email, &email, &mut changes);

        crate::repositories::audit::log(
            conn,
            actor,
            "VETERINARIO",
            Some(vet_id),
            None,
            "EDITAR",
            Some(format!("Editó a {}: {}", before.full_name, changes.join(" · "))),
        )?;
        Ok(vet)
    })
}

/// Activa/desactiva un veterinario (soft-delete: conserva historial quirúrgico).
/// Los inactivos dejan de aparecer al agendar cirugías. Auditado.
pub fn set_active(
    conn: &mut SimpleConnection,
    vet_id: i32,
    active: bool,
    actor: &str,
) -> Result<Vet, AppError> {
    let vet = get(conn, vet_id)?
        .ok_or_else(|| AppError::NotFound("Veterinario no encontrado".into()))?;
    if vet.active == active {
        return Err(AppError::Validation(if active {
            "El veterinario ya está activo".into()
        } else {
            "El veterinario ya está inactivo".into()
        }));
    }

    with_tx(conn, |conn| {
        conn.execute(
            "UPDATE VETS SET ACTIVE = ?, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = ?",
            (&active, &vet_id),
        )
        .map_err(AppError::from)?;

        crate::repositories::audit::log(
            conn,
            actor,
            "VETERINARIO",
            Some(vet_id),
            None,
            "EDITAR",
            Some(if active {
                format!("Activó al veterinario {}", vet.full_name)
            } else {
                format!("Desactivó al veterinario {} (conserva su historial quirúrgico)", vet.full_name)
            }),
        )?;
        // Devolver el estado NUEVO (el snapshot previo a la UPDATE está viejo).
        Ok(Vet { active, ..vet })
    })
}
