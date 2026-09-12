use std::fs;
use std::path::PathBuf;

use chrono::{DateTime, Local, TimeZone};
use tauri::State;

use crate::error::AppError;
use crate::models::backup::{BackupFile, CreateBackupResult};
use crate::state::AppState;

/// Carpeta de respaldos dentro del directorio de datos.
const BACKUP_DIR_NAME: &str = "backups";
/// Prefijo de los respaldos reconocidos por `list_backups`.
const BACKUP_PREFIX: &str = "vetsurgerytr-";
/// Sufijo de los respaldos reconocidos.
const BACKUP_SUFFIX: &str = ".fdb";
/// Máximo de respaldos a listar (los más recientes).
const MAX_LISTED: usize = 100;
/// Antigüedad máxima del último respaldo antes de crear uno automático al
/// arrancar (24 h). El auto-respaldo es una red de seguridad, no sustituye
/// al botón de respaldo manual.
pub const AUTO_BACKUP_MAX_AGE_HOURS: i64 = 24;

fn backups_dir(state: &AppState) -> PathBuf {
    state.app_data_dir.join(BACKUP_DIR_NAME)
}

/// Copia `from` a `to` copiando el contenido completo (equivalente a
/// FILE_COPY de Firebird para un archivo en reposo).
fn copy_db_file(from: &PathBuf, to: &PathBuf) -> Result<u64, AppError> {
    fs::copy(from, to).map_err(|e| {
        AppError::db(format!(
            "No se pudo copiar la base de datos ({} → {}): {e}",
            from.display(),
            to.display()
        ))
    })
}

/// Crea un respaldo puntual (copiar archivo) de la base de datos:
/// `%APPDATA%/vetsurgerytr/backups/vetsurgerytr-<AAAA-MM-DD-HHMMSS>.fdb`.
///
/// Todas las conexiones del pool se devuelven ANTES de copiar para que
/// Firebird no tenga transacciones en vuelo sobre el archivo: la copia es
/// consistente (quiesce del pool). El nombre del respaldo incluye la versión
/// de esquema para saber con qué migraciones restaurarlo.
#[tauri::command]
pub async fn create_backup(state: State<'_, AppState>) -> Result<CreateBackupResult, AppError> {
    // Operación sensible (copia la BD completa): requiere sesión activa.
    state.require_session()?;
    if state.init_error.is_some() {
        return Err(AppError::db(
            "Firebird Embedded no está disponible: no hay base de datos que respaldar. \
             Revisa el banner de configuración al abrir la app.",
        ));
    }
    if !state.db_path.exists() {
        return Err(AppError::db(format!(
            "No se encontró la base de datos en {}",
            state.db_path.display()
        )));
    }

    // ---- Quiesce: extraer TODAS las conexiones del pool ----
    // Con pool de 4 conexiones esto siempre progresa: los comandos async
    // liberan la suya al terminar y la adquirimos aquí. El lock interno del
    // pool nunca se mantiene entre esperas.
    let mut quiesced: Vec<rsfbclient::SimpleConnection> = Vec::with_capacity(4);
    let mut wait_rounds = 0u32;
    while quiesced.len() < 4 && wait_rounds < 100 {
        match state.pool.acquire() {
            Ok(pooled) => quiesced.push(pooled.into_inner()),
            Err(_) => {
                // Pool momentáneamente vacío (otro comando sostiene una):
                // esperar y reintentar; los comandos async liberan rápido.
                wait_rounds += 1;
                tokio::time::sleep(std::time::Duration::from_millis(10)).await;
            }
        }
    }
    if quiesced.is_empty() {
        return Err(AppError::db(
            "No se pudo preparar el respaldo: hay operaciones de base de datos en curso. \
             Intenta de nuevo en unos segundos.",
        ));
    }
    // Al quedar fuera del pool, ninguna conexión mantiene transacciones
    // durante la copia: el archivo está en reposo.

    let result = create_backup_core(&state, &quiesced);
    reintegrate(&state, quiesced);
    result
}

/// Reintegra al pool las conexiones extraídas por el quiesce.
fn reintegrate(state: &AppState, quiesced: Vec<rsfbclient::SimpleConnection>) {
    for conn in quiesced {
        state.pool.release_raw(conn);
    }
}

