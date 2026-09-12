-- ============================================================================
-- VetSurgeryTR · Migración 0004 — Bitácora de auditoría (AUDIT_LOG).
-- Registra quién hizo qué y cuándo sobre: movimientos de inventario,
-- cambios de estado/edición de cirugías y ediciones de pacientes.
--
-- Sin FKs a propósito: la bitácora debe sobrevivir a cambios de esquema de
-- las entidades auditadas y los IDs quedan como referencia informativa.
-- Cada entrada se inserta DENTRO de la transacción de la operación que
-- audita: si la operación hace ROLLBACK, la entrada no queda (trazable =
-- solo lo que realmente ocurrió).
-- ============================================================================

CREATE TABLE AUDIT_LOG (
    ID          D_PK NOT NULL PRIMARY KEY,
    ENTITY_TYPE VARCHAR(20) CHARACTER SET UTF8 NOT NULL,  -- INVENTARIO | CIRUGIA | PACIENTE
    ENTITY_ID   INTEGER,
    ENTITY_CODE VARCHAR(20) CHARACTER SET UTF8,           -- INV-0001 / CIR-2026-0001 / PAC-2026-0001
    ACTION      VARCHAR(40) CHARACTER SET UTF8 NOT NULL,  -- ENTRADA | SALIDA | AJUSTE | ESTADO | EDITAR
    DETAIL      D_NOTES,                                  -- resumen legible (p. ej. diffs campo a campo)
    ACTOR       VARCHAR(80) CHARACTER SET UTF8 DEFAULT 'Sistema local' NOT NULL,
    CREATED_AT  TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE GENERATOR GEN_AUDIT_LOG_ID;

CREATE INDEX IDX_AUDIT_CREATED ON AUDIT_LOG (CREATED_AT);
CREATE INDEX IDX_AUDIT_ENTITY ON AUDIT_LOG (ENTITY_TYPE, ENTITY_ID);
