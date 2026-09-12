use serde::Serialize;

/// Archivo de respaldo detectado en la carpeta `backups` del directorio de
/// datos de la app (`%APPDATA%/vetsurgerytr/backups` en Windows).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupFile {
    /// Nombre del archivo (p. ej. `vetsurgerytr-2026-09-11-143055.fdb`).
    pub file_name: String,
    /// Ruta absoluta (para "copiar la ruta" en la UI).
    pub full_path: String,
    /// Tamaño en bytes.
    pub size_bytes: u64,
    /// Fecha de modificación como "YYYY-MM-DD HH:MM:SS" (hora local).
    pub modified_at: String,
    /// Versión del esquema registrada cuando se creó el respaldo.
    pub schema_version: i32,
}

/// Resultado de crear un respaldo: la entrada generada + total de respaldos.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBackupResult {
    pub backup: BackupFile,
    pub total_backups: u64,
}
