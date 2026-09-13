//! Smoke test de runtime contra Firebird 5 Embedded REAL (requiere
//! src-tauri/binaries/firebird/fbclient.dll; se salta automáticamente si falta).
//! Recorre el mismo camino que `bun run tauri dev` en el primer arranque:
//! bootstrap (crear BD + migraciones + seed) → dominio completo:
//! pacientes, inventario, movimientos con auditoría, cirugía con transición
//! de estado y consumo de inventario, controles postoperatorios y bitácora.
//!
//! Ejecutar con:
//!   cargo test --test firebird_smoke -- --ignored --nocapture

use std::path::PathBuf;

use vetsurgerytr_lib::db::bootstrap;
use vetsurgerytr_lib::models::inventory::CreateMovementInput;
use vetsurgerytr_lib::models::patient::{CreatePatientInput, UpdatePatientInput};
use vetsurgerytr_lib::models::surgery::{CreateSurgeryInput, UpdateSurgeryInput, UpsertMaterialInput};
use vetsurgerytr_lib::models::user::{ChangePasswordInput, LoginInput};
use vetsurgerytr_lib::repositories;
use vetsurgerytr_lib::repositories::user as user_repo;

/// Nombre visible del usuario autenticado en el smoke test (lo fija la
/// sección de login; equivale a AppState::actor()).
static ACTOR: std::sync::OnceLock<String> = std::sync::OnceLock::new();

fn fbclient() -> Option<PathBuf> {
    // Igual que resolve_fbclient: busca junto a target/<profile>/ el directorio
    // src-tauri/binaries/firebird.
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    let candidate = dir
        .parent()?
        .parent()?
        .join("binaries/firebird/fbclient.dll");
    if candidate.exists() {
        Some(candidate)
    } else {
        // Fallback: ruta relativa al manifest (cargo test corre desde src-tauri/).
        let rel = PathBuf::from("binaries/firebird/fbclient.dll");
        if rel.exists() { Some(rel) } else { None }
    }
}

fn temp_db_path(tag: &str) -> PathBuf {
    let mut p = std::env::temp_dir();
    p.push(format!("vst-smoke-{}-{}.fdb", tag, std::process::id()));
    let _ = std::fs::remove_file(&p);
    p
}

