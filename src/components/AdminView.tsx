// VetSurgeryTR — Administración (solo admins): gestión del cuerpo de
// veterinarios (altas + desactivación con soft-delete), de los usuarios con
// acceso a la app (altas, activar/desactivar, restablecer contraseña) y la
// identidad de la clínica que llevan los documentos imprimibles.
import { useState } from "react";
import {
  createVet,
  createUser,
  getClinicSettings,
  listAllVets,
  listUsers,
  resetUserPassword,
  setVetActive,
  setUserActive,
  updateClinicSettings,
  updateUser,
  updateVet,
  getErrorMessage,
} from "@/lib/ipc";
import type {
  ClinicSettings,
  User,
  Vet,
  CreateVetInput,
  UpdateClinicSettingsInput,
} from "@/types";
import { useAsync, useDebounced } from "@/lib/use-async";
import { ConfirmDialog, Modal, useToast } from "./ui";
import {
  IconActivity,
  IconAlert,
  IconBuilding,
  IconCheck,
  IconEdit,
  IconPaw,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconShield,
} from "./icons";

type Tab = "vets" | "users" | "clinic";

/* ------------------------------ Diálogos ---------------------------------- */

function VetFormDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<CreateVetInput>({ fullName: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (busy) return;
    if (!form.fullName.trim()) {
      setError("El nombre completo es requerido");
      return;
    }
    setBusy(true);
    setError(null);
    createVet(form)
      .then(() => {
        toast.success("Veterinario agregado");
        onCreated();
        onClose();
      })
      .catch((e: unknown) => setError(getErrorMessage(e)))
      .finally(() => setBusy(false));
  }

  return (
    <Modal title="Nuevo veterinario" onClose={onClose} width={520}>
      <form className="dialog-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label className="field">
          <span>Nombre completo *</span>
          <input
            autoFocus
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            placeholder="MV. Nombre Apellido"
            required
          />
        </label>
        <label className="field">
          <span>Tarjeta profesional</span>
          <input
            value={form.license ?? ""}
            onChange={(e) => setForm({ ...form, license: e.target.value || undefined })}
            placeholder="TP-123456"
          />
        </label>
        <label className="field">
          <span>Especialidad</span>
          <input
            value={form.specialty ?? ""}
            onChange={(e) => setForm({ ...form, specialty: e.target.value || undefined })}
            placeholder="Cirugía ortopédica"
          />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Teléfono</span>
            <input
              value={form.phone ?? ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value || undefined })}
            />
          </label>
          <label className="field">
            <span>Correo</span>
            <input
              type="email"
              value={form.email ?? ""}
              onChange={(e) => setForm({ ...form, email: e.target.value || undefined })}
            />
          </label>
        </div>
        {error && <p className="login-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Guardando…" : "Agregar veterinario"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Edición de un veterinario existente: precarga los datos actuales; vaciar
 *  un campo opcional lo quita (el backend interpreta "" como NULL). */
function VetEditDialog({ vet, onClose, onSaved }: { vet: Vet; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    fullName: vet.fullName,
    license: vet.license ?? "",
    specialty: vet.specialty ?? "",
    phone: vet.phone ?? "",
    email: vet.email ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (busy) return;
    if (!form.fullName.trim()) {
      setError("El nombre completo es requerido");
      return;
    }
    setBusy(true);
    setError(null);
    updateVet(vet.id, {
      fullName: form.fullName,
      license: form.license,
      specialty: form.specialty,
      phone: form.phone,
      email: form.email,
    })
      .then(() => {
        toast.success("Veterinario actualizado");
        onSaved();
        onClose();
      })
      .catch((e: unknown) => setError(getErrorMessage(e)))
      .finally(() => setBusy(false));
  }

  return (
    <Modal title={`Editar veterinario · ${vet.fullName}`} onClose={onClose} width={520}>
      <form className="dialog-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label className="field">
          <span>Nombre completo *</span>
          <input
            autoFocus
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            required
          />
        </label>
        <label className="field">
          <span>Tarjeta profesional</span>
          <input
            value={form.license}
            onChange={(e) => setForm({ ...form, license: e.target.value })}
            placeholder="Vacío = quitar el dato"
          />
        </label>
        <label className="field">
          <span>Especialidad</span>
          <input
            value={form.specialty}
            onChange={(e) => setForm({ ...form, specialty: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Teléfono</span>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Correo</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
        </div>
        {error && <p className="login-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function UserFormDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "VET">("VET");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (busy) return;
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setBusy(true);
    setError(null);
    createUser({ username, displayName, password, role })
      .then(() => {
        toast.success("Usuario creado");
        onCreated();
        onClose();
      })
      .catch((e: unknown) => setError(getErrorMessage(e)))
      .finally(() => setBusy(false));
  }

  return (
    <Modal title="Nuevo usuario de la app" onClose={onClose} width={500}>
      <form className="dialog-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label className="field">
          <span>Usuario *</span>
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="3-30 caracteres: letras, números, _ o ."
            autoComplete="off"
            required
          />
        </label>
        <label className="field">
          <span>Nombre visible *</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Cómo se verá en la bitácora"
            required
          />
        </label>
        <label className="field">
          <span>Contraseña inicial *</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </label>
        <div className="field">
          <span>Rol</span>
          <div className="type-cards" style={{ gridTemplateColumns: "1fr 1fr" }} role="radiogroup" aria-label="Rol del usuario">
            {(["VET", "ADMIN"] as const).map((r) => (
              <button
                key={r}
                type="button"
                className={`type-card${role === r ? " active" : ""}`}
                onClick={() => setRole(r)}
                aria-pressed={role === r}
              >
                <b>{r === "ADMIN" ? "Administrador" : "Veterinario"}</b>
                <span style={{ fontSize: 11.5, fontWeight: 400 }}>
                  {r === "ADMIN"
                    ? "Gestiona usuarios, veterinarios y todo el sistema"
                    : "Uso clínico: pacientes, cirugías e inventario"}
                </span>
              </button>
            ))}
          </div>
        </div>
        {error && <p className="login-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Creando…" : "Crear usuario"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Edición de un usuario: nombre visible y rol (el username no se toca).
 *  Degradar al último ADMIN activo lo rechaza el backend con mensaje claro. */
function UserEditDialog({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [role, setRole] = useState<"ADMIN" | "VET">(user.role);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (busy) return;
    if (!displayName.trim()) {
      setError("El nombre visible es requerido");
      return;
    }
    setBusy(true);
    setError(null);
    updateUser(user.id, { displayName, role })
      .then(() => {
        toast.success("Usuario actualizado");
        onSaved();
        onClose();
      })
      .catch((e: unknown) => setError(getErrorMessage(e)))
      .finally(() => setBusy(false));
  }

  return (
    <Modal title={`Editar usuario · @${user.username}`} onClose={onClose} width={480}>
      <form className="dialog-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label className="field">
          <span>Usuario</span>
          <input value={`@${user.username}`} disabled />
        </label>
        <label className="field">
          <span>Nombre visible *</span>
          <input
            autoFocus
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </label>
        <div className="field">
          <span>Rol</span>
          <div className="type-cards" style={{ gridTemplateColumns: "1fr 1fr" }} role="radiogroup" aria-label="Rol del usuario">
            {(["VET", "ADMIN"] as const).map((r) => (
              <button
                key={r}
                type="button"
                className={`type-card${role === r ? " active" : ""}`}
                onClick={() => setRole(r)}
                aria-pressed={role === r}
              >
                <b>{r === "ADMIN" ? "Administrador" : "Veterinario"}</b>
                <span style={{ fontSize: 11.5, fontWeight: 400 }}>
                  {r === "ADMIN"
                    ? "Gestiona usuarios, veterinarios y todo el sistema"
                    : "Uso clínico: pacientes, cirugías e inventario"}
                </span>
              </button>
            ))}
          </div>
        </div>
        {error && <p className="login-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const toast = useToast();
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (busy) return;
    if (pwd.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setBusy(true);
    setError(null);
    resetUserPassword(user.id, pwd)
      .then(() => {
        toast.success(`Contraseña de ${user.displayName} restablecida`);
        onClose();
      })
      .catch((e: unknown) => setError(getErrorMessage(e)))
      .finally(() => setBusy(false));
  }

  return (
    <Modal title={`Restablecer contraseña · ${user.displayName}`} onClose={onClose} width={440}>
      <form className="dialog-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <p className="muted" style={{ marginTop: 0 }}>
          Define una contraseña nueva para <b>@{user.username}</b>. No necesitas la actual, y la
          acción queda registrada en la bitácora.
        </p>
        <label className="field">
          <span>Nueva contraseña</span>
          <input
            type="password"
            autoFocus
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
          />
        </label>
        {error && <p className="login-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Guardando…" : "Restablecer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------ Configuración de la clínica --------------------- */

/** Máximo del data URL del logo (~150 KB de archivo → ~200 000 chars). */
const LOGO_MAX_CHARS = 200_000;

function ClinicSettingsDialog({
  settings,
  onClose,
  onSaved,
}: {
  settings: ClinicSettings;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    clinicName: settings.clinicName ?? "",
    taxId: settings.taxId ?? "",
    address: settings.address ?? "",
    phone: settings.phone ?? "",
    email: settings.email ?? "",
    license: settings.license ?? "",
  });
  const [logo, setLogo] = useState<string | null>(settings.logoDataUrl);
  const [logoTouched, setLogoTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function pickLogo(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("El logo debe ser una imagen (PNG, JPG, SVG…)");
      return;
    }
    if (file.size > 150 * 1024) {
      setError("El logo pesa más de 150 KB; usa una imagen más pequeña");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogo(String(reader.result));
      setLogoTouched(true);
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!form.clinicName.trim()) {
      setError("El nombre de la clínica es requerido");
      return;
    }
    if (logo && logo.length > LOGO_MAX_CHARS) {
      setError("El logo es demasiado grande; usa una imagen más pequeña");
      return;
    }
    setBusy(true);
    setError(null);
    const input: UpdateClinicSettingsInput = { ...form };
    // Solo tocar el logo si el usuario lo cambió (undefined = dejar como está).
    if (logoTouched) input.logoDataUrl = logo ?? "";
    updateClinicSettings(input)
      .then(() => {
        toast.success("Configuración de la clínica guardada");
        onSaved();
        onClose();
      })
      .catch((e2: unknown) => setError(getErrorMessage(e2)))
      .finally(() => setBusy(false));
  }

  return (
    <Modal title="Identidad de la clínica" onClose={onClose} width={560}>
      <p className="field-hint" style={{ marginTop: 0 }}>
        Estos datos aparecen en el encabezado y el pie de los documentos
        imprimibles (consentimiento, fórmula médica e historias clínicas).
      </p>
      <form className="dialog-form" onSubmit={submit}>
        <div className="row" style={{ gap: 14, alignItems: "center", marginBottom: 4 }}>
          {logo ? (
            <img
              src={logo}
              alt="Logo actual"
              style={{ maxHeight: 56, maxWidth: 160, border: "1px solid var(--border)", borderRadius: 8, padding: 4 }}
            />
          ) : (
            <div
              aria-hidden="true"
              style={{
                width: 72, height: 56, border: "1px dashed var(--border)",
                borderRadius: 8, display: "grid", placeItems: "center",
                color: "var(--text-faint)", fontSize: 11,
              }}
            >
              Sin logo
            </div>
          )}
          <div className="col" style={{ gap: 6 }}>
            <label className="btn btn-outline btn-sm" style={{ cursor: "pointer" }}>
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => pickLogo(e.target.files?.[0])}
              />
              {logo ? "Cambiar logo…" : "Cargar logo…"}
            </label>
            {logo ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => { setLogo(null); setLogoTouched(true); }}
              >
                Quitar logo
              </button>
            ) : null}
          </div>
        </div>
        <label className="field">
          <span>Nombre de la clínica *</span>
          <input autoFocus value={form.clinicName} onChange={set("clinicName")} required />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>NIT / registro</span>
            <input value={form.taxId} onChange={set("taxId")} placeholder="p. ej. NIT 901.234.567-8" />
          </label>
          <label className="field">
            <span>Licencia / registro del establecimiento</span>
            <input value={form.license} onChange={set("license")} placeholder="p. ej. Lic. SAA 2026-0148" />
          </label>
          <label className="field">
            <span>Teléfono</span>
            <input value={form.phone} onChange={set("phone")} placeholder="(601) 555 0198" />
          </label>
          <label className="field">
            <span>Correo</span>
            <input type="email" value={form.email} onChange={set("email")} placeholder="contacto@clinica.co" />
          </label>
        </div>
        <label className="field">
          <span>Dirección</span>
          <input value={form.address} onChange={set("address")} placeholder="Calle 10 # 5-25, Bogotá" />
        </label>
        {error && <p className="login-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------- Vista ------------------------------------ */

export default function AdminView() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("vets");
  // Búsqueda local del cuerpo clínico (nombre, T.P., especialidad o contacto):
  // la pestaña ya tiene todos los vets en memoria, filtrar aquí evita un
  // viaje al backend por cada tecla.
  const [vetQuery, setVetQuery] = useState("");
  const debouncedVetQuery = useDebounced(vetQuery, 200);
  /** Filtro de estado: todos | activos | inactivos (combina con la búsqueda). */
  const [vetStatus, setVetStatus] = useState<"all" | "active" | "inactive">("all");
  // Búsqueda de usuarios (usuario, nombre visible o rol): mismo patrón local
  // que la pestaña de veterinarios — la lista ya está en memoria.
  const [userQuery, setUserQuery] = useState("");
  const debouncedUserQuery = useDebounced(userQuery, 200);

  const vets = useAsync(() => listAllVets(), []);
  const users = useAsync(() => listUsers(), []);
  // Identidad de la clínica (documentos imprimibles) + su diálogo de edición.
  const clinic = useAsync(() => getClinicSettings(), []);
  const [clinicDialog, setClinicDialog] = useState(false);

  const [vetDialog, setVetDialog] = useState(false);
  const [editVet, setEditVet] = useState<Vet | null>(null);
  const [userDialog, setUserDialog] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [confirmVet, setConfirmVet] = useState<Vet | null>(null);
  const [confirmUser, setConfirmUser] = useState<User | null>(null);

  function toggleVet(v: Vet) {
    setVetActive(v.id, !v.active)
      .then((updated) => {
        toast.success(updated.active ? "Veterinario activado" : "Veterinario desactivado (conserva su historial)");
        vets.reload();
      })
      .catch((e: unknown) => toast.error(getErrorMessage(e)));
  }

  function toggleUser(u: User) {
    setUserActive(u.id, !u.active)
      .then((updated) => {
        toast.success(updated.active ? "Usuario activado" : "Usuario desactivado");
        users.reload();
      })
      .catch((e: unknown) => toast.error(getErrorMessage(e)));
  }

  const vetRows = (vets.data ?? []).filter((v) => {
    if (vetStatus === "active" && !v.active) return false;
    if (vetStatus === "inactive" && v.active) return false;
    const q = debouncedVetQuery.trim().toLowerCase();
    if (!q) return true;
    return [v.fullName, v.license, v.specialty, v.phone, v.email]
      .some((f) => (f ?? "").toLowerCase().includes(q));
  });
  const userRows = (users.data ?? []).filter((u) => {
    const q = debouncedUserQuery.trim().toLowerCase();
    if (!q) return true;
    return [u.username, u.displayName, u.role === "ADMIN" ? "administrador" : "veterinario"]
      .some((f) => f.toLowerCase().includes(q));
  });

  return (
    <div>
      <div className="tabs" role="tablist" aria-label="Secciones de administración">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "vets"}
          className={`tab${tab === "vets" ? " active" : ""}`}
          onClick={() => setTab("vets")}
        >
          <IconPaw size={15} /> Veterinarios
          <span className="tab-count">{vetRows.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "users"}
          className={`tab${tab === "users" ? " active" : ""}`}
          onClick={() => setTab("users")}
        >
          <IconShield size={15} /> Usuarios
          <span className="tab-count">{userRows.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "clinic"}
          className={`tab${tab === "clinic" ? " active" : ""}`}
          onClick={() => setTab("clinic")}
        >
          <IconBuilding size={15} /> Clínica
        </button>
      </div>

      {/* ------------------------------ Clínica ------------------------------ */}
      {tab === "clinic" && (
        <section aria-label="Identidad de la clínica">
          {clinic.loading ? (
            <p className="muted">Cargando…</p>
          ) : clinic.error ? (
            <div className="banner danger" role="alert">
              <IconAlert size={18} />
              <span>{clinic.error}</span>
            </div>
          ) : clinic.data ? (
            <div className="card" style={{ maxWidth: 640 }}>
              <div className="row" style={{ gap: 16, alignItems: "center" }}>
                {clinic.data.logoDataUrl ? (
                  <img
                    src={clinic.data.logoDataUrl}
                    alt="Logo de la clínica"
                    style={{ maxHeight: 64, maxWidth: 180, border: "1px solid var(--border)", borderRadius: 8, padding: 4 }}
                  />
                ) : null}
                <div>
                  <h2 style={{ margin: "0 0 4px", fontSize: 16 }}>{clinic.data.clinicName}</h2>
                  <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
                    {[
                      clinic.data.taxId,
                      clinic.data.license,
                      clinic.data.address,
                      clinic.data.phone,
                      clinic.data.email,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Sin datos de contacto todavía."}
                  </p>
                </div>
                <span className="spacer" />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setClinicDialog(true)}
                >
                  <IconEdit size={15} /> Editar identidad
                </button>
              </div>
              <p className="field-hint" style={{ marginBottom: 0 }}>
                Esta identidad aparece en el encabezado y el pie de todos los
                documentos imprimibles (consentimiento informado, fórmula médica
                e historias clínicas). Se guarda en la base de datos y viaja con
                los respaldos.
              </p>
            </div>
          ) : null}
        </section>
      )}

      {/* ------------------------------ Veterinarios ------------------------ */}
      {tab === "vets" && (
        <>
          <div className="toolbar">
            <div className="search-box" style={{ flex: 1, maxWidth: 320 }}>
              <IconSearch size={16} />
              <label htmlFor="q-vets" className="sr-only">
                Buscar veterinarios
              </label>
              <input
                id="q-vets"
                className="input"
                value={vetQuery}
                onChange={(e) => setVetQuery(e.target.value)}
                placeholder="Buscar por nombre, T.P., especialidad o contacto…"
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="f-vet-status" className="sr-only">
                Filtrar por estado
              </label>
              <select
                id="f-vet-status"
                className="select"
                style={{ width: 140 }}
                value={vetStatus}
                onChange={(e) => setVetStatus(e.target.value as "all" | "active" | "inactive")}
              >
                <option value="all">Todos los estados</option>
                <option value="active">Solo activos</option>
                <option value="inactive">Solo inactivos</option>
              </select>
            </div>
            <button
              type="button"
              className="btn btn-outline"
              onClick={vets.reload}
              aria-label="Recargar veterinarios"
              title="Recargar"
            >
              <IconRefresh size={16} />
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setVetDialog(true)}>
              <IconPlus size={16} /> Nuevo veterinario
            </button>
          </div>
          <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
            Desactivar un veterinario <b>no borra</b> su historial quirúrgico: solo deja de aparecer
            al agendar nuevas cirugías.
          </p>

          {vets.loading ? (
            <div className="card"><div className="loading-row"><span className="spin" /> Cargando…</div></div>
          ) : vets.error ? (
            <div className="card">
              <div className="state state-error">
                <IconAlert size={28} />
                <h3>No se pudieron cargar los veterinarios</h3>
                <p>{vets.error}</p>
              </div>
            </div>
          ) : vetRows.length === 0 ? (
            <div className="card">
              <div className="state">
                <IconSearch size={28} />
                <h3>
                  {debouncedVetQuery.trim() || vetStatus !== "all"
                    ? "Sin resultados"
                    : "Aún no hay veterinarios"}
                </h3>
                <p>
                  {debouncedVetQuery.trim()
                    ? `Ningún veterinario coincide con «${debouncedVetQuery.trim()}»${vetStatus !== "all" ? " en el estado seleccionado" : ""}. Prueba con otro nombre, T.P. o especialidad.`
                    : vetStatus !== "all"
                      ? vetStatus === "inactive"
                        ? "No hay veterinarios inactivos: todo el cuerpo clínico está activo."
                        : "No hay veterinarios activos. Reactiva a alguien o agrega un nuevo veterinario."
                      : "Agrega el primer veterinario con el botón «Nuevo veterinario»."}
                </p>
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <caption className="sr-only">
                  Veterinarios
                  {vetStatus !== "all" ? ` (${vetStatus === "active" ? "solo activos" : "solo inactivos"})` : ""}
                  {debouncedVetQuery.trim() ? ` (filtro: ${debouncedVetQuery.trim()})` : ""}
                </caption>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Tarjeta profesional</th>
                    <th>Especialidad</th>
                    <th>Contacto</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {vetRows.map((v) => (
                    <tr key={v.id}>
                      <td data-label="Nombre"><b>{v.fullName}</b></td>
                      <td data-label="T.P." className="mono">{v.license ?? <span className="muted">—</span>}</td>
                      <td data-label="Especialidad">{v.specialty ?? <span className="muted">—</span>}</td>
                      <td data-label="Contacto">
                        {v.phone || v.email
                          ? [v.phone, v.email].filter(Boolean).join(" · ")
                          : <span className="muted">—</span>}
                      </td>
                      <td data-label="Estado">
                        {v.active
                          ? <span className="badge badge-success"><IconCheck size={12} /> Activo</span>
                          : <span className="badge badge-outline">Inactivo</span>}
                      </td>
                      <td data-label="Acciones">
                        <div className="row" style={{ gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => setEditVet(v)}
                            title="Editar datos del veterinario"
                          >
                            <IconEdit size={14} /> Editar
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${v.active ? "btn-danger" : "btn-outline"}`}
                            onClick={() => setConfirmVet(v)}
                          >
                            {v.active ? "Desactivar" : "Activar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ------------------------------- Usuarios --------------------------- */}
      {tab === "users" && (
        <>
          <div className="toolbar">
            <div className="search-box" style={{ flex: 1, maxWidth: 320 }}>
              <IconSearch size={16} />
              <label htmlFor="q-users" className="sr-only">
                Buscar usuarios
              </label>
              <input
                id="q-users"
                className="input"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Buscar por usuario, nombre o rol…"
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              className="btn btn-outline"
              onClick={users.reload}
              aria-label="Recargar usuarios"
              title="Recargar"
            >
              <IconRefresh size={16} />
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setUserDialog(true)}>
              <IconPlus size={16} /> Nuevo usuario
            </button>
          </div>
          <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
            Quiénes pueden entrar a la app. Las acciones de cada usuario quedan atribuidas en la
            bitácora con su nombre. No puedes desactivarte a ti mismo ni apagar al último
            administrador.
          </p>

          {users.loading ? (
            <div className="card"><div className="loading-row"><span className="spin" /> Cargando…</div></div>
          ) : users.error ? (
            <div className="card">
              <div className="state state-error">
                <IconAlert size={28} />
                <h3>No se pudieron cargar los usuarios</h3>
                <p>{users.error}</p>
              </div>
            </div>
          ) : userRows.length === 0 ? (
            <div className="card">
              <div className="state">
                <IconSearch size={28} />
                <h3>{debouncedUserQuery.trim() ? "Sin resultados" : "Aún no hay usuarios"}</h3>
                <p>
                  {debouncedUserQuery.trim()
                    ? `Ningún usuario coincide con «${debouncedUserQuery.trim()}». Prueba con otro usuario, nombre o rol.`
                    : "Crea el primer acceso con el botón «Nuevo usuario»."}
                </p>
              </div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <caption className="sr-only">
                  Usuarios de la aplicación
                  {debouncedUserQuery.trim() ? ` (filtro: ${debouncedUserQuery.trim()})` : ""}
                </caption>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Nombre visible</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {userRows.map((u) => (
                    <tr key={u.id}>
                      <td data-label="Usuario" className="mono">@{u.username}</td>
                      <td data-label="Nombre">{u.displayName}</td>
                      <td data-label="Rol">
                        {u.role === "ADMIN"
                          ? <span className="badge badge-warning"><IconShield size={12} /> Administrador</span>
                          : <span className="badge badge-secondary"><IconActivity size={12} /> Veterinario</span>}
                      </td>
                      <td data-label="Estado">
                        {u.active
                          ? <span className="badge badge-success"><IconCheck size={12} /> Activo</span>
                          : <span className="badge badge-destructive">Inactivo</span>}
                      </td>
                      <td data-label="Acciones">
                        <div className="row" style={{ gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => setEditUser(u)}
                            title="Cambiar nombre visible y rol"
                          >
                            <IconEdit size={14} /> Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={() => setResetUser(u)}
                            title="Definir una contraseña nueva (para olvidos)"
                          >
                            Contraseña
                          </button>
                          <button
                            type="button"
                            className={`btn btn-sm ${u.active ? "btn-danger" : "btn-outline"}`}
                            onClick={() => setConfirmUser(u)}
                          >
                            {u.active ? "Desactivar" : "Activar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ------------------------------ Diálogos ----------------------------- */}
      {clinicDialog && clinic.data && (
        <ClinicSettingsDialog
          settings={clinic.data}
          onClose={() => setClinicDialog(false)}
          onSaved={() => clinic.reload()}
        />
      )}
      {vetDialog && <VetFormDialog onClose={() => setVetDialog(false)} onCreated={() => vets.reload()} />}
      {editVet && <VetEditDialog vet={editVet} onClose={() => setEditVet(null)} onSaved={() => vets.reload()} />}
      {userDialog && <UserFormDialog onClose={() => setUserDialog(false)} onCreated={() => users.reload()} />}
      {editUser && <UserEditDialog user={editUser} onClose={() => setEditUser(null)} onSaved={() => users.reload()} />}
      {resetUser && <ResetPasswordDialog user={resetUser} onClose={() => setResetUser(null)} />}
      {confirmVet && (
        <ConfirmDialog
          title={confirmVet.active ? "Desactivar veterinario" : "Activar veterinario"}
          message={
            confirmVet.active
              ? <>¿Desactivar a <b>{confirmVet.fullName}</b>? Conserva todo su historial quirúrgico, pero no podrás agendarle nuevas cirugías.</>
              : <>¿Reactivar a <b>{confirmVet.fullName}</b> para volver a asignarle cirugías?</>
          }
          confirmLabel={confirmVet.active ? "Desactivar" : "Activar"}
          danger={confirmVet.active}
          onConfirm={() => { const v = confirmVet; setConfirmVet(null); toggleVet(v); }}
          onCancel={() => setConfirmVet(null)}
        />
      )}
      {confirmUser && (
        <ConfirmDialog
          title={confirmUser.active ? "Desactivar usuario" : "Activar usuario"}
          message={
            confirmUser.active
              ? <>¿Desactivar a <b>{confirmUser.displayName}</b> (@{confirmUser.username})? No podrá volver a iniciar sesión.</>
              : <>¿Reactivar a <b>{confirmUser.displayName}</b> (@{confirmUser.username})?</>
          }
          confirmLabel={confirmUser.active ? "Desactivar" : "Activar"}
          danger={confirmUser.active}
          onConfirm={() => { const u = confirmUser; setConfirmUser(null); toggleUser(u); }}
          onCancel={() => setConfirmUser(null)}
        />
      )}
    </div>
  );
}
