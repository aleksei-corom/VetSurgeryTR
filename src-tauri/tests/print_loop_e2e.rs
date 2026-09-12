//! Verificación E2E del ciclo completo de impresión de documentos clínicos
//! contra Firebird real, imitando EXACTAMENTE lo que hace la app:
//!
//!   1. Arranque real (bootstrap + migraciones + admin por defecto) — el
//!      mismo camino que `bun run tauri dev`.
//!   2. Sesión real: login del usuario (como `login` de la UI).
//!   3. Estado de la app REAL (AppState gestionado por Tauri con
//!      `mock_app().manage(state)`) con la sesión activa, tal como lo tiene
//!      el webview al imprimir.
//!   4. Los comandos IPC reales `log_document_print` y `list_audit_log`
//!      (los mismos que registran y leen la Bitácora), invocados con el
//!      `State<AppState>` gestionado por el runtime mock de Tauri.
//!   5. Verificación de la atribución: quién imprimió y cuándo, y de la
//!      guarda: sin sesión no se registra nada.
//!
//! Ejecutar con:
//!   cargo test --test print_loop_e2e -- --ignored --nocapture

use std::path::PathBuf;

use tauri::Manager;

use vetsurgerytr_lib::commands::audit::{list_audit_log, log_document_print, LogDocumentPrintInput};
use vetsurgerytr_lib::db::bootstrap;
use vetsurgerytr_lib::models::user::LoginInput;
use vetsurgerytr_lib::repositories::user as user_repo;
use vetsurgerytr_lib::state::AppState;

fn fbclient() -> Option<PathBuf> {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let candidate = manifest.join("binaries/firebird/fbclient.dll");
    candidate.exists().then_some(candidate)
}

#[test]
#[ignore = "requiere Firebird Embedded real (fbclient.dll); correr con --ignored"]
fn ciclo_impresion_e2e_con_sesion_real() {
    let Some(fb) = fbclient() else {
        eprintln!("SKIP: fbclient.dll no encontrado");
        return;
    };

    // ---- 1) Arranque real sobre BD temporal (bootstrap + migraciones) ----
    let mut db_path = std::env::temp_dir();
    db_path.push(format!("vst-print-e2e-{}.fdb", std::process::id()));
    let _ = std::fs::remove_file(&db_path);

    let (pool, schema_version) = bootstrap(&db_path, &fb).expect("bootstrap falló");
    println!(
        "✔ Arranque real: esquema v{schema_version}, BD temporal {}",
        db_path.display()
    );

    // ---- 2) Login real (mismo repo que el comando `login` de la UI) ----
    let session = {
        let mut pooled = pool.acquire().unwrap();
        user_repo::login(
            pooled.conn(),
            &LoginInput {
                username: user_repo::DEFAULT_ADMIN_USERNAME.into(),
                password: user_repo::DEFAULT_ADMIN_PASSWORD.into(),
            },
        )
        .expect("login del admin por defecto falló")
    };
    println!(
        "✔ Sesión real iniciada: {} ({})",
        session.user.display_name, session.user.role
    );

    // ---- 3) Estado REAL de la app, gestionado por Tauri ----
    // mock_app levanta el runtime mock (sin ventana); manage() es el mismo
    // `app.manage(state)` de src-tauri/src/lib.rs:54. El webview recibiría
    // exactamente este State<AppState> al invocar los comandos.
    let app = tauri::test::mock_app();
    let state = AppState {
        app_data_dir: std::env::temp_dir(),
        pool,
        db_path: db_path.clone(),
        fbclient_path: fb.clone(),
        schema_version,
        init_error: None,
        session: std::sync::RwLock::new(Some(session.clone())),
    };
    assert_eq!(state.actor(), session.user.display_name);
    app.manage(state);

    // ---- 4) Los comandos IPC reales, como los llama el botón Imprimir ----
    tauri::async_runtime::block_on(async {
        let state: tauri::State<AppState> = app.state();

        // Consentimiento informado de la cirugía CIR-2026-0001.
        log_document_print(
            state.clone(),
            LogDocumentPrintInput {
                document: "Consentimiento informado".into(),
                entity_code: "CIR-2026-0001".into(),
                entity_id: Some(1),
            },
        )
        .await
        .expect("log_document_print falló");
        println!("✔ «Imprimir / PDF» confirmado → log_document_print ejecutado");

        // Fórmula médica de la misma cirugía.
        log_document_print(
            state.clone(),
            LogDocumentPrintInput {
                document: "Fórmula médica postquirúrgica".into(),
                entity_code: "CIR-2026-0001".into(),
                entity_id: Some(1),
            },
        )
        .await
        .expect("log_document_print (fórmula) falló");

        // ---- 5) La vista Bitácora lee exactamente así ----
        let entries = list_audit_log(
            state.clone(),
            Some("DOCUMENTO".into()),
            Some("IMPRIMIR".into()),
            None,
            Some(200),
        )
        .await
        .expect("list_audit_log falló");

        assert!(entries.len() >= 2, "deben aparecer ambas impresiones: {entries:?}");
        for e in &entries {
            assert_eq!(e.entity_type, "DOCUMENTO");
            assert_eq!(e.action, "IMPRIMIR");
            // Atribución: al usuario de la sesión, no a «Sistema local».
            assert_eq!(
                e.actor, session.user.display_name,
                "la impresión debe quedar a nombre del usuario en sesión"
            );
            assert!(
                e.detail
                    .as_deref()
                    .is_some_and(|d| d.starts_with("Documento impreso: ")),
                "detalle legible: {:?}",
                e.detail
            );
            assert!(!e.created_at.is_empty(), "CREATED_AT lo fija Firebird");
        }
        println!(
            "✔ Bitácora: {} impresiones leídas con los filtros de la vista, atribuidas a «{}» ({})",
            entries.len(),
            entries[0].actor,
            entries[0].created_at
        );

        // Búsqueda libre por código, como el cuadro de la vista.
        let by_code = list_audit_log(
            state.clone(),
            None,
            None,
            Some("CIR-2026-0001".into()),
            Some(100),
        )
        .await
        .unwrap();
        assert!(
            by_code
                .iter()
                .any(|e| e.entity_type == "DOCUMENTO" && e.action == "IMPRIMIR")
        );
        println!("✔ Búsqueda por código CIR-2026-0001 encuentra la impresión");

        // ---- 6) Guarda: sin sesión NO se registra la impresión ----
        {
            let mut guard = state.session.write().unwrap();
            *guard = None;
        }
        let err = log_document_print(
            state.clone(),
            LogDocumentPrintInput {
                document: "Historia clínica quirúrgica".into(),
                entity_code: "CIR-2026-0001".into(),
                entity_id: Some(1),
            },
        )
        .await
        .expect_err("sin sesión debe rechazar");
        assert!(err.message.contains("sesión"), "mensaje real: {err}");
        println!("✔ Sin sesión activa el comando rechaza («{}»)", err.message);
    });

    let _ = std::fs::remove_file(&db_path);
    println!("\n✅ CICLO DE IMPRESIÓN E2E COMPLETO: login real → imprimir → bitácora atribuida al usuario — contra Firebird real.");
}