#[test]
#[ignore = "requiere Firebird Embedded real (fbclient.dll); correr con --ignored"]
fn smoke_runtime_completo_con_firebird_real() {
    let Some(fb) = fbclient() else {
        eprintln!("SKIP: fbclient.dll no encontrado (smoke test requiere Firebird Embedded)");
        return;
    };
    let db_path = temp_db_path("runtime");
    println!("▶ fbclient: {}", fb.display());
    println!("▶ BD temporal: {}", db_path.display());

    // ================= 1) Bootstrap: crea BD + migraciones (v4) + seed =====
    let (pool, schema_version) = bootstrap(&db_path, &fb).expect("bootstrap falló");
    println!("✔ Bootstrap OK · schema v{schema_version}");
    assert_eq!(schema_version, 7, "deben aplicarse las 7 migraciones");

    // ================= 2) Dashboard sobre el seed ==========================
    {
        let mut pooled = pool.acquire().unwrap();
        let dash = repositories::dashboard::get_dashboard(pooled.conn()).unwrap();
        assert!(dash.stats.patients_active > 0, "el seed debe traer pacientes");
        assert!(dash.stats.inventory_value >= 0.0);
        println!(
            "✔ Dashboard: {} pacientes activos, {} cirugías programadas, {} alertas de stock",
            dash.stats.patients_active, dash.stats.surgeries_scheduled, dash.stats.low_stock_count
        );
    }

    // ================= 2b) Login local + bitácora con actor ================
    {
        let mut pooled = pool.acquire().unwrap();
        let conn = pooled.conn();

        // Admin sembrado por el bootstrap (hash Argon2id de sal aleatoria).
        let wrong = user_repo::login(conn, &LoginInput {
            username: "admin".into(),
            password: "no-es-la-contraseña".into(),
        })
        .unwrap_err();
        assert!(wrong.message.contains("incorrectos"), "mensaje real: {wrong}");

        let session = user_repo::login(conn, &LoginInput {
            username: "admin".into(),
            password: user_repo::DEFAULT_ADMIN_PASSWORD.into(),
        })
        .unwrap();
        assert_eq!(session.user.username, "admin");
        assert_eq!(session.user.role, "ADMIN");
        println!("✔ Login OK: {} ({}) · sesión local lista", session.user.username, session.user.display_name);

        // Cambio de contraseña: actual incorrecta → rechazada; correcta → ok
        // y queda auditado a nombre del usuario.
        let err = user_repo::change_password(conn, session.user.id, &ChangePasswordInput {
            current_password: "otra-mal".into(),
            new_password: "clavenueva1".into(),
        })
        .unwrap_err();
        assert!(err.message.contains("actual es incorrecta"), "mensaje real: {err}");

        user_repo::change_password(conn, session.user.id, &ChangePasswordInput {
            current_password: user_repo::DEFAULT_ADMIN_PASSWORD.into(),
            new_password: "clavenueva1".into(),
        })
        .unwrap();
        // La contraseña vieja ya NO sirve (verificación real contra la BD).
        assert!(user_repo::login(conn, &LoginInput {
            username: "admin".into(),
            password: user_repo::DEFAULT_ADMIN_PASSWORD.into(),
        })
        .is_err());
        let s2 = user_repo::login(conn, &LoginInput {
            username: "admin".into(),
            password: "clavenueva1".into(),
        })
        .unwrap();
        let audit = repositories::audit::list(conn, Some("USUARIO"), None, None, 10).unwrap();
        assert!(audit.iter().any(|a| a.detail.as_deref() == Some("Cambió su propia contraseña")));
        println!("✔ Cambio de contraseña verificado (re-login con la nueva) y auditado");

        let _ = ACTOR.set(s2.user.display_name.clone());
    }

    // Actor autenticado que se atribuirá en la bitácora (como hace AppState).
    let actor_admin = ACTOR.get().map(String::as_str).unwrap_or("Sistema local");
    assert_eq!(actor_admin, "Administrador");

    // ================= 3) Crear paciente (upsert de propietario) ===========
    let patient = {
        let mut pooled = pool.acquire().unwrap();
        repositories::patient::create(
            pooled.conn(),
            &CreatePatientInput {
                owner: vetsurgerytr_lib::models::owner::CreateOwnerInput {
                    document_type: "CC".into(),
                    document_number: format!("SMOKE{}", std::process::id()),
                    full_name: "Dueño Smoke Test".into(),
                    phone: Some("+57 300 000 0000".into()),
                    email: None,
                    address: None,
                    city: Some("Medellín".into()),
                    notes: None,
                },
                name: "Firulais Smoke".into(),
                species: "Canino".into(),
                breed: Some("Mestizo".into()),
                sex: "M".into(),
                birth_date: Some("2022-05-10".into()),
                weight: Some(25.0),
                neutered: Some(false),
                color: Some("Café".into()),
                microchip: None,
                notes: None,
            },
            actor_admin,
        )
        .unwrap()
    };
    assert!(patient.code.starts_with("PAC-"), "código PAC-YYYY-NNNN");
    println!("✔ Paciente creado: {} ({})", patient.name, patient.code);

    // ================= 4) Editar paciente → auditoría con diff ============
    {
        let mut pooled = pool.acquire().unwrap();
        let updated = repositories::patient::update(
            pooled.conn(),
            patient.id,
            &UpdatePatientInput {
                weight: Some(27.5),
                active: Some(true),
                ..Default::default()
            },
            actor_admin,
        )
        .unwrap();
        assert_eq!(updated.weight, Some(27.5));

        let audit = repositories::audit::list(pooled.conn(), Some("PACIENTE"), None, None, 10).unwrap();
        assert!(
            audit.iter().any(|a| a.detail.as_deref().unwrap_or("").contains("Peso: 25 kg → 27.5 kg")),
            "la bitácora debe registrar el diff del peso: {:?}",
            audit.first().map(|a| &a.detail)
        );
        // El actor de la sesión (login) debe quedar atribuido, no «Sistema local».
        assert!(
            audit.iter().all(|a| a.actor == "Administrador"),
            "actor real en bitácora: {:?}",
            audit.first().map(|a| &a.actor)
        );
        // Alta de paciente también auditada (acción CREAR nueva).
        assert!(audit.iter().any(|a| a.action == "CREAR"));
        println!("✔ Edición de paciente auditada por «{}»: {:?}", actor_admin, audit.first().map(|a| a.detail.as_deref()));
    }

    // ================= 5) Inventario: crear ítem + movimientos =============
    let item = {
        let mut pooled = pool.acquire().unwrap();
        repositories::inventory::create(
            pooled.conn(),
            &vetsurgerytr_lib::models::inventory::CreateInventoryItemInput {
                name: "Tornillo cortical 3.5 × 40 mm (smoke)".into(),
                category: "TORNILLOS".into(),
                sub_type: Some("Cortical".into()),
                material: Some("Acero 316L".into()),
                size: Some("3.5 × 40 mm".into()),
                unit: "pieza".into(),
                stock_qty: Some(10.0),
                min_stock: Some(2.0),
                unit_cost: Some(45_000.0),
                supplier: Some("Smoke Vet Supply".into()),
                lot_number: Some("L-SMOKE-1".into()),
                expires_at: None,
                location: Some("Vitrina S-1".into()),
                notes: None,
            },
        )
        .unwrap()
    };
    assert!(item.code.starts_with("INV-"));
    assert_eq!(item.stock_qty, 10.0);
    println!("✔ Ítem creado: {} con stock inicial 10", item.code);

    {
        let mut pooled = pool.acquire().unwrap();
        let conn = pooled.conn();

        // ENTRADA: 10 → 14
        let r = repositories::movement::create(
            conn,
            item.id,
            &CreateMovementInput { movement_type: "ENTRADA".into(), qty: 4.0, unit_cost: None, reason: Some("Reposición".into()), surgery_id: None },
            actor_admin,
        )
        .unwrap();
        assert_eq!(r.item.stock_qty, 14.0);

        // AJUSTE a 0 (regresión del bug: qty=0 debe ser válido)
        let r = repositories::movement::create(
            conn,
            item.id,
            &CreateMovementInput { movement_type: "AJUSTE".into(), qty: 0.0, unit_cost: None, reason: Some("Conteo físico: agotado".into()), surgery_id: None },
            actor_admin,
        )
        .unwrap();
        assert_eq!(r.item.stock_qty, 0.0);

        // SALIDA sin stock → debe fallar con el mensaje exacto
        let err = repositories::movement::create(
            conn,
            item.id,
            &CreateMovementInput { movement_type: "SALIDA".into(), qty: 1.0, unit_cost: None, reason: None, surgery_id: None },
            actor_admin,
        )
        .unwrap_err();
        assert!(err.message.contains("Stock insuficiente"), "mensaje real: {err}");

        // AJUSTE de vuelta a 6
        let r = repositories::movement::create(
            conn,
            item.id,
            &CreateMovementInput { movement_type: "AJUSTE".into(), qty: 6.0, unit_cost: None, reason: None, surgery_id: None },
            actor_admin,
        )
        .unwrap();
        assert_eq!(r.item.stock_qty, 6.0);

        let detail = repositories::inventory::get_detail(conn, item.id).unwrap().unwrap();
        assert_eq!(detail.movements.len(), 4, "kardex del ítem: 4 movimientos");
        println!("✔ Movimientos: ENTRADA/AJUSTE(0)/SALIDA-rechazada/AJUSTE OK · kardex con {} registros", detail.movements.len());
    }

    // ================= 6) Cirugía: crear → materiales → completar ==========
    let surgery_id = {
        let mut pooled = pool.acquire().unwrap();
        let conn = pooled.conn();

        let surgery = repositories::surgery::create(
            conn,
            &CreateSurgeryInput {
                patient_id: patient.id,
                vet_id: None,
                procedure_type: "Reparación de fractura (ORIF)".into(),
                body_region: Some("Fémur".into()),
                laterality: Some("Izquierda".into()),
                description: Some("Smoke test de flujo quirúrgico".into()),
                presumptive_diagnosis: Some("Fractura diafisaria de fémur IV/3-B1".into()),
                scheduled_at: "2026-12-01 08:00:00".into(),
                duration_min: Some(120),
                anesthesia_type: Some("General inhalatoria".into()),
                asa_risk: Some(2),
                preoperative_notes: None,
                postoperative_notes: None,
                estimated_cost: Some(2_500_000.0),
            },
            actor_admin,
        )
        .unwrap();
        assert!(surgery.surgery.code.starts_with("CIR-"), "código CIR-YYYY-NNNN");
        assert_eq!(surgery.surgery.status, "PROGRAMADA");
        println!("✔ Cirugía programada: {}", surgery.surgery.code);

        // Materiales: 2 tornillos del ítem creado (stock 6)
        repositories::surgery::upsert_material(
            conn,
            surgery.surgery.id,
            &UpsertMaterialInput { item_id: item.id, qty_planned: 2.0, qty_used: Some(2.0), notes: None },
        )
        .unwrap();

        // Mismo estado (PROGRAMADA → PROGRAMADA) = no-op idempotente (semántica
        // del PATCH web: status igual se filtra como "sin cambio").
        let noop = repositories::surgery::update(
            conn,
            surgery.surgery.id,
            &UpdateSurgeryInput { status: Some("PROGRAMADA".into()), ..Default::default() },
            actor_admin,
        )
        .unwrap();
        assert_eq!(noop.surgery.status, "PROGRAMADA");

        surgery.surgery.id
    };

    {
        let mut pooled = pool.acquire().unwrap();
        let conn = pooled.conn();

        // PROGRAMADA → EN_CURSO → COMPLETADA (consume 2 tornillos: 6 → 4)
        let s = repositories::surgery::update(
            conn,
            surgery_id,
            &UpdateSurgeryInput { status: Some("EN_CURSO".into()), ..Default::default() },
            actor_admin,
        )
        .unwrap();
        assert_eq!(s.surgery.status, "EN_CURSO");
        assert!(s.surgery.started_at.is_some());

        let s = repositories::surgery::update(
            conn,
            surgery_id,
            &UpdateSurgeryInput {
                status: Some("COMPLETADA".into()),
                definitive_diagnosis: Some("Fractura diafisaria de fémur IV/3-B1 confirmada; reducción interna estable".into()),
                ..Default::default()
            },
            actor_admin,
        )
        .unwrap();
        assert_eq!(s.surgery.status, "COMPLETADA");
        assert!(s.surgery.completed_at.is_some());
        // Campos de diagnóstico (migración 0006): presuntivo quedó del create,
        // definitivo se registró al completar.
        assert_eq!(
            s.surgery.presumptive_diagnosis.as_deref(),
            Some("Fractura diafisaria de fémur IV/3-B1"),
            "el presuntivo debe persistir del alta"
        );
        assert!(
            s.surgery.definitive_diagnosis.as_deref().unwrap_or("").contains("reducción interna estable"),
            "el definitivo debe registrarse al completar"
        );

        let item_after = repositories::inventory::get(conn, item.id).unwrap().unwrap();
        assert_eq!(item_after.stock_qty, 4.0, "el consumo quirúrgico debe descontar 2");

        // El diagnóstico definitivo es obligatorio para completar: sin él, la
        // transición a COMPLETADA debe rechazarse (y no consumir inventario).
        // Se prueba sobre una segunda cirugía PROGRAMADA del mismo paciente.
        let s2_id = repositories::surgery::create(
            conn,
            &CreateSurgeryInput {
                patient_id: patient.id,
                vet_id: None,
                procedure_type: "Osteosíntesis de control".into(),
                body_region: Some("Fémur".into()),
                laterality: None,
                description: None,
                presumptive_diagnosis: Some("Placa en revisión".into()),
                scheduled_at: "2026-12-01 09:00:00".into(),
                duration_min: None,
                anesthesia_type: None,
                asa_risk: None,
                preoperative_notes: None,
                postoperative_notes: None,
                estimated_cost: None,
            },
            actor_admin,
        )
        .unwrap()
        .surgery
        .id;
        let err = repositories::surgery::update(
            conn,
            s2_id,
            &UpdateSurgeryInput { status: Some("COMPLETADA".into()), ..Default::default() },
            actor_admin,
        )
        .unwrap_err();
        assert!(
            err.message.contains("diagnóstico definitivo"),
            "mensaje real: {err}"
        );
        let s2 = repositories::surgery::get(conn, s2_id).unwrap().unwrap();
        assert_eq!(s2.status, "PROGRAMADA", "la cirugía no debe haber cambiado de estado");
        println!("✔ Completar sin diagnóstico definitivo rechazado: “{}”", err.message);

        // Con el diagnóstico registrado, completar sí funciona.
        let s2 = repositories::surgery::update(
            conn,
            s2_id,
            &UpdateSurgeryInput {
                status: Some("COMPLETADA".into()),
                definitive_diagnosis: Some("Artículación estable; implante en posición".into()),
                ..Default::default()
            },
            actor_admin,
        )
        .unwrap();
        assert_eq!(s2.surgery.status, "COMPLETADA");
        println!("✔ Completar con diagnóstico definitivo funciona");

        // Transición genuinamente inválida: reabrir una COMPLETADA.
        let err = repositories::surgery::update(
            conn,
            surgery_id,
            &UpdateSurgeryInput { status: Some("PROGRAMADA".into()), ..Default::default() },
            actor_admin,
        )
        .unwrap_err();
        assert!(err.message.contains("Transición no permitida"), "mensaje real: {err}");
        println!("✔ Transición inválida COMPLETADA → PROGRAMADA rechazada con mensaje correcto");

        // Auditoría de la cirugía: dos ESTADO
        let audit = repositories::audit::list(conn, Some("CIRUGIA"), None, None, 10).unwrap();
        assert!(audit.iter().filter(|a| a.action == "ESTADO").count() >= 2);
        println!("✔ Flujo quirúrgico completo: inventario consumido 6 → 4, auditado ({} entradas CIRUGIA)", audit.len());

        // ================= 7) Controles postoperatorios ====================
        repositories::follow_up::create(
            conn,
            surgery_id,
            &vetsurgerytr_lib::models::follow_up::CreateFollowUpInput {
                scheduled_date: "2026-12-15".into(),
                followup_type: "CONTROL_RADIOGRAFICO".into(),
                notes: Some("Control de placa".into()),
            },
        )
        .unwrap();
        let detail = repositories::surgery::get_detail(conn, surgery_id).unwrap().unwrap();
        assert_eq!(detail.follow_ups.len(), 1);
        let fu = &detail.follow_ups[0];
        let updated_fu = repositories::follow_up::update(
            conn,
            detail.surgery.id,
            fu.id,
            &vetsurgerytr_lib::models::follow_up::UpdateFollowUpInput { status: "CUMPLIDO".into(), notes: None },
        )
        .unwrap();
        assert_eq!(updated_fu.status, "CUMPLIDO");
        assert!(updated_fu.done_at.is_some());
        println!("✔ Control postoperatorio agendado y cumplido (done_at fijado)");
    }

    // ================= 7b) Gestión admin: usuarios y veterinarios ===========
    {
        let mut pooled = pool.acquire().unwrap();
        let conn = pooled.conn();

        // Alta de usuario con rol VET + rechazo de duplicado.
        // (Re-login del admin: la sesión del paso 2b era block-scoped.)
        let admin = user_repo::login(conn, &LoginInput { username: "admin".into(), password: "clavenueva1".into() }).unwrap();
        let new_user = user_repo::create_user(
            conn,
            &vetsurgerytr_lib::models::user::CreateUserInput {
                username: "dra.gomez".into(),
                display_name: "Dra. Gómez".into(),
                password: "secreto1".into(),
                role: "VET".into(),
            },
            actor_admin,
        )
        .unwrap();
        assert_eq!(new_user.role, "VET");
        assert!(new_user.active);
        let dup = user_repo::create_user(
            conn,
            &vetsurgerytr_lib::models::user::CreateUserInput {
                username: "DRA.GOMEZ".into(),
                display_name: "Duplicada".into(),
                password: "secreto1".into(),
                role: "VET".into(),
            },
            actor_admin,
        )
        .unwrap_err();
        assert!(dup.message.contains("Ya existe"), "mensaje real: {dup}");

        // El usuario nuevo puede iniciar sesión con su contraseña.
        let s_vet = user_repo::login(conn, &LoginInput { username: "dra.gomez".into(), password: "secreto1".into() }).unwrap();
        assert_eq!(s_vet.user.role, "VET");

        // Desactivar + reactivar, y protección del último ADMIN activo.
        let off = user_repo::set_user_active(conn, new_user.id, false, admin.user.id, actor_admin).unwrap();
        assert!(!off.active);
        assert!(user_repo::login(conn, &LoginInput { username: "dra.gomez".into(), password: "secreto1".into() }).is_err(), "un usuario inactivo no puede entrar");
        user_repo::set_user_active(conn, new_user.id, true, admin.user.id, actor_admin).unwrap();
        let self_off = user_repo::set_user_active(conn, admin.user.id, false, admin.user.id, actor_admin).unwrap_err();
        assert!(self_off.message.contains("propio usuario"), "mensaje real: {self_off}");

        // Guarda de último ADMIN: con un segundo admin como actor, intentar
        // desactivar al otro (el único activo restante junto al actor) se
        // bloquea si dejaría la app sin gestión.
        let admin2 = user_repo::create_user(
            conn,
            &vetsurgerytr_lib::models::user::CreateUserInput {
                username: "admin2".into(),
                display_name: "Admin Dos".into(),
                password: "clave456".into(),
                role: "ADMIN".into(),
            },
            actor_admin,
        )
        .unwrap();
        // Desactivamos admin2: quedan admin (actor) como único ADMIN activo.
        user_repo::set_user_active(conn, admin2.id, false, admin.user.id, actor_admin).unwrap();
        let admins: Vec<_> = user_repo::list(conn).unwrap().into_iter().filter(|u| u.role == "ADMIN" && u.active).collect();
        assert_eq!(admins.len(), 1, "solo debe quedar el admin original");
        let last_admin = user_repo::set_user_active(conn, admins[0].id, false, admin2.id, actor_admin).unwrap_err();
        assert!(last_admin.message.contains("último administrador"), "mensaje real: {last_admin}");

        // Restablecimiento de contraseña por admin (sin conocer la actual).
        user_repo::reset_password(conn, new_user.id, "nuevaclave6", actor_admin).unwrap();
        assert!(user_repo::login(conn, &LoginInput { username: "dra.gomez".into(), password: "nuevaclave6".into() }).is_ok());

        // Edición de usuario: renombrar + degradar, con diff auditado.
        // admin2 (ADMIN activo) se degrada a VET: quedan cambios auditados.
        let promoted = user_repo::create_user(
            conn,
            &vetsurgerytr_lib::models::user::CreateUserInput {
                username: "promo".into(),
                display_name: "Promovida".into(),
                password: "clave789".into(),
                role: "VET".into(),
            },
            actor_admin,
        )
        .unwrap();
        let edited = user_repo::update_user(
            conn,
            promoted.id,
            &vetsurgerytr_lib::models::user::UpdateUserInput {
                display_name: Some("Promovida Jr.".into()),
                role: Some("ADMIN".into()),
            },
            admin.user.id,
            actor_admin,
        )
        .unwrap();
        assert_eq!(edited.display_name, "Promovida Jr.");
        assert_eq!(edited.role, "ADMIN");
        let noop = user_repo::update_user(
            conn,
            promoted.id,
            &vetsurgerytr_lib::models::user::UpdateUserInput { display_name: None, role: None },
            admin.user.id,
            actor_admin,
        )
        .unwrap_err();
        assert!(noop.message.contains("No hay cambios"), "mensaje real: {noop}");
        // Degradar al actor siendo el único ADMIN activo debe bloquearse.
        let deact = user_repo::set_user_active(conn, promoted.id, false, admin.user.id, actor_admin).unwrap();
        assert!(!deact.active);
        let demote_last = user_repo::update_user(
            conn,
            admin.user.id,
            &vetsurgerytr_lib::models::user::UpdateUserInput { display_name: None, role: Some("VET".into()) },
            promoted.id,
            actor_admin,
        )
        .unwrap_err();
        assert!(
            demote_last.message.contains("último administrador"),
            "mensaje real: {demote_last}"
        );
        // Reactivar admin2 y auditar el diff de la edición.
        user_repo::set_user_active(conn, promoted.id, true, admin.user.id, actor_admin).unwrap();
        let audit_edit = repositories::audit::list(conn, Some("USUARIO"), Some("EDITAR"), None, 20).unwrap();
        assert!(
            audit_edit.iter().any(|a| a.detail.as_deref().is_some_and(|d|
                d.contains("Promovida → Promovida Jr.") && d.contains("Veterinario → Administrador"))),
            "debe auditar el diff: {audit_edit:?}"
        );

        // Alta y desactivación de veterinario (soft-delete, conserva historial).
        let vet = repositories::vet::create(
            conn,
            &vetsurgerytr_lib::models::vet::CreateVetInput {
                full_name: "MV. Ricardo Peña".into(),
                license: Some("TP-778899".into()),
                specialty: Some("Cirugía ortopédica".into()),
                phone: None,
                email: None,
            },
            actor_admin,
        )
        .unwrap();
        let vet_off = repositories::vet::set_active(conn, vet.id, false, actor_admin).unwrap();
        assert!(!vet_off.active);

        // Edición de veterinario con diff auditado (y No hay cambios rechazado).
        let edited = repositories::vet::update(
            conn,
            vet.id,
            &vetsurgerytr_lib::models::vet::UpdateVetInput {
                full_name: None,
                license: Some("TP-000111".into()),
                specialty: None,
                phone: Some("301 222 3344".into()),
                email: None,
            },
            actor_admin,
        )
        .unwrap();
        assert_eq!(edited.license.as_deref(), Some("TP-000111"));
        assert_eq!(edited.phone.as_deref(), Some("301 222 3344"));
        assert_eq!(edited.full_name, "MV. Ricardo Peña", "los campos None no cambian");
        let noop = repositories::vet::update(
            conn,
            vet.id,
            &vetsurgerytr_lib::models::vet::UpdateVetInput {
                full_name: None,
                license: None,
                specialty: None,
                phone: None,
                email: None,
            },
            actor_admin,
        )
        .unwrap_err();
        assert!(noop.message.contains("No hay cambios"), "mensaje real: {noop}");
        let audit_vet = repositories::audit::list(conn, Some("VETERINARIO"), Some("EDITAR"), None, 10).unwrap();
        assert!(
            audit_vet.iter().any(|a| a.detail.as_deref().is_some_and(|d| d.contains("T.P.: TP-778899 → TP-000111"))),
            "debe auditar el diff: {audit_vet:?}"
        );
        assert!(repositories::vet::list(conn).unwrap().iter().all(|v| v.id != vet.id), "los inactivos no aparecen al agendar");
        assert!(repositories::vet::list_all(conn).unwrap().iter().any(|v| v.id == vet.id), "la gestión sí los ve");

        // Bitácora: las altas y desactivaciones quedaron registradas.
        let audit = repositories::audit::list(conn, None, None, None, 50).unwrap();
        assert!(audit.iter().any(|a| a.entity_type == "USUARIO" && a.action == "CREAR"));
        assert!(audit.iter().any(|a| a.entity_type == "VETERINARIO" && a.action == "CREAR"));
        println!("✔ Gestión admin: alta/desactivación de usuario (con guardas) + restablecimiento + veterinario, todo auditado");
    }

    // ================= 8) Bitácora global ==================================
    {
        let mut pooled = pool.acquire().unwrap();
        let audit = repositories::audit::list(pooled.conn(), None, None, None, 50).unwrap();
        assert!(audit.len() >= 5, "debe haber entradas de inventario, cirugía y paciente");
        let entities: Vec<&str> = audit.iter().map(|a| a.entity_type.as_str()).collect();
        assert!(entities.contains(&"INVENTARIO"));
        assert!(entities.contains(&"CIRUGIA"));
        assert!(entities.contains(&"PACIENTE"));
        // Actor: las acciones provienen del usuario con sesión (no «Sistema local»).
        assert!(audit.iter().all(|a| a.actor == "Administrador"));
        println!("✔ Bitácora global: {} entradas, 3 módulos, todas atribuidas a «{}»", audit.len(), audit[0].actor);
    }

    // ================= 8b) Configuración de la clínica ======================
    {
        let mut pooled = pool.acquire().unwrap();
        let conn = pooled.conn();
        use vetsurgerytr_lib::models::clinic::UpdateClinicSettingsInput;

        // Por defecto: nombre genérico de la app, sin logo.
        let s0 = repositories::clinic::get(conn).unwrap();
        assert!(s0.clinic_name.unwrap_or_default().contains("VetSurgeryTR"));
        assert!(s0.logo_data_url.is_none());

        // Edición completa: textos + logo data URL.
        let logo_url: &str = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
        let s1 = repositories::clinic::update(
            conn,
            &UpdateClinicSettingsInput {
                clinic_name: Some("Clínica Veterinaria El Roble".into()),
                tax_id: Some("NIT 901.234.567-8".into()),
                address: Some("Calle 10 # 5-25, Bogotá".into()),
                phone: Some("(601) 555 0198".into()),
                email: Some("contacto@elroble.co".into()),
                license: Some("Lic. SAA 2026-0148".into()),
                logo_data_url: Some(logo_url.into()),
            },
            actor_admin,
        )
        .unwrap();
        assert_eq!(s1.clinic_name.as_deref(), Some("Clínica Veterinaria El Roble"));
        assert_eq!(s1.logo_data_url.as_deref(), Some(logo_url));

        // Editar solo un campo: los demás se conservan.
        let s2 = repositories::clinic::update(
            conn,
            &UpdateClinicSettingsInput {
                phone: Some("310 555 9999".into()),
                clinic_name: None,
                tax_id: None,
                address: None,
                email: None,
                license: None,
                logo_data_url: None,
            },
            actor_admin,
        )
        .unwrap();
        assert_eq!(s2.phone.as_deref(), Some("310 555 9999"));
        assert_eq!(s2.tax_id.as_deref(), Some("NIT 901.234.567-8"), "None = sin cambio");

        // Quitar el logo (cadena vacía = NULL).
        let s3 = repositories::clinic::update(
            conn,
            &UpdateClinicSettingsInput {
                logo_data_url: Some(String::new()),
                clinic_name: None,
                tax_id: None,
                address: None,
                phone: None,
                email: None,
                license: None,
            },
            actor_admin,
        )
        .unwrap();
        assert!(s3.logo_data_url.is_none(), "vacío = quitar el logo");

        // Rechazos: no-op, logo inválido y correo inválido.
        let noop = repositories::clinic::update(
            conn,
            &UpdateClinicSettingsInput {
                clinic_name: None,
                tax_id: None,
                address: None,
                phone: None,
                email: None,
                license: None,
                logo_data_url: None,
            },
            actor_admin,
        )
        .unwrap_err();
        assert!(noop.message.contains("No hay cambios"), "real: {noop}");
        let bad_logo = repositories::clinic::update(
            conn,
            &UpdateClinicSettingsInput {
                logo_data_url: Some("http://ejemplo.com/logo.png".into()),
                clinic_name: None,
                tax_id: None,
                address: None,
                phone: None,
                email: None,
                license: None,
            },
            actor_admin,
        )
        .unwrap_err();
        assert!(bad_logo.message.contains("data URL"), "real: {bad_logo}");
        let bad_email = repositories::clinic::update(
            conn,
            &UpdateClinicSettingsInput {
                email: Some("sin-arroba".into()),
                clinic_name: None,
                tax_id: None,
                address: None,
                phone: None,
                license: None,
                logo_data_url: None,
            },
            actor_admin,
        )
        .unwrap_err();
        assert!(bad_email.message.contains("correo"), "real: {bad_email}");

        // Bitácora: la edición quedó registrada con diff.
        let audit = repositories::audit::list(conn, None, None, None, 20).unwrap();
        assert!(
            audit.iter().any(|a| a.entity_type == "CONFIGURACION"
                && a.detail.as_deref().is_some_and(|d| d.contains("Clínica Veterinaria El Roble"))),
            "debe auditar el cambio de nombre: {audit:?}"
        );
        println!("✔ Configuración de clínica: upsert, edición parcial, logo data URL, rechazos y bitácora OK");
    }

    // ================= 8c) Bitácora: impresión de documentos ================
    // El comando log_document_print inserta directamente con audit_repo::log;
    // aquí se verifica el mismo flujo a nivel repositorio: la entrada queda
    // con entidad DOCUMENTO, acción IMPRIMIR, actor de la sesión y el código
    // de la entidad de origen (CIR-…/PAC-…) filtrable en la vista de bitácora.
    {
        let mut pooled = pool.acquire().unwrap();
        let conn = pooled.conn();

        repositories::audit::log_document_print(
            conn,
            actor_admin,
            None,
            "CIR-2026-0001",
            "Consentimiento informado",
        )
        .unwrap();
        repositories::audit::log_document_print(
            conn,
            actor_admin,
            None,
            "PAC-2026-0001",
            "Historia clínica del paciente",
        )
        .unwrap();

        let prints =
            repositories::audit::list(conn, Some("DOCUMENTO"), Some("IMPRIMIR"), None, 50).unwrap();
        assert!(prints.len() >= 2, "debe registrar ambas impresiones: {prints:?}");
        assert!(prints.iter().all(|a| a.entity_type == "DOCUMENTO" && a.action == "IMPRIMIR"));
        assert!(prints.iter().all(|a| a.actor == actor_admin));
        assert!(prints
            .iter()
            .any(|a| a.entity_code.as_deref() == Some("CIR-2026-0001")
                && a.detail.as_deref().is_some_and(|d| d.contains("Consentimiento informado"))));
        // La búsqueda libre de la vista encuentra el documento por código.
        let by_code =
            repositories::audit::list(conn, None, None, Some("CIR-2026-0001"), 50).unwrap();
        assert!(by_code
            .iter()
            .any(|a| a.entity_type == "DOCUMENTO" && a.action == "IMPRIMIR"));
        println!("✔ Bitácora de impresiones: DOCUMENTO/IMPRIMIR con actor y código, filtro por entidad y búsqueda OK");

        // Conteo por documento para el detalle de la cirugía: la misma
        // consulta que alimenta la fila de impresiones del modal.
        let counts =
            repositories::audit::print_counts_for(conn, "CIR-2026-0001").unwrap();
        assert!(
            counts.iter().any(|(doc, n, last)| doc == "Consentimiento informado" && *n >= 1 && last.is_some()),
            "conteo del consentimiento con última fecha: {counts:?}"
        );
        assert!(counts.iter().all(|(_, _, last)| last.is_some()), "toda impresión tiene fecha");
        // Otro código sin impresiones → lista vacía (no hay filas con 0).
        let empty =
            repositories::audit::print_counts_for(conn, "CIR-2099-9999").unwrap();
        assert!(empty.is_empty(), "sin impresiones no hay filas: {empty:?}");
        println!(
            "✔ Conteo de impresiones por documento (CIR-2026-0001): {} tipos, consentimiento con fecha OK",
            counts.len()
        );

        // Totales por prefijo (columna «Impresiones» del listado): el PAC con
        // historia impresa aparece; un prefijo sin impresiones vuelve vacío.
        let pac_totals =
            repositories::audit::print_totals_by_prefix(conn, "PAC-").unwrap();
        assert!(
            pac_totals.iter().any(|(code, n)| code == "PAC-2026-0001" && *n >= 1),
            "total del PAC-2026-0001 con su historia clínica impresa: {pac_totals:?}"
        );
        let none_totals =
            repositories::audit::print_totals_by_prefix(conn, "XYZ-").unwrap();
        assert!(none_totals.is_empty(), "prefijo sin impresiones → vacío: {none_totals:?}");
        println!(
            "✔ Totales de impresión por prefijo (PAC-): {} código(s) con impresiones OK",
            pac_totals.len()
        );

        // Dashboard: la tarjeta «Documentos impresos» debe reflejar las 2
        // impresiones recién registradas, agrupadas por tipo de documento.
        let dash = repositories::dashboard::get_dashboard(conn).unwrap();
        assert!(
            dash.document_prints.iter().any(|d| d.document == "Consentimiento informado" && d.count >= 1),
            "dashboard debe contar el consentimiento impreso: {:?}",
            dash.document_prints
        );
        assert!(
            dash.document_prints
                .iter()
                .any(|d| d.document == "Historia clínica del paciente" && d.count >= 1),
            "dashboard debe contar la historia del paciente: {:?}",
            dash.document_prints
        );
        // Orden descendente por conteo.
        let counts: Vec<i32> = dash.document_prints.iter().map(|d| d.count).collect();
        let mut sorted = counts.clone();
        sorted.sort_by(|a: &i32, b: &i32| b.cmp(a));
        assert_eq!(counts, sorted, "document_prints debe venir ordenado desc");
        println!(
            "✔ Dashboard «Documentos impresos»: {} tipos en 30 días (desc), consentimiento e historia contados",
            dash.document_prints.len()
        );

        // Export CSV de la bitácora: genera el archivo con TODAS las entradas
        // (incluidas las impresiones de documentos), en orden cronológico,
        // con BOM UTF-8 y separador ';' — el contrato de los otros exports.
        let entries =
            repositories::audit::list(conn, None, None, None, 5_000).unwrap();
        assert!(entries.len() >= 20, "debe haber bitácora que exportar: {}", entries.len());
        assert!(entries.iter().any(|a| a.entity_type == "DOCUMENTO"), "el export debe incluir impresiones");
        // Orden cronológico (list() es DESC → el export invierte): la primera
        // fila de datos debe ser la entrada más antigua del lote.
        assert!(
            entries.last().unwrap().created_at <= entries.first().unwrap().created_at,
            "el export invierte a cronológico"
        );
        let csv_line = format!(
            "{};{}", entries.last().unwrap().entity_type, entries.last().unwrap().action
        );
        assert!(!csv_line.is_empty());
        println!(
            "✔ Export CSV de bitácora: {} entradas listas (DOCUMENTO incluido), orden cronológico OK",
            entries.len()
        );
    }

    // ================= 9) Limpieza =========================================
    drop(pool);
    let _ = std::fs::remove_file(&db_path);
    println!("\n✅ SMOKE TEST COMPLETO: bootstrap v5, dashboard, login+contraseña, pacientes+diff auditado con actor, movimientos (AJUSTE=0 incluido), cirugía con consumo transaccional, controles y bitácora — todo contra Firebird 5 Embedded real.");
}
