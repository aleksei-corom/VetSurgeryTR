use rsfbclient::prelude::*;
use rsfbclient::SimpleConnection;

use crate::error::AppError;

/// Migraciones versionadas, embebidas en el binario.
/// La versión es el índice + 1 (0001 → 1, 0002 → 2…).
///
/// 0003_seed inserta el dataset de demostración: se aplica UNA sola vez en el
/// primer arranque (queda registrada en _MIGRATIONS), igual que las demás.
/// Para volver a sembrar, borrar vetsurgerytr.fdb del directorio de datos.
pub const MIGRATIONS: &[(&str, &str)] = &[
    (
        "0001_domains",
        include_str!("../../migrations/0001_domains.sql"),
    ),
    (
        "0002_core",
        include_str!("../../migrations/0002_core.sql"),
    ),
    (
        "0003_seed",
        include_str!("../../migrations/0003_seed.sql"),
    ),
    (
        "0004_audit",
        include_str!("../../migrations/0004_audit.sql"),
    ),
    (
        "0005_users",
        include_str!("../../migrations/0005_users.sql"),
    ),
    (
        "0006_diagnosis",
        include_str!("../../migrations/0006_diagnosis.sql"),
    ),
    (
        "0007_clinic_settings",
        include_str!("../../migrations/0007_clinic_settings.sql"),
    ),
];

/// Aplica las migraciones pendientes. Devuelve la versión de schema resultante.
pub fn run_migrations(conn: &mut SimpleConnection) -> Result<i32, AppError> {
    ensure_schema_table(conn)?;

    let applied: Vec<(i32,)> = conn
        .query("SELECT VERSION FROM SCHEMA_MIGRATIONS ORDER BY VERSION", ())
        .map_err(AppError::from)?;

    for (idx, (name, sql)) in MIGRATIONS.iter().enumerate() {
        let version = (idx + 1) as i32;
        if applied.iter().any(|(v,)| *v == version) {
            continue;
        }

        for stmt in split_statements(sql)? {
            conn.execute(&stmt, ()).map_err(|e| {
                AppError::db(format!(
                    "Migración {name} (v{version}) — sentencia fallida: {e}\nSQL: {stmt}"
                ))
            })?;
        }

        conn.execute(
            "INSERT INTO SCHEMA_MIGRATIONS (VERSION, NAME) VALUES (?, ?)",
            (&version, name),
        )
        .map_err(AppError::from)?;
    }

    let max: Option<(i32,)> = conn
        .query_first("SELECT MAX(VERSION) FROM SCHEMA_MIGRATIONS", ())
        .map_err(AppError::from)?;
    Ok(max.map(|(v,)| v).unwrap_or(0))
}

/// Tabla de registro de migraciones.
fn ensure_schema_table(conn: &mut SimpleConnection) -> Result<(), AppError> {
    let exists: Option<(i32,)> = conn
        .query_first(
            "SELECT 1 FROM rdb$relations WHERE rdb$relation_name = 'SCHEMA_MIGRATIONS'",
            (),
        )
        .map_err(AppError::from)?;
    let exists = exists.is_some();

    if !exists {
        conn.execute(
            "CREATE TABLE SCHEMA_MIGRATIONS (
                VERSION    INTEGER NOT NULL PRIMARY KEY,
                NAME       VARCHAR(100) NOT NULL,
                APPLIED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
            )",
            (),
        )
        .map_err(AppError::from)?;
    }
    Ok(())
}

/// ¿El buffer acumulado termina en el terminador de sentencias?
/// Acepta un comentario de línea pegado después: "…; -- nota".
fn statement_complete(buf: &str, terminator: &str) -> bool {
    let t = buf.trim_end();
    if t.ends_with(terminator) {
        return true;
    }
    if let Some(pos) = t.rfind(terminator) {
        let after = t[pos + terminator.len()..].trim_start();
        if after.starts_with("--") {
            return true;
        }
    }
    false
}

/// Divide un script SQL en sentencias individuales respetando `SET TERM`
/// (necesario para crear triggers con ';' internos). `pub(crate)`: cubierta
/// por pruebas unitarias en src/tests.rs.
pub(crate) fn split_statements(sql: &str) -> Result<Vec<String>, AppError> {
    let mut statements = Vec::new();
    let mut terminator = ";".to_string();
    let mut current = String::new();

    for raw_line in sql.lines() {
        let line = raw_line.trim();

        if line.is_empty() {
            continue;
        }
        if line.starts_with("--") {
            continue;
        }
        // Directiva de terminador: "SET TERM ^ ;" o "SET TERM ^" (3 tokens,
        // la forma habitual de isql). Se acepta también el de 4 tokens.
        if line.to_ascii_uppercase().starts_with("SET TERM") {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 {
                terminator = parts[2].to_string();
            }
            continue;
        }

        if current.is_empty() {
            current.push_str(raw_line);
        } else {
            current.push('\n');
            current.push_str(raw_line);
        }

        if statement_complete(&current, &terminator) {
            // Cortar en el terminador; lo que siga (p. ej. un comentario "--
            // nota" pegado al ';') se descarta.
            let pos = current.rfind(&terminator).expect("terminador verificado");
            let stmt = current[..pos].trim().to_string();
            if !stmt.is_empty() {
                statements.push(stmt);
            }
            current.clear();
        }
    }

    if !current.trim().is_empty() {
        return Err(AppError::db(
            "Migración SQL incompleta: falta el terminador de sentencia",
        ));
    }

    Ok(statements)
}
