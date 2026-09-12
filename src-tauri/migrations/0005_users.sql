-- ============================================================================
-- VetSurgeryTR · Migración 0005 — Usuarios locales (acceso con login).
-- Login de escritorio: la bitácora (AUDIT_LOG) registra el nombre real de
-- quien hace cada acción en lugar del genérico «Sistema local».
--
-- El usuario inicial (admin) NO se inserta aquí: lo crea Rust en el
-- bootstrap con hash Argon2id de sal aleatoria (repositories/user.rs,
-- ensure_default_admin), solo si la tabla está vacía.
-- ============================================================================

CREATE TABLE USERS (
    ID            D_PK NOT NULL PRIMARY KEY,
    USERNAME      VARCHAR(30) CHARACTER SET UTF8 NOT NULL,
    DISPLAY_NAME  D_NAME NOT NULL,
    -- PHC string de Argon2id (v19): incluye algoritmo, parámetros, sal y hash.
    PASSWORD_HASH VARCHAR(200) CHARACTER SET UTF8 NOT NULL,
    -- ADMIN | VET (reservado para permisos futuros).
    ROLE          VARCHAR(20) CHARACTER SET UTF8 DEFAULT 'VET' NOT NULL,
    ACTIVE        BOOLEAN DEFAULT TRUE NOT NULL,
    CREATED_AT    TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UPDATED_AT    TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT UNQ_USERS_USERNAME UNIQUE (USERNAME)
);
CREATE GENERATOR GEN_USERS_ID;
