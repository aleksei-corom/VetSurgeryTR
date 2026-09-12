use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use password_hash::rand_core::OsRng;
use rsfbclient::prelude::*;
use rsfbclient::SimpleConnection;

use crate::error::AppError;
use crate::models::user::{ChangePasswordInput, LoginInput, Session, User};
use crate::repositories::{next_id, with_tx};

/// Credenciales iniciales: `admin / admin123` (la contraseña se pide cambiar
/// desde el UI; las guías de instalación lo documentan).
pub const DEFAULT_ADMIN_USERNAME: &str = "admin";
pub const DEFAULT_ADMIN_PASSWORD: &str = "admin123";
pub const DEFAULT_ADMIN_DISPLAY: &str = "Administrador";

/// Fecha/hora actual estilo Firebird (YYYY-MM-DD HH:MM:SS), igual que el
/// resto de la app.
fn now_ts() -> String {
    chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

fn hash_password(password: &str) -> Result<String, AppError> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| AppError::Internal(format!("No se pudo generar el hash: {e}")))
}

/// SELECT básico de usuarios (sin el hash).
const USER_SELECT: &str = "
    SELECT ID, USERNAME, DISPLAY_NAME, ROLE, ACTIVE FROM USERS";

type UserRow = (i32, String, String, String, bool);

fn map_user(r: UserRow) -> User {
    User {
        id: r.0,
        username: r.1,
        display_name: r.2,
        role: r.3,
        active: r.4,
    }
}

fn fetch_by_username(
    conn: &mut SimpleConnection,
    username: &str,
) -> Result<Option<(UserRow, String)>, AppError> {
    // Fila plana: rsfbclient no soporta tuplas anidadas al extraer columnas.
    let rows: Vec<(i32, String, String, String, bool, String)> = conn
        .query(
            "SELECT ID, USERNAME, DISPLAY_NAME, ROLE, ACTIVE, PASSWORD_HASH
             FROM USERS WHERE UPPER(USERNAME) = UPPER(?)",
            (&username,),
        )
        .map_err(AppError::from)?;
    Ok(rows
        .into_iter()
        .next()
        .map(|(id, u, d, r, a, h)| ((id, u, d, r, a), h)))
}

/// Crea el usuario `admin` con hash Argon2id de sal aleatoria SOLO si la
/// tabla está vacía (primer arranque tras la migración 0005). Idempotente.
pub fn ensure_default_admin(conn: &mut SimpleConnection) -> Result<(), AppError> {
    let count: Option<(i64,)> = conn
        .query_first("SELECT CAST(COUNT(*) AS BIGINT) FROM USERS", ())
        .map_err(AppError::from)?;
    if matches!(count, Some((0,)) | None) {
        let hash = hash_password(DEFAULT_ADMIN_PASSWORD)?;
        with_tx(conn, |conn| {
            let id = next_id(conn, "GEN_USERS_ID")?;
            conn.execute(
                "INSERT INTO USERS (ID, USERNAME, DISPLAY_NAME, PASSWORD_HASH, ROLE)
                 VALUES (?, ?, ?, ?, 'ADMIN')",
                (
                    &id,
                    &DEFAULT_ADMIN_USERNAME,
                    &DEFAULT_ADMIN_DISPLAY,
                    &hash,
                ),
            )
            .map_err(AppError::from)?;
            Ok(())
        })?;
    }
    Ok(())
}

/// Verifica credenciales y devuelve la sesión si son válidas. Errores con
/// mensajes deliberadamente genéricos (no se revela si el usuario existe).
pub fn login(conn: &mut SimpleConnection, input: &LoginInput) -> Result<Session, AppError> {
    let username = input.username.trim();
    if username.is_empty() || input.password.is_empty() {
        return Err(AppError::validation(
            "Usuario y contraseña son requeridos",
        ));
    }

    let row = fetch_by_username(conn, username)?;
    let Some(((id, _username, display_name, role, active), hash)) = row else {
        return Err(AppError::validation("Usuario o contraseña incorrectos"));
    };
    if !active {
        return Err(AppError::validation(
            "Usuario o contraseña incorrectos",
        ));
    }

    let parsed = PasswordHash::new(&hash)
        .map_err(|_| AppError::Internal("Hash de contraseña corrupto".into()))?;
    let ok = Argon2::default()
        .verify_password(input.password.as_bytes(), &parsed)
        .is_ok();
    if !ok {
        return Err(AppError::validation("Usuario o contraseña incorrectos"));
    }

    Ok(Session {
        user: User {
            id,
            username: _username,
            display_name,
            role,
            active,
        },
        logged_in_at: now_ts(),
    })
}