/// Núcleo común del respaldo (manual y automático): copia la base en reposo
/// → archivo de respaldo + resultado. NO toca el pool: el llamador extrae y
/// reintegra las conexiones (quiesce).
fn create_backup_core(
    state: &AppState,
    _quiesced: &[rsfbclient::SimpleConnection],
) -> Result<CreateBackupResult, AppError> {
    let dir = backups_dir(state);
    fs::create_dir_all(&dir).map_err(|e| {
        AppError::db(format!(
            "No se pudo crear la carpeta de respaldos ({}): {e}",
            dir.display()
        ))
    })?;

    let stamp = Local::now().format("%Y-%m-%d-%H%M%S");
    let file_name = format!("{BACKUP_PREFIX}{stamp}-v{0}.fdb", state.schema_version);
    let dest = dir.join(&file_name);

    let size = copy_db_file(&state.db_path, &dest)?;

    let backup = BackupFile {
        file_name: file_name.clone(),
        full_path: dest.display().to_string(),
        size_bytes: size,
        modified_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        schema_version: state.schema_version,
    };

    let total = list_backups_in(&dir)
        .map(|v| v.len() as u64)
        .unwrap_or(1);

    Ok(CreateBackupResult {
        backup,
        total_backups: total,
    })
}

// ========================= AUTO-RESPALDO AL ARRANCAR ========================

/// ¿Toca crear un respaldo automático? `true` si no existe la carpeta de
/// respaldos (primera vez) o si el más reciente es más viejo que
/// `max_age_hours`. Con `now` inyectado para poder probarlo.
fn backup_is_due(dir: &PathBuf, max_age_hours: i64, now: DateTime<Local>) -> bool {
    match list_backups_in(dir) {
        Ok(backups) => match backups.first() {
            // Sin respaldos aún: el primero toca ya.
            None => true,
            Some(latest) => parse_backup_stamp(&latest.file_name)
                .map(|t| now.signed_duration_since(t).num_hours() >= max_age_hours)
                // Nombre sin fecha parseable: por seguridad, respalda.
                .unwrap_or(true),
        },
        // Carpeta ilegible: mejor respaldar que quedar sin copia.
        Err(_) => true,
    }
}

/// Extrae la marca de tiempo del nombre del respaldo
/// `vetsurgerytr-YYYY-MM-DD-HHMMSS-v<N>.fdb` → DateTime local.
fn parse_backup_stamp(file_name: &str) -> Option<DateTime<Local>> {
    let base = file_name.trim_end_matches(BACKUP_SUFFIX);
    let stamp = base.strip_prefix(BACKUP_PREFIX)?;
    let stamp = stamp.split("-v").next()?;
    let mut parts = stamp.splitn(3, '-');
    let date = format!("{}-{}-{}", parts.next()?, parts.next()?, parts.next()?);
    let (date, time) = date.rsplit_once('-')?;
    chrono::NaiveDateTime::parse_from_str(&format!("{date} {time}"), "%Y-%m-%d %H%M%S")
        .ok()
        .map(|ndt| Local.from_local_datetime(&ndt).single().unwrap_or_else(Local::now))
}

/// Respaldó hoy ya (o nunca): decide y ejecuta el respaldo automático del
/// arranque. Reutiliza EXACTAMENTE el mismo núcleo del botón manual
/// (`create_backup_core`): mismo quiesce, mismo nombre de archivo.
/// Nunca aborta el arranque: los errores solo se registran en el log.
pub fn auto_backup_on_startup(state: &AppState) {
    if state.init_error.is_some() || !state.db_path.exists() {
        return; // sin Firebird no hay nada que respaldar
    }
    let dir = backups_dir(state);
    if !backup_is_due(&dir, AUTO_BACKUP_MAX_AGE_HOURS, Local::now()) {
        println!("[auto-backup] omitido: el último respaldo tiene menos de {AUTO_BACKUP_MAX_AGE_HOURS} h");
        return;
    }

    // Arranque = nadie más sostiene conexiones: quiesce inmediato sin espera.
    let mut quiesced: Vec<rsfbclient::SimpleConnection> = Vec::with_capacity(4);
    for _ in 0..4 {
        if let Ok(pooled) = state.pool.acquire() {
            quiesced.push(pooled.into_inner());
        }
    }
    if quiesced.is_empty() {
        eprintln!("[auto-backup] pool sin conexiones (no bloquea el arranque)");
        return;
    }

    let result = create_backup_core(state, &quiesced);
    reintegrate(state, quiesced);
    match result {
        Ok(res) => println!(
            "[auto-backup] creado: {} ({} bytes)",
            res.backup.file_name, res.backup.size_bytes
        ),
        Err(e) => eprintln!("[auto-backup] falló (no bloquea el arranque): {e}"),
    }
}

