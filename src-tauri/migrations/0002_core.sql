-- ============================================================================
-- VetSurgeryTR · Migración 0002 — Núcleo de datos: las 8 tablas del dominio
-- ortopédico (OWNERS, PATIENTS, VETS, SURGERIES, INVENTORY_ITEMS,
-- INVENTORY_MOVEMENTS, SURGERY_MATERIALS, FOLLOW_UPS), generadores y triggers.
--
-- Catálogos: se garantizan con los DOMAINs de estado de 0001 (idénticos a
-- src/lib/api-types.ts de la web).
--
-- Notas:
--   * La columna de talla se llama ITEM_SIZE (SIZE es palabra reservada en
--     Firebird) y las de discriminador MVMT_TYPE / CONTROL_TYPE (TYPE
--     también es reservada).
--   * Las FKs se crean en orden de dependencia y replican el onDelete del
--     schema Prisma (Cascade para materiales/controles de una cirugía,
--     SetNull para el origen quirúrgico de un movimiento, Restrict para
--     las relaciones obligatorias).
--   * Códigos legibles: PAC-YYYY-NNNN, CIR-YYYY-NNNN e INV-NNNN los calcula
--     la app en Rust (máximo código existente + 1, igual que la web) y se
--     pasan explícitos en el INSERT; los generadores GEN_PATIENT_CODE,
--     GEN_INV_CODE y GEN_SURG_CODE quedan como contadores y como respaldo
--     en el trigger cuando se inserta sin CODE (INSERT manual con isql).
-- ============================================================================

-- ===================== PROPIETARIOS Y PACIENTES =============================
CREATE TABLE OWNERS (
    ID              D_PK NOT NULL PRIMARY KEY,
    DOCUMENT_TYPE   D_DOC_TYPE NOT NULL,
    DOCUMENT_NUMBER D_DOC_NUMBER NOT NULL,
    FULL_NAME       D_NAME NOT NULL,
    PHONE           D_PHONE,
    EMAIL           D_EMAIL,
    ADDRESS         D_ADDRESS,
    CITY            D_CITY,
    NOTES           D_NOTES,
    CREATED_AT      TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UPDATED_AT      TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT UNQ_OWNERS_DOC UNIQUE (DOCUMENT_TYPE, DOCUMENT_NUMBER)
);
CREATE GENERATOR GEN_OWNERS_ID;

CREATE TABLE PATIENTS (
    ID         D_PK NOT NULL PRIMARY KEY,
    CODE       D_CODE NOT NULL,                        -- PAC-YYYY-NNNN
    OWNER_ID   D_PK NOT NULL REFERENCES OWNERS (ID),
    NAME       D_NAME NOT NULL,
    SPECIES    D_NAME NOT NULL,                        -- Canino | Felino | Equino | ...
    BREED      D_NAME,
    SEX        D_SEX NOT NULL,
    BIRTH_DATE D_DATE,
    WEIGHT     D_QTY,                                  -- kg: crítico para implantes
    NEUTERED   BOOLEAN DEFAULT FALSE NOT NULL,
    COLOR      D_NAME,
    MICROCHIP  VARCHAR(30) CHARACTER SET UTF8,
    ACTIVE     BOOLEAN DEFAULT TRUE NOT NULL,
    NOTES      D_NOTES,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT UNQ_PATIENTS_CODE UNIQUE (CODE),
    CONSTRAINT UNQ_PATIENTS_MICROCHIP UNIQUE (MICROCHIP)
);
CREATE GENERATOR GEN_PATIENTS_ID;
CREATE GENERATOR GEN_PATIENT_CODE;