/// Cambia la contraseña del usuario autenticado (verifica la actual).
pub fn change_password(
    conn: &mut SimpleConnection,
    user_id: i32,
    input: &ChangePasswordInput,
) -> Result<(), AppError> {
    if input.new_password.len() < 6 {
        return Err(AppError::validation(
            "La nueva contraseña debe tener al menos 6 caracteres",
        ));
    }
    if input.new_password == input.current_password {
        return Err(AppError::validation(
            "La nueva contraseña debe ser diferente de la actual",
        ));
    }

    let row: Option<(String,)> = conn
        .query_first(
            "SELECT PASSWORD_HASH FROM USERS WHERE ID = ? AND ACTIVE = TRUE",
            (&user_id,),
        )
        .map_err(AppError::from)?;
    let Some((hash,)) = row else {
        return Err(AppError::NotFound("Usuario no encontrado".into()));
    };

    let parsed = PasswordHash::new(&hash)
        .map_err(|_| AppError::Internal("Hash de contraseña corrupto".into()))?;
    let current_ok = Argon2::default()
        .verify_password(input.current_password.as_bytes(), &parsed)
        .is_ok();
    if !current_ok {
        return Err(AppError::validation("La contraseña actual es incorrecta"));
    }

    let new_hash = hash_password(&input.new_password)?;
    with_tx(conn, |conn| {
        conn.execute(
            "UPDATE USERS SET PASSWORD_HASH = ?, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = ?",
            (&new_hash, &user_id),
        )
        .map_err(AppError::from)?;
        // Bitácora: cambio de contraseña del propio usuario.
        let cred: Option<(String, String)> = conn
            .query_first(
                "SELECT USERNAME, DISPLAY_NAME FROM USERS WHERE ID = ?",
                (&user_id,),
            )
            .map_err(AppError::from)?;
        let (username, display_name) = cred
            .ok_or_else(|| AppError::Internal("Usuario no recuperado".into()))?;
        crate::repositories::audit::log(
            conn,
            &display_name,
            "USUARIO",
            Some(user_id),
            Some(&username),
            "EDITAR",
            Some("Cambió su propia contraseña".into()),
        )?;
        Ok(())
    })
}

/// Listado completo de usuarios (solo admins): incluye inactivos.
pub fn list(conn: &mut SimpleConnection) -> Result<Vec<User>, AppError> {
    let rows: Vec<UserRow> = conn
        .query(&format!("{USER_SELECT} ORDER BY USERNAME"), ())
        .map_err(AppError::from)?;
    Ok(rows.into_iter().map(map_user).collect())
}

// ====================== GESTIÓN DE USUARIOS (ADMIN) =========================

fn validate_new_password(password: &str) -> Result<(), AppError> {
    if password.len() < 6 {
        return Err(AppError::validation(
            "La contraseña debe tener al menos 6 caracteres",
        ));
    }
    Ok(())
}

/// Valida username/display_name/rol de un alta de usuario.
fn validate_user_fields(
    username: &str,
    display_name: &str,
    role: &str,
) -> Result<(), AppError> {
    let username = username.trim();
    if username.len() < 3
        || username.len() > 30
        || !username
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '.')
    {
        return Err(AppError::validation(
            "El usuario debe tener 3-30 caracteres (letras, números, _ o .)",
        ));
    }
    if display_name.trim().is_empty() {
        return Err(AppError::validation("El nombre visible es requerido"));
    }
    if !matches!(role, "ADMIN" | "VET") {
        return Err(AppError::validation("El rol debe ser ADMIN o VET"));
    }
    Ok(())
}

