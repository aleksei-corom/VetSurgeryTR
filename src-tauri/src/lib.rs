// VetSurgeryTR — punto de entrada de la biblioteca Tauri.
//
// Arquitectura: React (Vite, puerto 1420) ↔ invoke IPC ↔ Rust ↔ Firebird 5
// Embedded vía rsfbclient (dynamic_loading hacia binaries/firebird/).
pub mod commands;
pub mod db;
pub mod error;
pub mod models;
pub mod repositories;
pub mod state;

#[cfg(test)]
mod tests;

use tauri::Manager;

use crate::commands::audit::{get_document_prints, get_print_totals, list_audit_log, log_document_print};
use crate::commands::auth::{
    change_password, create_user, get_session, list_users, login, logout, reset_user_password,
    set_user_active, update_user,
};
use crate::commands::backup::{create_backup, list_backups};
use crate::commands::clinic::{get_clinic_settings, update_clinic_settings};
use crate::commands::dashboard::get_dashboard;
use crate::commands::export::{export_audit_csv, export_inventory_csv, export_kardex_csv};
use crate::commands::db::db_status;
use crate::commands::follow_ups::{create_follow_up, update_follow_up};
use crate::commands::inventory::{
    create_inventory_item, get_inventory_item, list_inventory_items, update_inventory_item,
};
use crate::commands::materials::{remove_surgery_material, upsert_surgery_material};
use crate::commands::movements::{create_movement, list_movements};
use crate::commands::owners::{create_owner, list_owners};
use crate::commands::patients::{create_patient, get_patient, list_patients, update_patient};
use crate::commands::surgeries::{create_surgery, get_surgery, list_surgeries, update_surgery};
use crate::commands::vets::{create_vet, list_all_vets, list_vets, set_vet_active, update_vet};
use crate::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Diálogos nativos (selector de carpeta para exportar CSV).
            app.handle().plugin(tauri_plugin_dialog::init())?;
            // Arranque de Firebird Embedded: crea la BD si falta, ejecuta las
            // migraciones pendientes (incluido el seed de demostración en el
            // primer arranque) y monta el pool de conexiones. Si algo falla,
            // queda en `init_error` y la UI lo muestra como banner de setup.
            let state = AppState::init(app.handle());
            // Auto-respaldo diario: si el último respaldo tiene más de 24 h
            // (o no existe), crea uno ANTES de servir comandos — la base está
            // en reposo y el arranque nunca muere por un fallo de respaldo.
            commands::backup::auto_backup_on_startup(&state);
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ---- Sesión local (login) ----
            login,
            get_session,
            logout,
            change_password,
            // ---- Gestión de usuarios (solo admins) ----
            list_users,
            create_user,
            update_user,
            set_user_active,
            reset_user_password,
            // ---- Estado de la base de datos ----
            db_status,
            // ---- Respaldos ----
            create_backup,
            list_backups,
            // ---- Configuración de la clínica ----
            get_clinic_settings,
            update_clinic_settings,
            // ---- Exportaciones CSV ----
            export_inventory_csv,
            export_kardex_csv,
            export_audit_csv,
            // ---- Bitácora de auditoría ----
            list_audit_log,
            log_document_print,
            get_document_prints,
            get_print_totals,
            // ---- Dashboard ----
            get_dashboard,
            // ---- Propietarios ----
            list_owners,
            create_owner,
            // ---- Veterinarios ----
            list_vets,
            list_all_vets,
            create_vet,
            update_vet,
            set_vet_active,
            // ---- Pacientes ----
            list_patients,
            get_patient,
            create_patient,
            update_patient,
            // ---- Inventario ----
            list_inventory_items,
            get_inventory_item,
            create_inventory_item,
            update_inventory_item,
            // ---- Movimientos de inventario ----
            create_movement,
            list_movements,
            // ---- Cirugías (incluye el flujo quirúrgico completo) ----
            list_surgeries,
            get_surgery,
            create_surgery,
            update_surgery,
            // ---- Materiales por cirugía ----
            upsert_surgery_material,
            remove_surgery_material,
            // ---- Controles postoperatorios ----
            create_follow_up,
            update_follow_up,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