-- ============================ VETERINARIOS ==================================
CREATE TABLE VETS (
    ID         D_PK NOT NULL PRIMARY KEY,
    FULL_NAME  D_NAME NOT NULL,
    LICENSE    D_NAME,                                 -- Tarjeta profesional MV
    SPECIALTY  D_NAME,
    PHONE      D_PHONE,
    EMAIL      D_EMAIL,
    ACTIVE     BOOLEAN DEFAULT TRUE NOT NULL,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE GENERATOR GEN_VETS_ID;

-- =============================== CIRUGÍAS ===================================
CREATE TABLE SURGERIES (
    ID                  D_PK NOT NULL PRIMARY KEY,
    CODE                D_CODE NOT NULL,               -- CIR-YYYY-NNNN
    PATIENT_ID          D_PK NOT NULL REFERENCES PATIENTS (ID),
    VET_ID              D_PK REFERENCES VETS (ID) ON DELETE SET NULL,
    PROCEDURE_TYPE      VARCHAR(120) CHARACTER SET UTF8 NOT NULL,
    BODY_REGION         D_NAME,                        -- Fémur distal, Tibia proximal...
    LATERALITY          D_LATERALITY,
    DESCRIPTION         D_NOTES,
    SCHEDULED_AT        TIMESTAMP NOT NULL,
    DURATION_MIN        INTEGER,                       -- duración quirúrgica estimada
    ANESTHESIA_TYPE     VARCHAR(40) CHARACTER SET UTF8,
    ASA_RISK            INTEGER,                       -- ASA I–V (1-5)
    PREOPERATIVE_NOTES  D_NOTES,
    POSTOPERATIVE_NOTES D_NOTES,
    ESTIMATED_COST      D_AMOUNT,                      -- COP
    STATUS              D_SURGERY_STATUS DEFAULT 'PROGRAMADA' NOT NULL,
    STARTED_AT          TIMESTAMP,                     -- se fija al pasar a EN_CURSO
    COMPLETED_AT        TIMESTAMP,                     -- se fija al pasar a COMPLETADA
    CREATED_AT          TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UPDATED_AT          TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT UNQ_SURGERIES_CODE UNIQUE (CODE)
);
CREATE GENERATOR GEN_SURGERIES_ID;
CREATE GENERATOR GEN_SURG_CODE;

-- ========================= INVENTARIO ORTOPÉDICO ============================
CREATE TABLE INVENTORY_ITEMS (
    ID         D_PK NOT NULL PRIMARY KEY,
    CODE       D_CODE NOT NULL,                        -- INV-NNNN
    NAME       D_NAME NOT NULL,
    CATEGORY   D_INV_CATEGORY NOT NULL,
    SUB_TYPE   D_NAME,                                 -- LCP, cortical, Kirschner...
    MATERIAL   D_NAME,                                 -- Acero 316L, Titanio, PDS...
    ITEM_SIZE  D_SIZE,                                 -- 2.7 mm, 1.6 mm x 15 cm...
    UNIT       D_UNIT NOT NULL,                        -- pieza | caja | rollo...
    STOCK_QTY  D_QTY DEFAULT 0 NOT NULL,
    MIN_STOCK  D_QTY DEFAULT 0 NOT NULL,
    UNIT_COST  D_AMOUNT,                               -- COP
    SUPPLIER   D_NAME,
    LOT_NUMBER D_NAME,
    EXPIRES_AT D_DATE,
    LOCATION   D_NAME,
    ACTIVE     BOOLEAN DEFAULT TRUE NOT NULL,
    NOTES      D_NOTES,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT UNQ_INV_ITEMS_CODE UNIQUE (CODE)
);
CREATE GENERATOR GEN_INVENTORY_ITEMS_ID;
CREATE GENERATOR GEN_INV_CODE;

-- ENTRADA suma stock · SALIDA resta · AJUSTE fija el stock absoluto contado.
-- SURGERY_ID marca el origen cuando la salida es consumo quirúrgico.
CREATE TABLE INVENTORY_MOVEMENTS (
    ID          D_PK NOT NULL PRIMARY KEY,
    ITEM_ID     D_PK NOT NULL REFERENCES INVENTORY_ITEMS (ID),
    MVMT_TYPE   D_MOVEMENT_TYPE NOT NULL,
    QTY         D_QTY NOT NULL,                        -- ENTRADA/SALIDA: delta · AJUSTE: valor contado
    STOCK_AFTER D_QTY NOT NULL,                        -- snapshot del stock resultante
    UNIT_COST   D_AMOUNT,
    REASON      D_TEXT,
    SURGERY_ID  D_PK REFERENCES SURGERIES (ID) ON DELETE SET NULL,
    CREATED_AT  TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE GENERATOR GEN_INVENTORY_MOVEMENTS_ID;

-- Materiales planificados/consumidos por cirugía (platinas, clavos, suturas).
CREATE TABLE SURGERY_MATERIALS (
    ID          D_PK NOT NULL PRIMARY KEY,
    SURGERY_ID  D_PK NOT NULL REFERENCES SURGERIES (ID) ON DELETE CASCADE,
    ITEM_ID     D_PK NOT NULL REFERENCES INVENTORY_ITEMS (ID),
    QTY_PLANNED D_QTY DEFAULT 0 NOT NULL,
    QTY_USED    D_QTY,                                 -- se registra al completar la cirugía
    UNIT_COST   D_AMOUNT,                              -- snapshot del costo unitario
    NOTES       D_TEXT,
    CREATED_AT  TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UPDATED_AT  TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT UNQ_SURG_MATERIALS UNIQUE (SURGERY_ID, ITEM_ID)
);
CREATE GENERATOR GEN_SURGERY_MATERIALS_ID;

-- Controles postoperatorios (radiografías, curaciones, retiro de puntos...).
CREATE TABLE FOLLOW_UPS (
    ID             D_PK NOT NULL PRIMARY KEY,
    SURGERY_ID     D_PK NOT NULL REFERENCES SURGERIES (ID) ON DELETE CASCADE,
    SCHEDULED_DATE TIMESTAMP NOT NULL,
    CONTROL_TYPE   D_CONTROL_TYPE NOT NULL,
    NOTES          D_TEXT,
    STATUS         D_FOLLOW_UP_STATUS DEFAULT 'PENDIENTE' NOT NULL,
    DONE_AT        TIMESTAMP,                          -- se fija al pasar a CUMPLIDO
    CREATED_AT     TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE GENERATOR GEN_FOLLOW_UPS_ID;

-- ===================== TRIGGERS DE AUTOINCREMENTO ============================
SET TERM ^ ;

CREATE TRIGGER BI_OWNERS FOR OWNERS BEFORE INSERT AS
BEGIN
    IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_OWNERS_ID, 1);
END^

-- Paciente: ID automático; si no viene CODE se genera PAC-YYYY-NNNN con el
-- contador GEN_PATIENT_CODE (la app normalmente pasa el código calculado
-- con la semántica "máximo del año + 1", idéntica a la web).
CREATE TRIGGER BI_PATIENTS FOR PATIENTS BEFORE INSERT AS
BEGIN
    IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_PATIENTS_ID, 1);
    IF (NEW.CODE IS NULL) THEN
        NEW.CODE = 'PAC-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' ||
                   LPAD(CAST(GEN_ID(GEN_PATIENT_CODE, 1) AS VARCHAR(10)), 4, '0');
END^

CREATE TRIGGER BI_VETS FOR VETS BEFORE INSERT AS
BEGIN
    IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_VETS_ID, 1);