/// Crea un usuario (solo admins) con hash Argon2id de sal aleatoria y deja
/// la alta en la bitácora. Unico por username (la BD también lo exige).
pub fn create_user(
    conn: &mut SimpleConnection,
    input: &crate::models::user::CreateUserInput,
    actor: &str,
) -> Result<User, AppError> {
    let username = input.username.trim().to_string();
    validate_user_fields(&username, &input.display_name, &input.role)?;
    validate_new_password(&input.password)?;

    let dup: Option<(i32,)> = conn
        .query_first(
            "SELECT ID FROM USERS WHERE UPPER(USERNAME) = UPPER(?)",
            (&username,),
        )
        .map_err(AppError::from)?;
    if dup.is_some() {
        return Err(AppError::Validation(format!(
            "Ya existe un usuario «{username}»"
        )));
    }

    let hash = hash_password(&input.password)?;
    with_tx(conn, |conn| {
        let id = next_id(conn, "GEN_USERS_ID")?;
        conn.execute(
            "INSERT INTO USERS (ID, USERNAME, DISPLAY_NAME, PASSWORD_HASH, ROLE)
             VALUES (?, ?, ?, ?, ?)",
            (&id, &username, &input.display_name.trim(), &hash, &input.role),
        )
        .map_err(AppError::from)?;

        crate::repositories::audit::log(
            conn,
            actor,
            "USUARIO",
            Some(id),
            Some(&username),
            "CREAR",
            Some(format!(
                "Alta de usuario {} ({}) con rol {}",
                username,
                input.display_name.trim(),
                input.role
            )),
        )?;

        Ok(User {
            id,
            username,
            display_name: input.display_name.trim().to_string(),
            role: input.role.clone(),
            active: true,
        })
    })
}

/// Activa/desactiva un usuario (solo admins). Protege contra apagar el
/// último ADMIN activo (quedaría la app sin gestión) y contra el
/// auto-desactivarse. Auditado.
pub fn set_user_active(
    conn: &mut SimpleConnection,
    user_id: i32,
    active: bool,
    actor_id: i32,
    actor: &str,
) -> Result<User, AppError> {
    let row: Option<(i32, String, String, String, bool)> = conn
        .query_first(
            &format!("{USER_SELECT} WHERE ID = ?"),
            (&user_id,),
        )
        .map_err(AppError::from)?;
    let Some((id, username, display_name, role, current_active)) = row else {
        return Err(AppError::NotFound("Usuario no encontrado".into()));
    };

    if user_id == actor_id && !active {
        return Err(AppError::Validation(
            "No puedes desactivar tu propio usuario (cierra sesión en su lugar)".into(),
        ));
    }
    if current_active == active {
        return Err(AppError::Validation(if active {
            "El usuario ya está activo".into()
        } else {
            "El usuario ya está inactivo".into()
        }));
    }
    if !active && role == "ADMIN" {
        let admins: Option<(i64,)> = conn
            .query_first(
                "SELECT CAST(COUNT(*) AS BIGINT) FROM USERS WHERE ROLE = 'ADMIN' AND ACTIVE = TRUE AND ID <> ?",
                (&user_id,),
            )
            .map_err(AppError::from)?;
        if matches!(admins, Some((0,)) | None) {
            return Err(AppError::Validation(
                "No se puede desactivar el último administrador activo".into(),
            ));
        }
    }

    with_tx(conn, |conn| {
        conn.execute(
            "UPDATE USERS SET ACTIVE = ?, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = ?",
            (&active, &user_id),
        )
        .map_err(AppError::from)?;

        crate::repositories::audit::log(
            conn,
            actor,
            "USUARIO",
            Some(user_id),
            Some(&username),
            "EDITAR",
            Some(if active {
                format!("Activó al usuario {username} ({display_name})")
            } else {
                format!("Desactivó al usuario {username} ({display_name})")
            }),
        )?;

        Ok(User {
            id,
            username,
            display_name,
            role,
            active,
        })
    })
}

