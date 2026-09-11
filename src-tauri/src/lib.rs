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

use tauri::Manager;

use crate::commands::dashboard::get_dashboard;
use crate::commands::db::db_status;
use crate::commands::follow_ups::{create_follow_up, update_follow_up};
use crate::commands::inventory::{
    create_inventory_item, get_inventory_item, list_inventory_items, update_inventory_item,
};
use crate::commands::materials::{remove_surgery_material, upsert_surgery_material};
use crate::commands::movements::create_movement;
use crate::commands::owners::{create_owner, list_owners};
use crate::commands::patients::{create_patient, get_patient, list_patients, update_patient};
use crate::commands::surgeries::{create_surgery, get_surgery, list_surgeries, update_surgery};
use crate::commands::vets::{create_vet, list_vets};
use crate::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Arranque de Firebird Embedded: crea la BD si falta, ejecuta las
            // migraciones pendientes (incluido el seed de demostración en el
            // primer arranque) y monta el pool de conexiones. Si algo falla,
            // queda en `init_error` y la UI lo muestra como banner de setup.
            let state = AppState::init(app.handle());
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ---- Estado de la base de datos ----
            db_status,
            // ---- Dashboard ----
            get_dashboard,
            // ---- Propietarios ----
            list_owners,
            create_owner,
            // ---- Veterinarios ----
            list_vets,
            create_vet,
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