END^

-- Cirugía: ID automático; respaldo de CIR-YYYY-NNNN.
CREATE TRIGGER BI_SURGERIES FOR SURGERIES BEFORE INSERT AS
BEGIN
    IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_SURGERIES_ID, 1);
    IF (NEW.CODE IS NULL) THEN
        NEW.CODE = 'CIR-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' ||
                   LPAD(CAST(GEN_ID(GEN_SURG_CODE, 1) AS VARCHAR(10)), 4, '0');
END^

-- Ítem de inventario: ID automático; respaldo de INV-NNNN.
CREATE TRIGGER BI_INVENTORY_ITEMS FOR INVENTORY_ITEMS BEFORE INSERT AS
BEGIN
    IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_INVENTORY_ITEMS_ID, 1);
    IF (NEW.CODE IS NULL) THEN
        NEW.CODE = 'INV-' || LPAD(CAST(GEN_ID(GEN_INV_CODE, 1) AS VARCHAR(10)), 4, '0');
END^

CREATE TRIGGER BI_INVENTORY_MOVEMENTS FOR INVENTORY_MOVEMENTS BEFORE INSERT AS
BEGIN
    IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_INVENTORY_MOVEMENTS_ID, 1);
END^

CREATE TRIGGER BI_SURGERY_MATERIALS FOR SURGERY_MATERIALS BEFORE INSERT AS
BEGIN
    IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_SURGERY_MATERIALS_ID, 1);
END^

CREATE TRIGGER BI_FOLLOW_UPS FOR FOLLOW_UPS BEFORE INSERT AS
BEGIN
    IF (NEW.ID IS NULL) THEN NEW.ID = GEN_ID(GEN_FOLLOW_UPS_ID, 1);
END^

SET TERM ; ^