/// Edita el nombre visible y/o el rol de un usuario (solo admins).
/// Guardas: no se puede quitar el rol ADMIN al último administrador activo,
/// ni degradarse a sí mismo si es el único admin. Auditado con diff.
pub fn update_user(
    conn: &mut SimpleConnection,
    user_id: i32,
    input: &crate::models::user::UpdateUserInput,
    _actor_id: i32,
    actor: &str,
) -> Result<User, AppError> {
    let row: Option<(i32, String, String, String, bool)> = conn
        .query_first(
            &format!("{USER_SELECT} WHERE ID = ?"),
            (&user_id,),
        )
        .map_err(AppError::from)?;
    let Some((id, username, display_name, role, active)) = row else {
        return Err(AppError::NotFound("Usuario no encontrado".into()));
    };

    let new_display = match &input.display_name {
        Some(n) => {
            let n = n.trim();
            if n.is_empty() {
                return Err(AppError::Validation("El nombre visible es requerido".into()));
            }
            n.to_string()
        }
        None => display_name.clone(),
    };
    let new_role = match &input.role {
        Some(r) => {
            if !matches!(r.as_str(), "ADMIN" | "VET") {
                return Err(AppError::Validation("El rol debe ser ADMIN o VET".into()));
            }
            r.clone()
        }
        None => role.clone(),
    };

    if new_display == display_name && new_role == role {
        return Err(AppError::Validation("No hay cambios por guardar".into()));
    }

    // Guarda: degradar no puede dejar a la clínica sin ningún ADMIN activo.
    if role == "ADMIN" && new_role != "ADMIN" && active {
        let admins: Option<(i64,)> = conn
            .query_first(
                "SELECT CAST(COUNT(*) AS BIGINT) FROM USERS WHERE ROLE = 'ADMIN' AND ACTIVE = TRUE AND ID <> ?",
                (&user_id,),
            )
            .map_err(AppError::from)?;
        if matches!(admins, Some((0,)) | None) {
            return Err(AppError::Validation(
                "No se puede quitar el rol de administrador al último administrador activo".into(),
            ));
        }
    }

    with_tx(conn, |conn| {
        conn.execute(
            "UPDATE USERS SET DISPLAY_NAME = ?, ROLE = ?, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = ?",
            (&new_display, &new_role, &user_id),
        )
        .map_err(AppError::from)?;

        let mut changes: Vec<String> = Vec::new();
        if new_display != display_name {
            changes.push(format!("Nombre: {display_name} → {new_display}"));
        }
        if new_role != role {
            let label = |r: &str| if r == "ADMIN" { "Administrador" } else { "Veterinario" };
            changes.push(format!("Rol: {} → {}", label(&role), label(&new_role)));
        }

        crate::repositories::audit::log(
            conn,
            actor,
            "USUARIO",
            Some(user_id),
            Some(&username),
            "EDITAR",
            Some(format!("Editó al usuario {username}: {}", changes.join(" · "))),
        )?;

        Ok(User {
            id,
            username,
            display_name: new_display,
            role: new_role,
            active,
        })
    })
}

/// Restablece la contraseña de cualquier usuario (solo admins, para olvidos).
/// Auditado SIN registrar la contraseña, obviamente.
pub fn reset_password(
    conn: &mut SimpleConnection,
    user_id: i32,
    new_password: &str,
    actor: &str,
) -> Result<(), AppError> {
    validate_new_password(new_password)?;

    let cred: Option<(String, String, bool)> = conn
        .query_first(
            "SELECT USERNAME, DISPLAY_NAME, ACTIVE FROM USERS WHERE ID = ?",
            (&user_id,),
        )
        .map_err(AppError::from)?;
    let Some((username, display_name, active)) = cred else {
        return Err(AppError::NotFound("Usuario no encontrado".into()));
    };
    if !active {
        return Err(AppError::Validation(
            "No se puede restablecer la contraseña de un usuario inactivo".into(),
        ));
    }

    let hash = hash_password(new_password)?;
    with_tx(conn, |conn| {
        conn.execute(
            "UPDATE USERS SET PASSWORD_HASH = ?, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = ?",
            (&hash, &user_id),
        )
        .map_err(AppError::from)?;

        crate::repositories::audit::log(
            conn,
            actor,
            "USUARIO",
            Some(user_id),
            Some(&username),
            "EDITAR",
            Some(format!("Restableció la contraseña de {username} ({display_name})")),
        )?;
        Ok(())
    })
}