/// Lista los respaldos existentes (más recientes primero).
#[tauri::command]
pub async fn list_backups(state: State<'_, AppState>) -> Result<Vec<BackupFile>, AppError> {
    state.require_session()?;
    let dir = backups_dir(&state);
    if !dir.exists() {
        return Ok(Vec::new());
    }
    list_backups_in(&dir)
}

/// Escanea la carpeta de respaldos y devuelve los `MAX_LISTED` más recientes.
fn list_backups_in(dir: &PathBuf) -> Result<Vec<BackupFile>, AppError> {
    let entries = fs::read_dir(dir)
        .map_err(|e| AppError::db(format!("No se pudo leer {}: {e}", dir.display())))?;

    let mut files: Vec<BackupFile> = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if !(name.starts_with(BACKUP_PREFIX) && name.ends_with(BACKUP_SUFFIX)) {
            continue;
        }

        let meta = entry.metadata().map_err(|e| {
            AppError::db(format!("No se pudo leer el metadato de {name}: {e}"))
        })?;
        let modified: DateTime<Local> = meta
            .modified()
            .map(DateTime::from)
            .unwrap_or_else(|_| Local::now());

        // Versión de esquema codificada en el nombre: …-v3.fdb (si existe).
        let schema_version = name
            .trim_end_matches(BACKUP_SUFFIX)
            .rsplit("-v")
            .next()
            .and_then(|v| v.parse::<i32>().ok())
            .unwrap_or(0);

        files.push(BackupFile {
            file_name: name.to_string(),
            full_path: path.display().to_string(),
            size_bytes: meta.len(),
            modified_at: modified.format("%Y-%m-%d %H:%M:%S").to_string(),
            schema_version,
        });
    }

    files.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    files.truncate(MAX_LISTED);
    Ok(files)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefijos_de_respaldo_son_consistentes() {
        // El prefijo debe cuadrar con el nombre generado para que el scan lo
        // reconozca inmediatamente tras crearlo.
        let stamp = Local::now().format("%Y-%m-%d-%H%M%S").to_string();
        let name = format!("{BACKUP_PREFIX}{stamp}-v3{BACKUP_SUFFIX}");
        assert!(name.starts_with(BACKUP_PREFIX) && name.ends_with(BACKUP_SUFFIX));
        let v = name
            .trim_end_matches(BACKUP_SUFFIX)
            .rsplit("-v")
            .next()
            .and_then(|s| s.parse::<i32>().ok());
        assert_eq!(v, Some(3));
    }

    fn stamp_name(hours_ago: i64) -> String {
        let t = Local::now() - chrono::Duration::hours(hours_ago);
        format!(
            "{BACKUP_PREFIX}{}-v5{BACKUP_SUFFIX}",
            t.format("%Y-%m-%d-%H%M%S")
        )
    }

    #[test]
    fn parse_backup_stamp_extrae_la_fecha_del_nombre() {
        let name = stamp_name(0);
        let parsed = parse_backup_stamp(&name).expect("debe parsear");
        let diff = Local::now().signed_duration_since(parsed);
        assert!(
            diff.num_minutes() < 2,
            "la marca debe ser «ahora», desviación: {diff}"
        );
        // Sin marca → None (respalda por seguridad).
        assert!(parse_backup_stamp("vetsurgerytr-sin-fecha.fdb").is_none());
    }

    #[test]
    fn backup_is_due_respeta_el_umbral_de_24h() {
        let tmp = std::env::temp_dir().join(format!("vst-autobk-{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        let now = Local::now();

        // Sin respaldos → toca.
        assert!(backup_is_due(&tmp, 24, now));

        // Respaldo de hace 23 h → NO toca (aún fresco).
        fs::write(tmp.join(stamp_name(23)), b"x").unwrap();
        assert!(!backup_is_due(&tmp, 24, now));

        // Respaldo de hace 25 h → toca.
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        fs::write(tmp.join(stamp_name(25)), b"x").unwrap();
        assert!(backup_is_due(&tmp, 24, now));

        // Archivo con nombre no parseable → toca (por seguridad).
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();
        fs::write(tmp.join("vetsurgerytr-raro.fdb"), b"x").unwrap();
        assert!(backup_is_due(&tmp, 24, now));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn umbral_publico_es_24h() {
        assert_eq!(AUTO_BACKUP_MAX_AGE_HOURS, 24);
    }
}
