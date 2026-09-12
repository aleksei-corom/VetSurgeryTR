use rsfbclient::prelude::*;
use rsfbclient::SimpleConnection;

use crate::error::AppError;
use crate::models::clinic::{ClinicSettings, UpdateClinicSettingsInput};
use crate::repositories::with_tx;

const SELECT_FIELDS: &str = "CLINIC_NAME, TAX_ID, ADDRESS, PHONE, EMAIL, LICENSE, \
                             LOGO_DATA_URL, CAST(UPDATED_AT AS VARCHAR(60))";

type SettingsRow = (
    Option<String>, // clinic_name
    Option<String>, // tax_id
    Option<String>, // address
    Option<String>, // phone
    Option<String>, // email
    Option<String>, // license
    Option<String>, // logo_data_url
    Option<String>, // updated_at
);

fn map_row(r: SettingsRow) -> ClinicSettings {
    ClinicSettings {
        clinic_name: clean(r.0),
        tax_id: clean(r.1),
        address: clean(r.2),
        phone: clean(r.3),
        email: clean(r.4),
        license: clean(r.5),
        logo_data_url: r.6,
        updated_at: r.7.map(|s| s.chars().take(19).collect()),
    }
}

/// Normaliza espacios y convierte cadenas vacías en NULL (consistente con el
/// resto de repositorios).
fn clean(v: Option<String>) -> Option<String> {
    v.map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
}

/// Configuración actual. Si la fila no existe (base pre-migración rara) o un
/// campo está vacío, devuelve los valores por defecto de la app para que los
/// documentos siempre tengan encabezado.
pub fn get(conn: &mut SimpleConnection) -> Result<ClinicSettings, AppError> {
    let sql = format!("SELECT {SELECT_FIELDS} FROM CLINIC_SETTINGS WHERE ID = 1");
    let rows: Vec<SettingsRow> = conn.query(&sql, ()).map_err(AppError::from)?;
    Ok(match rows.into_iter().next() {
        Some(r) => {
            let mut s = map_row(r);
            if s.clinic_name.is_none() {
                s.clinic_name = Some(default_clinic_name());
            }
            s
        }
        None => ClinicSettings {
            clinic_name: Some(default_clinic_name()),
            tax_id: None,
            address: None,
            phone: None,
            email: None,
            license: None,
            logo_data_url: None,
            updated_at: None,
        },
    })
}

fn default_clinic_name() -> String {
    "VetSurgeryTR · Cirugía Ortopédica Veterinaria".into()
}

/// Valida el data URL del logo: debe ser «data:image/…;base64,…» y quedar por
/// debajo de la capacidad de la columna (200 000 chars ≈ 150 KB de archivo).
fn validate_logo(data_url: &str) -> Result<(), AppError> {
    let ok = data_url.starts_with("data:image/")
        && data_url.contains(";base64,");
    if !ok {
        return Err(AppError::Validation(
            "El logo debe ser una imagen en formato data URL (data:image/…;base64,…)"
                .into(),
        ));
    }
    if data_url.len() > 200_000 {
        return Err(AppError::Validation(
            "El logo es demasiado grande (máximo ~150 KB); usa una imagen más pequeña"
                .into(),
        ));
    }
    Ok(())
}

/// Actualiza la configuración (upsert sobre la fila única). Rechaza
/// no-operaciones, valida el logo y registra la edición en la bitácora con
/// diff campo a campo (los valores largos como el logo se resumen).
pub fn update(
    conn: &mut SimpleConnection,
    input: &UpdateClinicSettingsInput,
    actor: &str,
) -> Result<ClinicSettings, AppError> {
    let current = get(conn)?;

    // Semántica de edición (igual que vets/pacientes):
    //   None        → dejar sin cambio;
    //   Some("")    → quitar el dato (NULL);
    //   Some(texto) → fijar el valor (trim).
    let merge = |input: &Option<String>, before: &Option<String>| -> Option<String> {
        match input {
            None => before.clone(),
            Some(v) => {
                let t = v.trim().to_string();
                if t.is_empty() { None } else { Some(t) }
            }
        }
    };
    let clinic_name = merge(&input.clinic_name, &current.clinic_name);
    let tax_id = merge(&input.tax_id, &current.tax_id);
    let address = merge(&input.address, &current.address);
    let phone = merge(&input.phone, &current.phone);
    let email = merge(&input.email, &current.email);
    let license = merge(&input.license, &current.license);
    let logo_data_url = merge(&input.logo_data_url, &current.logo_data_url);

    if let Some(l) = &logo_data_url {
        validate_logo(l)?;
    }
    if let Some(e) = &email {
        if !e.contains('@') {
            return Err(AppError::Validation("El correo no es válido".into()));
        }
    }

    // Diff para la bitácora (etiqueta, viejo, nuevo).
    let changes: Vec<(&str, Option<&str>, Option<&str>)> = vec![
        ("Nombre", current.clinic_name.as_deref(), clinic_name.as_deref()),
        ("NIT", current.tax_id.as_deref(), tax_id.as_deref()),
        ("Dirección", current.address.as_deref(), address.as_deref()),
        ("Teléfono", current.phone.as_deref(), phone.as_deref()),
        ("Correo", current.email.as_deref(), email.as_deref()),
        ("Licencia", current.license.as_deref(), license.as_deref()),
    ];
    let text_diff: Vec<String> = changes
        .iter()
        .filter(|(_, old, new)| old != new)
        .map(|(label, old, new)| {
            format!(
                "{label}: {} → {}",
                old.map(|s| s.to_string()).unwrap_or_else(|| "—".into()),
                new.map(|s| s.to_string()).unwrap_or_else(|| "—".into())
            )
        })
        .collect();
    let logo_changed = current.logo_data_url.is_some() != logo_data_url.is_some();

    if text_diff.is_empty() && !logo_changed {
        return Err(AppError::Validation("No hay cambios por guardar".into()));
    }

    let mut detail = text_diff.join(" · ");
    if logo_changed {
        if !detail.is_empty() {
            detail.push_str(" · ");
        }
        detail.push_str(if logo_data_url.is_some() {
            "Logo: actualizado"
        } else {
            "Logo: eliminado"
        });
    }

    with_tx(conn, |conn| {
        conn.execute(
            "UPDATE CLINIC_SETTINGS
                SET CLINIC_NAME = ?, TAX_ID = ?, ADDRESS = ?, PHONE = ?,
                    EMAIL = ?, LICENSE = ?, LOGO_DATA_URL = ?,
                    UPDATED_AT = CURRENT_TIMESTAMP
              WHERE ID = 1",
            (
                &clinic_name, &tax_id, &address, &phone,
                &email, &license, &logo_data_url,
            ),
        )
        .map_err(AppError::from)?;

        crate::repositories::audit::log(
            conn,
            actor,
            "CONFIGURACION",
            Some(1),
            Some("clinica"),
            "EDITAR",
            Some(detail),
        )?;

        get(conn)
    })
}
