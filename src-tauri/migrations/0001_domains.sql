-- ============================================================================
-- VetSurgeryTR · Migración 0001 — Dominios y base tipográfica (Firebird 5.0,
-- dialecto 3). Ejecutada desde Rust al primer arranque (src-tauri/src/db/
-- migrations.rs), con registro de versiones en la tabla _MIGRATIONS.
-- Convenciones (heredadas del patrón ISALAB-TR):
--   * IDs por GENERATOR + trigger BEFORE INSERT (IF NEW.ID IS NULL).
--   * DSQL parametrizado en la app; aquí SOLO DDL estructurado.
--   * DOMAINs para tipos reutilizables (documentos, teléfonos, textos...),
--     incluidos dominios de estado con CHECK idénticos a los catálogos de
--     src/lib/api-types.ts de la web.
-- ============================================================================

-- ============================== DOMINIOS =====================================
CREATE DOMAIN D_PK AS INTEGER;
CREATE DOMAIN D_NAME AS VARCHAR(80) CHARACTER SET UTF8;
-- Tipo de documento del propietario (con CHECK del catálogo web).
CREATE DOMAIN D_DOC_TYPE AS VARCHAR(4) CHARACTER SET UTF8
    CHECK (VALUE IN ('CC', 'TI', 'CE', 'NIT', 'PA'));
CREATE DOMAIN D_DOC_NUMBER AS VARCHAR(20) CHARACTER SET UTF8;
CREATE DOMAIN D_PHONE AS VARCHAR(20) CHARACTER SET UTF8;
CREATE DOMAIN D_EMAIL AS VARCHAR(120) CHARACTER SET UTF8;
CREATE DOMAIN D_ADDRESS AS VARCHAR(200) CHARACTER SET UTF8;
CREATE DOMAIN D_CITY AS VARCHAR(80) CHARACTER SET UTF8;
CREATE DOMAIN D_CODE AS VARCHAR(20) CHARACTER SET UTF8;
-- 2000 chars UTF8 (max ~8KB/columna) para que tablas con varias columnas de
-- texto quepan en el límite de fila de Firebird (~64KB).
CREATE DOMAIN D_TEXT AS VARCHAR(2000) CHARACTER SET UTF8;
CREATE DOMAIN D_NOTES AS VARCHAR(4000) CHARACTER SET UTF8;
CREATE DOMAIN D_STATUS AS VARCHAR(20) CHARACTER SET UTF8;
-- Sexo del paciente (con CHECK del catálogo web).
CREATE DOMAIN D_SEX AS CHAR(1) CHARACTER SET UTF8
    CHECK (VALUE IN ('M', 'F'));
CREATE DOMAIN D_TS AS TIMESTAMP;
CREATE DOMAIN D_DATE AS DATE;
-- Cantidades (kg, piezas, rollos...) en DOUBLE PRECISION: el contrato del
-- frontend usa `number` (IEEE-754) y así rsfbclient las extrae sin conversión
-- de escala.
CREATE DOMAIN D_QTY AS DOUBLE PRECISION;
-- Dinero COP: DECIMAL(12,2) como en el dominio fuente (se lee SIEMPRE con
-- CAST(... AS DOUBLE PRECISION), patrón ISALAB para NUMERIC escalado).
CREATE DOMAIN D_AMOUNT AS DECIMAL(12, 2);
CREATE DOMAIN D_UNIT AS VARCHAR(20) CHARACTER SET UTF8;
CREATE DOMAIN D_SIZE AS VARCHAR(40) CHARACTER SET UTF8;
CREATE DOMAIN D_CATEGORY AS VARCHAR(20) CHARACTER SET UTF8;

-- ====================== DOMINIOS DE ESTADO (CHECK) ===========================
-- Catálogos EXACTOS de src/lib/api-types.ts.

-- Estado de la cirugía.
CREATE DOMAIN D_SURGERY_STATUS AS VARCHAR(20) CHARACTER SET UTF8
    CHECK (VALUE IN ('PROGRAMADA', 'EN_CURSO', 'COMPLETADA', 'CANCELADA'));

-- Tipo de movimiento de inventario.
CREATE DOMAIN D_MOVEMENT_TYPE AS VARCHAR(10) CHARACTER SET UTF8
    CHECK (VALUE IN ('ENTRADA', 'SALIDA', 'AJUSTE'));

-- Tipo de control postoperatorio.
CREATE DOMAIN D_CONTROL_TYPE AS VARCHAR(30) CHARACTER SET UTF8
    CHECK (VALUE IN ('CONTROL_RADIOGRAFICO', 'CURACION', 'RETIRO_PUNTOS',
                     'EVALUACION', 'RETIRO_IMPLANTES'));

-- Estado del control postoperatorio.
CREATE DOMAIN D_FOLLOW_UP_STATUS AS VARCHAR(10) CHARACTER SET UTF8
    CHECK (VALUE IN ('PENDIENTE', 'CUMPLIDO', 'PERDIDO'));

-- Categoría del inventario ortopédico.
CREATE DOMAIN D_INV_CATEGORY AS VARCHAR(20) CHARACTER SET UTF8
    CHECK (VALUE IN ('PLACAS', 'TORNILLOS', 'PINES', 'ALAMBRES', 'FIJADORES',
                     'INJERTOS', 'INSTRUMENTAL', 'SUTURAS', 'MEDICAMENTOS',
                     'INSUMOS'));

-- Lateralidad del procedimiento.
CREATE DOMAIN D_LATERALITY AS VARCHAR(20) CHARACTER SET UTF8
    CHECK (VALUE IN ('Izquierda', 'Derecha', 'Bilateral', 'No aplica'));