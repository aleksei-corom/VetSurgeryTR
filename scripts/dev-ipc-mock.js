// VetSurgeryTR · Mock de IPC para verificación visual en navegador.
// El ipc.ts usa invoke() de @tauri-apps/api/core, que delega en
// window.__TAURI_INTERNALS__.invoke — aquí lo sustituimos por un stub con
// datos de demostración y la misma semántica de negocio (stock, auditoría).
// Solo se carga manualmente en el navegador: la app empaquetada nunca lo ve.
(function () {
  if (window.__VST_MOCK__) return;
  window.__VST_MOCK__ = true;

  const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");

  const adminSession = {
    user: { id: 1, username: "admin", displayName: "Administrador", role: "ADMIN", active: true },
    loggedInAt: now(),
  };

  // Detalle mutable de la cirugía creada en el navegador (create_surgery).
  let mockSurgeryDetail = null;

  const items = [
    {
      id: 1, code: "INV-0001", name: "Platina LCP 3.5 mm 5 agujeros", category: "PLACAS",
      subType: "LCP 3.5", material: "Titanio", size: "96 mm", unit: "pie",
      stockQty: 2, minStock: 4, unitCost: 420000, supplier: "OrtopedVet",
      lotNumber: "L-2026-118", expiresAt: null, location: "Gaveta A1", active: true,
      notes: null, createdAt: "2026-01-12 10:00:00", updatedAt: "2026-09-01 15:30:00",
    },
    {
      id: 2, code: "INV-0002", name: "Tornillo cortical 3.5×40 mm", category: "TORNILLOS",
      subType: "Cortical 3.5", material: "Titanio", size: "40 mm", unit: "pie",
      stockQty: 6, minStock: 10, unitCost: 38000, supplier: "OrtopedVet",
      lotNumber: "L-2026-119", expiresAt: null, location: "Gaveta A2", active: true,
      notes: null, createdAt: "2026-01-12 10:00:00", updatedAt: "2026-09-05 09:00:00",
    },
    {
      id: 3, code: "INV-0003", name: "Sutura Vycril 2-0", category: "SUTURAS",
      subType: "Vycril 2-0", material: "PoliGlactina 910", size: "2-0", unit: "rollo",
      stockQty: 25, minStock: 10, unitCost: 9500, supplier: "VetSupply",
      lotNumber: "L-2026-204", expiresAt: "2027-06-30", location: "Anaquel B", active: true,
      notes: null, createdAt: "2026-02-03 11:00:00", updatedAt: "2026-08-20 12:00:00",
    },
  ];

  const movements = [
    {
      id: 12, itemId: 2, type: "SALIDA", qty: 2, stockAfter: 6, unitCost: null,
      reason: "Consumo cirugía CIR-2026-0003", surgeryId: 1, surgeryCode: "CIR-2026-0003",
      patientName: "Rocky", createdAt: "2026-09-11 09:20:44",
      item: { id: 2, code: "INV-0002", name: "Tornillo cortical 3.5×40 mm", unit: "pie" },
    },
    {
      id: 11, itemId: 1, type: "AJUSTE", qty: 2, stockAfter: 2, unitCost: null,
      reason: "Conteo físico", surgeryId: null, createdAt: "2026-09-10 17:03:00",
      item: { id: 1, code: "INV-0001", name: "Platina LCP 3.5 mm 5 agujeros", unit: "pie" },
    },
  ];

  const audit = [
    {
      id: 9, entityType: "USUARIO", entityId: 1, entityCode: "admin", action: "EDITAR",
      detail: "Cambió su propia contraseña", actor: "Administrador", createdAt: "2026-09-11 10:45:12",
    },
    {
      id: 8, entityType: "CIRUGIA", entityId: 1, entityCode: "CIR-2026-0003", action: "ESTADO",
      detail: "Estado: EN_CURSO → COMPLETADA (inventario consumido)", actor: "Administrador",
      createdAt: "2026-09-11 09:20:44",
    },
    {
      id: 7, entityType: "INVENTARIO", entityId: 2, entityCode: "INV-0002", action: "SALIDA",
      detail: "Tornillo cortical 3.5×40 mm: −2 pie → stock 6 · Consumo cirugía CIR-2026-0003",
      actor: "Administrador", createdAt: "2026-09-11 09:20:44",
    },
    {
      id: 6, entityType: "PACIENTE", entityId: 3, entityCode: "PAC-2026-0002", action: "EDITAR",
      detail: "Peso: 25 kg → 27.5 kg", actor: "Administrador", createdAt: "2026-09-10 16:12:09",
    },
    {
      id: 5, entityType: "INVENTARIO", entityId: 1, entityCode: "INV-0001", action: "AJUSTE",
      detail: "Platina LCP 3.5 mm: ajuste a 2 pie → stock 2 · Conteo físico",
      actor: "Administrador", createdAt: "2026-09-10 17:03:00",
    },
  ];

  let sessionActive = false;
  /** Sesión del usuario activo: admin o un VET para probar la vista oculta. */
  let currentUser = adminSession;

  const users = [
    { id: 1, username: "admin", displayName: "Administrador", role: "ADMIN", active: true },
    { id: 2, username: "dra.gomez", displayName: "Dra. Gómez", role: "VET", active: true },
  ];

  const vets = [
    {
      id: 1, fullName: "MV. Ana Restrepo", license: "TP-112233", specialty: "Cirugía ortopédica",
      phone: "310 555 1212", email: "ana@clinica.co", active: true, createdAt: "2026-01-12 10:00:00",
    },
    {
      id: 2, fullName: "MV. Carlos Mendoza", license: "TP-445566", specialty: null,
      phone: null, email: null, active: false, createdAt: "2026-02-03 14:20:00",
    },
  ];

  const handlers = {
    // ---- Sesión (con estado: login/logout persisten durante la sesión del navegador) ----
    get_session: () => Promise.resolve(sessionActive ? currentUser : null),
    login: (args) => {
      const { username, password } = (args && args.input) || {};
      const u = users.find((x) => x.username === username && x.active);
      // Contraseñas de demostración: admin/admin123 y dra.gomez/vet1234.
      const ok = u && ((u.role === "ADMIN" && password === "admin123") || (u.role === "VET" && password === "vet1234"));
      if (ok) {
        sessionActive = true;
        currentUser = { user: u, loggedInAt: now() };
        return Promise.resolve(currentUser);
      }
      return Promise.reject({ data: "Usuario o contraseña incorrectos" });
    },
    change_password: (args) => {
      const i = (args && args.input) || {};
      if (i.currentPassword !== "admin123") {
        return Promise.reject({ data: "La contraseña actual es incorrecta" });
      }
      return Promise.resolve(undefined);
    },
    logout: () => {
      sessionActive = false;
      currentUser = adminSession;
      return Promise.resolve(undefined);
    },

    // ---- Gestión admin: usuarios y veterinarios ----
    list_users: () => {
      if (currentUser.user.role !== "ADMIN") {
        return Promise.reject({ data: "Solo los administradores pueden gestionar usuarios y veterinarios" });
      }
      return Promise.resolve(users);
    },
    create_user: (args) => {
      if (currentUser.user.role !== "ADMIN") {
        return Promise.reject({ data: "Solo los administradores pueden gestionar usuarios y veterinarios" });
      }
      const i = (args && args.input) || {};
      if (users.some((u) => u.username.toLowerCase() === String(i.username).toLowerCase())) {
        return Promise.reject({ data: "Ya existe un usuario «" + i.username + "»" });
      }
      const u = {
        id: users.length + 1,
        username: i.username,
        displayName: i.displayName,
        role: i.role,
        active: true,
      };
      users.push(u);
      audit.unshift({
        id: Date.now(), entityType: "USUARIO", entityId: u.id, entityCode: u.username,
        action: "CREAR", detail: "Alta de usuario " + u.username + " (" + u.displayName + ") con rol " + u.role,
        actor: currentUser.user.displayName, createdAt: now(),
      });
      return Promise.resolve(u);
    },
    set_user_active: (args) => {
      if (currentUser.user.role !== "ADMIN") {
        return Promise.reject({ data: "Solo los administradores pueden gestionar usuarios y veterinarios" });
      }
      const u = users.find((x) => x.id === args.userId);
      if (!u) return Promise.reject({ data: "Usuario no encontrado" });
      if (u.id === currentUser.user.id && !args.active) {
        return Promise.reject({ data: "No puedes desactivar tu propio usuario (cierra sesión en su lugar)" });
      }
      if (u.active === args.active) {
        return Promise.reject({ data: args.active ? "El usuario ya está activo" : "El usuario ya está inactivo" });
      }
      if (!args.active && u.role === "ADMIN" && !users.some((x) => x.role === "ADMIN" && x.active && x.id !== u.id)) {
        return Promise.reject({ data: "No se puede desactivar el último administrador activo" });
      }
      u.active = args.active;
      audit.unshift({
        id: Date.now(), entityType: "USUARIO", entityId: u.id, entityCode: u.username,
        action: "EDITAR",
        detail: (args.active ? "Activó al usuario " : "Desactivó al usuario ") + u.username + " (" + u.displayName + ")",
        actor: currentUser.user.displayName, createdAt: now(),
      });
      return Promise.resolve(u);
    },
    reset_user_password: (args) => {
      if (currentUser.user.role !== "ADMIN") {
        return Promise.reject({ data: "Solo los administradores pueden gestionar usuarios y veterinarios" });
      }
      const u = users.find((x) => x.id === args.userId);
      if (!u) return Promise.reject({ data: "Usuario no encontrado" });
      audit.unshift({
        id: Date.now(), entityType: "USUARIO", entityId: u.id, entityCode: u.username,
        action: "EDITAR", detail: "Restableció la contraseña de " + u.username + " (" + u.displayName + ")",
        actor: currentUser.user.displayName, createdAt: now(),
      });
      return Promise.resolve(undefined);
    },
    list_vets: () => Promise.resolve(vets.filter((v) => v.active)),
    list_all_vets: () => {
      if (currentUser.user.role !== "ADMIN") {
        return Promise.reject({ data: "Solo los administradores pueden gestionar veterinarios" });
      }
      return Promise.resolve(vets);
    },
    create_vet: (args) => {
      if (currentUser.user.role !== "ADMIN") {
        return Promise.reject({ data: "Solo los administradores pueden gestionar veterinarios" });
      }
      const i = (args && args.input) || {};
      const v = {
        id: vets.length + 1,
        fullName: i.fullName,
        license: i.license ?? null,
        specialty: i.specialty ?? null,
        phone: i.phone ?? null,
        email: i.email ?? null,
        active: true,
        createdAt: now(),
      };
      vets.push(v);
      audit.unshift({
        id: Date.now(), entityType: "VETERINARIO", entityId: v.id, entityCode: null,
        action: "CREAR",
        detail: "Alta de veterinario: " + v.fullName + (v.license ? " · T.P. " + v.license : ""),
        actor: currentUser.user.displayName, createdAt: now(),
      });
      return Promise.resolve(v);
    },
    update_vet: (args) => {
      if (currentUser.user.role !== "ADMIN") {
        return Promise.reject({ data: "Solo los administradores pueden gestionar veterinarios" });
      }
      const v = vets.find((x) => x.id === args.vetId);
      if (!v) return Promise.reject({ data: "Veterinario no encontrado" });
      const i = args.input || {};
      const clean = (s) => { const t = String(s ?? "").trim(); return t === "" ? null : t; };
      const fullName = i.fullName !== undefined ? String(i.fullName).trim() : v.fullName;
      if (!fullName) return Promise.reject({ data: "el nombre completo es requerido" });
      const license = i.license !== undefined ? clean(i.license) : v.license;
      const specialty = i.specialty !== undefined ? clean(i.specialty) : v.specialty;
      const phone = i.phone !== undefined ? clean(i.phone) : v.phone;
      const email = i.email !== undefined ? clean(i.email) : v.email;
      if (fullName === v.fullName && license === v.license && specialty === v.specialty && phone === v.phone && email === v.email) {
        return Promise.reject({ data: "No hay cambios por guardar" });
      }
      const changes = [];
      if (fullName !== v.fullName) changes.push("Nombre: " + v.fullName + " → " + fullName);
      [["T.P.", v.license, license], ["Especialidad", v.specialty, specialty], ["Teléfono", v.phone, phone], ["Correo", v.email, email]]
        .forEach(([label, a, b]) => { if (a !== b) changes.push(label + ": " + (a || "—") + " → " + (b || "—")); });
      const before = v.fullName;
      Object.assign(v, { fullName, license, specialty, phone, email });
      audit.unshift({
        id: Date.now(), entityType: "VETERINARIO", entityId: v.id, entityCode: null,
        action: "EDITAR", detail: "Editó a " + before + ": " + changes.join(" · "),
        actor: currentUser.user.displayName, createdAt: now(),
      });
      return Promise.resolve(v);
    },
    set_vet_active: (args) => {
      if (currentUser.user.role !== "ADMIN") {
        return Promise.reject({ data: "Solo los administradores pueden gestionar veterinarios" });
      }
      const v = vets.find((x) => x.id === args.vetId);
      if (!v) return Promise.reject({ data: "Veterinario no encontrado" });
      if (v.active === args.active) {
        return Promise.reject({ data: args.active ? "El veterinario ya está activo" : "El veterinario ya está inactivo" });
      }
      v.active = args.active;
      audit.unshift({
        id: Date.now(), entityType: "VETERINARIO", entityId: v.id, entityCode: null,
        action: "EDITAR",
        detail: (args.active ? "Activó al veterinario " : "Desactivó al veterinario ") + v.fullName,
        actor: currentUser.user.displayName, createdAt: now(),
      });
      return Promise.resolve(v);
    },

    // ---- Estado de BD ----
    db_status: () =>
      Promise.resolve({
        ok: true,
        initError: null,
        dbPath: "C:\\Users\\WinterOS\\AppData\\Roaming\\com.vetsurgerytr.app\\VETSURGERYTR.FDB",
        fbclientPath: "D:\\Proyectos\\VetSurgeryTR\\src-tauri\\binaries\\firebird\\fbclient.dll",
        schemaVersion: 5,
      }),

    // ---- Dashboard ----
    get_dashboard: () =>
      Promise.resolve({
        stats: {
          patientsActive: 6,
          surgeriesScheduled: 1,
          surgeriesInProgress: 0,
          surgeriesCompletedMonth: 2,
          lowStockCount: 2,
          followUpsDue: 3,
          inventoryValue: 1500000,
        },
        upcomingSurgeries: [],
        lowStockItems: [items[0], items[1]],
        followUpsDueList: [],
        monthlySurgeries: [
          { month: "2026-04", count: 1 },
          { month: "2026-05", count: 2 },
          { month: "2026-06", count: 0 },
          { month: "2026-07", count: 3 },
          { month: "2026-08", count: 1 },
          { month: "2026-09", count: 2 },
        ],
        categoryDistribution: [
          { category: "PLACAS", count: 8 },
          { category: "TORNILLOS", count: 14 },
          { category: "SUTURAS", count: 6 },
          { category: "INSTRUMENTAL", count: 9 },
        ],
        documentPrints: [
          { document: "Consentimiento informado", count: 4 },
          { document: "Fórmula médica postquirúrgica", count: 3 },
          { document: "Historia clínica quirúrgica", count: 2 },
          { document: "Historia clínica del paciente", count: 1 },
        ],
      }),

    // ---- Inventario ----
    list_inventory_items: () => Promise.resolve(items),
    get_inventory_item: (args) => {
      const id = args && args.id;
      const item = items.find((i) => i.id === id);
      if (!item) return Promise.resolve(null);
      return Promise.resolve({
        item,
        movements: movements.filter((m) => m.itemId === id),
      });
    },
    create_inventory_item: (args) => {
      const i = (args && args.input) || {};
      const item = {
        id: items.length + 1,
        code: "INV-000" + (items.length + 1),
        name: i.name,
        category: i.category,
        subType: i.subType ?? null,
        material: i.material ?? null,
        size: i.size ?? null,
        unit: i.unit,
        stockQty: i.stockQty ?? 0,
        minStock: i.minStock ?? 0,
        unitCost: i.unitCost ?? null,
        supplier: i.supplier ?? null,
        lotNumber: i.lotNumber ?? null,
        expiresAt: i.expiresAt ?? null,
        location: i.location ?? null,
        active: i.active ?? true,
        notes: i.notes ?? null,
        createdAt: now(),
        updatedAt: now(),
      };
      items.push(item);
      audit.unshift({
        id: Date.now(), entityType: "INVENTARIO", entityId: item.id, entityCode: item.code,
        action: "CREAR", detail: "Alta de material: " + item.name, actor: "Administrador", createdAt: now(),
      });
      return Promise.resolve(item);
    },
    update_inventory_item: (args) => {
      const item = items.find((x) => x.id === (args && args.id));
      if (!item) return Promise.reject({ data: "Ítem no encontrado" });
      Object.assign(item, args.input);
      item.updatedAt = now();
      audit.unshift({
        id: Date.now(), entityType: "INVENTARIO", entityId: item.id, entityCode: item.code,
        action: "EDITAR", detail: "Editó ficha del material", actor: "Administrador", createdAt: now(),
      });
      return Promise.resolve(item);
    },
    create_movement: (args) => {
      const itemId = args.itemId;
      const input = args.input || {};
      const item = items.find((i) => i.id === itemId);
      if (!item) return Promise.reject({ data: "Ítem no encontrado" });

      const stock = item.stockQty;
      let newStock;
      if (input.type === "ENTRADA") newStock = stock + input.qty;
      else if (input.type === "SALIDA") {
        if (input.qty > stock) {
          return Promise.reject({
            data: "Stock insuficiente: disponible " + stock + ", requerido " + input.qty,
          });
        }
        newStock = stock - input.qty;
      } else {
        newStock = input.qty; // AJUSTE: fija el valor contado
      }
      item.stockQty = newStock;
      item.updatedAt = now();

      const mv = {
        id: Date.now(), itemId, type: input.type, qty: input.qty, stockAfter: newStock,
        unitCost: input.unitCost ?? null, reason: input.reason ?? null, surgeryId: null,
        createdAt: now(),
        item: { id: item.id, code: item.code, name: item.name, unit: item.unit },
      };
      movements.unshift(mv);
      audit.unshift({
        id: Date.now(), entityType: "INVENTARIO", entityId: itemId, entityCode: item.code,
        action: input.type,
        detail:
          item.name + ": " +
          (input.type === "AJUSTE" ? "ajuste a " : input.type === "ENTRADA" ? "+ " : "− ") +
          input.qty + " " + item.unit + " → stock " + newStock +
          (input.reason ? " · " + input.reason : ""),
        actor: "Administrador", createdAt: mv.createdAt,
      });
      return Promise.resolve({ movement: mv, item: Object.assign({}, item) });
    },
    list_movements: () => Promise.resolve(movements),

    // ---- Bitácora ----
    export_audit_csv: () => Promise.resolve("C:/demo/bitacora-demo.csv"),
    get_clinic_settings: () => Promise.resolve({
      name: "Clínica Veterinaria Demo",
      address: "Calle 10 #25-30, Bogotá",
      phone: "601 555 0123",
      license: "T.P. 12345 - LM 98765",
      logoDataUrl: null,
    }),
    update_clinic_settings: () => Promise.resolve({
      name: "Clínica Veterinaria Demo",
      address: "Calle 10 #25-30, Bogotá",
      phone: "601 555 0123",
      license: "T.P. 12345 - LM 98765",
      logoDataUrl: null,
    }),
    get_print_totals: (args) => {
      const demo = { "PAC-": [{ entityCode: "PAC-2026-0001", count: 3 }] };
      return Promise.resolve(demo[(args && args.prefix) || ""] || []);
    },
    get_document_prints: (args) => {
      const demo = {
        "CIR-2026-0003": [
          { document: "Consentimiento informado", count: 2, lastPrintedAt: "2026-09-11 16:17:00" },
          { document: "Fórmula médica postquirúrgica", count: 1, lastPrintedAt: "2026-09-11 16:18:00" },
        ],
        "PAC-2026-0001": [
          { document: "Historia clínica del paciente", count: 3, lastPrintedAt: "2026-09-10 09:12:00" },
        ],
      };
      return Promise.resolve(demo[(args && args.entityCode) || ""] || []);
    },
    log_document_print: (args) => {
      const i = (args && args.input) || {};
      audit.unshift({
        id: Date.now(), entityType: "DOCUMENTO", entityId: i.entityId ?? null,
        entityCode: i.entityCode, action: "IMPRIMIR",
        detail: "Documento impreso: " + i.document,
        actor: "Administrador", createdAt: now(),
      });
      return Promise.resolve(null);
    },
    list_audit_log: (args) => {
      let rows = audit;
      if (args && args.entityType) rows = rows.filter((a) => a.entityType === args.entityType);
      if (args && args.action) rows = rows.filter((a) => a.action === args.action);
      if (args && args.search) {
        const q = String(args.search).toLowerCase();
        rows = rows.filter((a) =>
          (a.entityCode || "").toLowerCase().includes(q) || (a.detail || "").toLowerCase().includes(q));
      }
      return Promise.resolve(rows);
    },

    // ---- Otros (vacíos; solo se navega a inventario/bitácora) ----
    list_patients: () =>
      Promise.resolve([
        {
          id: 1, code: "PAC-2026-0001", ownerId: 1, name: "Rocky", species: "Canino", breed: "Labrador",
          sex: "M", birthDate: "2020-03-15", weight: 32.5, neutered: false, color: "Amarillo",
          microchip: "981020004567891", active: true, notes: null,
          createdAt: "2026-01-12 10:00:00", ownerName: "María Fernanda López", ownerPhone: "310 555 8899",
          ageMonths: 78, surgeryCount: 1, lastSurgeryAt: "2026-09-11 10:35:00",
        },
      ]),
    list_surgeries: () => {
      const rows = [
        {
          id: 1, code: "CIR-2026-0003", patientId: 1, vetId: 1,
          procedureType: "TPLO (Nivelación de la cresta tibial)",
          bodyRegion: "Fémur distal", laterality: "Izquierda", description: null,
          presumptiveDiagnosis: null, definitiveDiagnosis: null,
          scheduledAt: "2026-09-11 08:00:00", durationMin: 120,
          anesthesiaType: "General inhalatoria", asaRisk: 2,
          preoperativeNotes: null, postoperativeNotes: null, estimatedCost: 4200000,
          status: "COMPLETADA", startedAt: "2026-09-11 08:20:00", completedAt: "2026-09-11 10:35:00",
          createdAt: "2026-09-01 10:00:00", updatedAt: "2026-09-11 10:40:00",
          patient: {
            id: 1, code: "PAC-2026-0001", name: "Rocky", species: "Canino", breed: "Labrador",
            sex: "M", weight: 32.5, birthDate: "2020-03-15", ageMonths: 78,
            owner: { id: 1, fullName: "María Fernanda López", phone: "310 555 8899", city: "Bogotá" },
          },
          vet: { id: 1, fullName: "Ana Restrepo", specialty: "Cirugía ortopédica" },
          materialsCount: 2, materialsCost: 458000,
        },
      ];
      // La cirugía creada desde la UI (create_surgery) aparece en el listado.
      if (mockSurgeryDetail) {
        const s = mockSurgeryDetail;
        rows.unshift({
          id: s.id, code: s.code, patientId: s.patientId, vetId: s.vetId,
          procedureType: s.procedureType, bodyRegion: s.bodyRegion, laterality: s.laterality,
          description: s.description, presumptiveDiagnosis: s.presumptiveDiagnosis,
          definitiveDiagnosis: s.definitiveDiagnosis,
          scheduledAt: s.scheduledAt, durationMin: s.durationMin,
          anesthesiaType: s.anesthesiaType, asaRisk: s.asaRisk,
          preoperativeNotes: null, postoperativeNotes: null, estimatedCost: s.estimatedCost,
          status: s.status, startedAt: s.startedAt, completedAt: s.completedAt,
          createdAt: s.createdAt, updatedAt: s.updatedAt,
          patient: s.patient, vet: s.vet,
          materialsCount: (s.materials || []).length,
          materialsCost: (s.materials || []).reduce((a, m) => a + (m.qtyUsed ?? m.qtyPlanned) * (m.unitCost ?? 0), 0),
        });
      }
      return Promise.resolve(rows);
    },

    // ---- Crear cirugía (flujo real de la UI) ----
    create_surgery: (args) => {
      const input = args.input;
      const ts = now();
      const detail = {
        id: 2, code: "CIR-2026-0004", patientId: input.patientId, vetId: input.vetId ?? null,
        procedureType: input.procedureType,
        bodyRegion: input.bodyRegion ?? null, laterality: input.laterality ?? null,
        description: input.description ?? null,
        presumptiveDiagnosis: input.presumptiveDiagnosis ?? null,
        definitiveDiagnosis: null,
        scheduledAt: input.scheduledAt, durationMin: input.durationMin ?? null,
        anesthesiaType: input.anesthesiaType ?? null, asaRisk: input.asaRisk ?? null,
        preoperativeNotes: input.preoperativeNotes ?? null,
        postoperativeNotes: input.postoperativeNotes ?? null,
        estimatedCost: input.estimatedCost ?? null,
        status: "PROGRAMADA", startedAt: null, completedAt: null,
        createdAt: ts, updatedAt: ts,
        patient: {
          id: 1, code: "PAC-2026-0001", name: "Rocky", species: "Canino", breed: "Labrador",
          sex: "M", weight: 32.5, birthDate: "2020-03-15", ageMonths: 78,
          owner: { id: 1, fullName: "María Fernanda López", phone: "310 555 8899", city: "Bogotá" },
        },
        vet: input.vetId ? { id: 1, fullName: "Ana Restrepo", specialty: "Cirugía ortopédica" } : null,
        materialsCount: 0, materialsCost: 0, materials: [], follow_ups: [],
      };
      mockSurgeryDetail = detail;
      audit.unshift({
        id: Date.now(), entityType: "CIRUGIA", entityId: 2, entityCode: "CIR-2026-0004",
        action: "CREAR", detail: "Programó " + input.procedureType + " · " + input.scheduledAt,
        actor: currentUser.user.displayName, createdAt: ts,
      });
      return Promise.resolve(detail);
    },

    // ---- Actualizar cirugía (transiciones, con guarda de diagnóstico) ----
    update_surgery: (args) => {
      const s = mockSurgeryDetail;
      if (!s || s.id !== args.id) return Promise.reject({ data: "Cirugía no encontrada (mock)" });
      const input = args.input;
      const ts = now();
      if (input.status && input.status !== s.status) {
        const allowed =
          (s.status === "PROGRAMADA" && ["EN_CURSO", "COMPLETADA", "CANCELADA"].includes(input.status)) ||
          (s.status === "EN_CURSO" && ["COMPLETADA", "CANCELADA"].includes(input.status));
        if (!allowed) return Promise.reject({ data: "Transición no permitida: " + s.status + " → " + input.status });
        if (input.status === "COMPLETADA") {
          const dx = (input.definitiveDiagnosis ?? s.definitiveDiagnosis ?? "").trim();
          if (!dx) {
            return Promise.reject({ data: "Para completar la cirugía debes registrar el diagnóstico definitivo (hallazgo confirmado)" });
          }
          s.definitiveDiagnosis = dx;
          s.completedAt = ts;
          if (!s.startedAt) s.startedAt = ts;
        }
        if (input.status === "EN_CURSO") s.startedAt = ts;
        s.status = input.status;
        audit.unshift({
          id: Date.now(), entityType: "CIRUGIA", entityId: s.id, entityCode: s.code,
          action: "EDITAR", detail: "Estado: PROGRAMADA → " + input.status + (input.status === "COMPLETADA" ? " (inventario consumido)" : ""),
          actor: currentUser.user.displayName, createdAt: ts,
        });
      }
      if (input.definitiveDiagnosis && input.status !== "COMPLETADA") {
        s.definitiveDiagnosis = input.definitiveDiagnosis;
      }
      s.updatedAt = ts;
      return Promise.resolve(s);
    },

    // ---- Documentos imprimibles (datos de demostración) ----
    get_surgery: (args) => {
      if (args.id === 2 && mockSurgeryDetail) return Promise.resolve(mockSurgeryDetail);
      if (args.id !== 1) return Promise.resolve(null);
      return Promise.resolve({
        id: 1, code: "CIR-2026-0003", patientId: 1, vetId: 1,
        procedureType: "TPLO (Nivelación de la cresta tibial)",
        bodyRegion: "Fémur distal", laterality: "Izquierda",
        description: "Rotura de ligamento cruzado craneal confirmada por radiografía. Se realiza TPLO con placa de 2.4 mm y 6 tornillos.",
        presumptiveDiagnosis: "LUXACIÓN/movilidad anormal de la rodilla izquierda con prueba de cajón positivo. Sospecha de rotura de ligamento cruzado craneal.",
        definitiveDiagnosis: "Rotura completa del ligamento cruzado craneal izquierdo con derrame articular y osteofitosis marginal temprana (confirmado intraoperatoriamente).",
        scheduledAt: "2026-09-11 08:00:00", durationMin: 120,
        anesthesiaType: "General inhalatoria", asaRisk: 2,
        preoperativeNotes: "Ayuno 12 h. Hemograma y perfil renal dentro de rangos. Pre Medicación con dexmedetomidina.",
        postoperativeNotes: "Procédimiento sin complicaciones. Analgesia multimodal: meloxicam 0.1 mg/kg SID × 5 días, tramadol 2 mg/kg BID × 4 días. Cefalexina 22 mg/kg BID × 7 días. Reposo estricto 4 semanas. Radiografía de control a las 8 semanas.",
        estimatedCost: 4200000, status: "COMPLETADA",
        startedAt: "2026-09-11 08:20:00", completedAt: "2026-09-11 10:35:00",
        createdAt: "2026-09-01 10:00:00", updatedAt: "2026-09-11 10:40:00",
        patient: {
          id: 1, code: "PAC-2026-0001", name: "Rocky", species: "Canino", breed: "Labrador",
          sex: "M", weight: 32.5, birthDate: "2020-03-15", ageMonths: 78,
          owner: { id: 1, fullName: "María Fernanda López", phone: "310 555 8899", city: "Bogotá" },
        },
        vet: { id: 1, fullName: "Ana Restrepo", specialty: "Cirugía ortopédica" },
        materialsCount: 2, materialsCost: 458000,
        materials: [
          { id: 1, surgeryId: 1, itemId: 1, qtyPlanned: 1, qtyUsed: 1, unitCost: 420000, notes: "Platina LCP 3.5 mm 5 agujeros, colocada a 90° de rotación.", item: { id: 1, code: "INV-0001", name: "Platina LCP 3.5 mm 5 agujeros", category: "PLACAS", size: "96 mm", unit: "pie", stockQty: 2, minStock: 4 } },
          { id: 2, surgeryId: 1, itemId: 2, qtyPlanned: 6, qtyUsed: 6, unitCost: 38000, notes: "Tornillos corticales 3.5 mm, medición directa.", item: { id: 2, code: "INV-0002", name: "Tornillo cortical 3.5×40 mm", category: "TORNILLOS", size: "40 mm", unit: "pie", stockQty: 6, minStock: 10 } },
        ],
        follow_ups: [
          { id: 1, surgeryId: 1, scheduledDate: "2026-09-25", type: "CURACION", notes: "Curación y evaluación de herida", status: "PENDIENTE", doneAt: null, createdAt: "2026-09-11 10:40:00" },
          { id: 2, surgeryId: 1, scheduledDate: "2026-11-06", type: "CONTROL_RADIOGRAFICO", notes: "Radiografía de control de consolidación", status: "PENDIENTE", doneAt: null, createdAt: "2026-09-11 10:40:00" },
        ],
      });
    },
    get_patient: (args) => {
      if (args.id !== 1) return Promise.resolve(null);
      return Promise.resolve({
        id: 1, code: "PAC-2026-0001", ownerId: 1, name: "Rocky", species: "Canino", breed: "Labrador",
        sex: "M", birthDate: "2020-03-15", weight: 32.5, neutered: false, color: "Amarillo",
        microchip: "981020004567891", active: true, notes: "Alérgico a penicilina.",
        createdAt: "2026-01-12 10:00:00", ownerName: "María Fernanda López", ownerPhone: "310 555 8899",
        ageMonths: 78, surgeryCount: 1, lastSurgeryAt: "2026-09-11 10:35:00",
        surgeries: [
          { id: 1, code: "CIR-2026-0003", procedureType: "TPLO (Nivelación de la cresta tibial)", scheduledAt: "2026-09-11 08:00:00", status: "COMPLETADA", bodyRegion: "Fémur distal", laterality: "Izquierda", vet: { id: 1, fullName: "Ana Restrepo" } },
        ],
      });
    },
  };

  window.__TAURI_INTERNALS__ = {
    transformCallback: (cb) => cb,
    invoke: (cmd, args) => {
      const h = handlers[cmd];
      if (!h) {
        console.warn("[vst-mock] comando no mockeado:", cmd);
        return Promise.resolve(null);
      }
      try {
        return h(args || {});
      } catch (e) {
        return Promise.reject(e);
      }
    },
  };

  console.info("[vst-mock] instalado — comandos:", Object.keys(handlers).join(", "));
})();
