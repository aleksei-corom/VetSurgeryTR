-- ============================================================================
-- VetSurgeryTR · Migración 0003 — Dataset de demostración (clínica ortopédica
-- colombiana). Se aplica UNA sola vez en el primer arranque (queda registrada
-- en _MIGRATIONS). FECHAS FIJAS realistas 2025-2026 e IDs/códigos explícitos.
--
-- Estado sembrado (coherente con "hoy" entre sep-2026 y principios de 2027):
--   * 2 cirugías COMPLETADAS (nov-2025 y sep-2026, la segunda del mes en
--     curso), 1 EN_CURSO (hoy) y 1 PROGRAMADA (futura).
--   * Controles postoperatorios: cumplidos, próximos y 2 vencidos.
--   * 3 alertas de stock bajo (ítems 1, 18 y 19).
-- Consistencia inventario: cada ítem tiene su ENTRADA inicial y las cirugías
-- completadas generaron SALIDAS con snapshot STOCK_AFTER, por lo que el stock
-- final = Σ movimientos (auditable desde la app).
-- Para regenerar el dataset basta con borrar el .fdb (ver README).
-- ============================================================================

-- ================================ VETERINARIOS ==============================
INSERT INTO VETS (ID, FULL_NAME, LICENSE, SPECIALTY, PHONE, EMAIL, CREATED_AT)
VALUES (1, 'Dr. Carlos Mendoza', 'MV-85432', 'Ortopedia y traumatología',
        '+57 315 765 4321', 'cmendoza@vetsurgerytr.com', '2025-09-15 10:00:00');

INSERT INTO VETS (ID, FULL_NAME, LICENSE, SPECIALTY, PHONE, EMAIL, CREATED_AT)
VALUES (2, 'Dra. Sofía Restrepo', 'MV-96120', 'Cirugía de tejidos blandos y ortopedia',
        '+57 314 876 5432', 'srestrepo@vetsurgerytr.com', '2025-09-15 10:05:00');

-- ================================ PROPIETARIOS ==============================
INSERT INTO OWNERS (ID, DOCUMENT_TYPE, DOCUMENT_NUMBER, FULL_NAME, PHONE, EMAIL, ADDRESS, CITY, NOTES, CREATED_AT)
VALUES (1, 'CC', '1024587433', 'Juan Carlos Ramírez Salazar', '+57 310 456 7890',
        'juan.ramirez@gmail.com', 'Calle 100 # 15-32, Chapinero', 'Bogotá D.C.',
        'Contacto preferido: WhatsApp.', '2025-09-20 09:30:00');

INSERT INTO OWNERS (ID, DOCUMENT_TYPE, DOCUMENT_NUMBER, FULL_NAME, PHONE, EMAIL, ADDRESS, CITY, CREATED_AT)
VALUES (2, 'CC', '52147896', 'María Fernanda Gómez Vélez', '+57 312 987 6543',
        'mf.gomez@hotmail.com', 'Carrera 43A # 10-25, El Poblado', 'Medellín', '2025-09-22 14:10:00');

INSERT INTO OWNERS (ID, DOCUMENT_TYPE, DOCUMENT_NUMBER, FULL_NAME, PHONE, EMAIL, ADDRESS, CITY, NOTES, CREATED_AT)
VALUES (3, 'NIT', '900456789-2', 'Fundación Patitas de Amor', '+57 601 555 1234',
        'donaciones@patitasdeamor.org', 'Calle 127 # 20-15, Suba', 'Bogotá D.C.',
        'Fundación de rescate canino. Canal directo por WhatsApp.', '2025-09-25 08:45:00');

INSERT INTO OWNERS (ID, DOCUMENT_TYPE, DOCUMENT_NUMBER, FULL_NAME, PHONE, EMAIL, ADDRESS, CITY, CREATED_AT)
VALUES (4, 'CC', '1085236741', 'Camila Rodríguez Pineda', '+57 311 222 3344',
        'camila.rodriguez@gmail.com', 'Carrera 7 # 63-20, Chapinero Alto', 'Bogotá D.C.', '2025-09-26 16:20:00');

-- ================================= PACIENTES ================================
-- Códigos PAC-2025-NNNN explícitos (sembrados en 2025).
INSERT INTO PATIENTS (ID, CODE, OWNER_ID, NAME, SPECIES, BREED, SEX, BIRTH_DATE, WEIGHT, NEUTERED, COLOR, NOTES, CREATED_AT)
VALUES (1, 'PAC-2025-0001', 1, 'Rocky', 'Canino', 'Labrador Retriever', 'M', '2021-04-10', 34.0, TRUE, 'Dorado',
        'Ruptura de ligamento cruzado craneal izquierdo confirmada. Requiere manejo estricto del reposo.',
        '2025-10-01 11:00:00');

INSERT INTO PATIENTS (ID, CODE, OWNER_ID, NAME, SPECIES, BREED, SEX, BIRTH_DATE, WEIGHT, NEUTERED, COLOR, NOTES, CREATED_AT)
VALUES (2, 'PAC-2025-0002', 2, 'Lola', 'Canino', 'French Bulldog', 'F', '2022-05-10', 11.0, TRUE, 'Blanco con parches',
        'Luxación de rótula grado II. Cojera intermitente en miembro posterior.',
        '2025-10-02 10:30:00');

INSERT INTO PATIENTS (ID, CODE, OWNER_ID, NAME, SPECIES, BREED, SEX, BIRTH_DATE, WEIGHT, NEUTERED, COLOR, MICROCHIP, NOTES, CREATED_AT)
VALUES (3, 'PAC-2025-0003', 1, 'Bruno', 'Canino', 'Pastor Alemán', 'M', '2020-01-10', 38.0, FALSE, 'Negro y fuego',
        '977000123456789', 'Fractura de fémur izquierdo por atropello. ORIF realizada, buena evolución.',
        '2025-10-03 09:15:00');

INSERT INTO PATIENTS (ID, CODE, OWNER_ID, NAME, SPECIES, BREED, SEX, BIRTH_DATE, WEIGHT, NEUTERED, COLOR, MICROCHIP, NOTES, CREATED_AT)
VALUES (4, 'PAC-2025-0004', 3, 'Dante', 'Canino', 'Golden Retriever', 'M', '2019-08-10', 30.0, TRUE, 'Dorado',
        '977000987654321', 'Rescatado por la fundación y adoptado. En control postoperatorio de TPLO derecha.',
        '2025-10-05 15:40:00');

INSERT INTO PATIENTS (ID, CODE, OWNER_ID, NAME, SPECIES, BREED, SEX, BIRTH_DATE, WEIGHT, NEUTERED, COLOR, NOTES, CREATED_AT)
VALUES (5, 'PAC-2025-0005', 4, 'Selma', 'Felino', 'Mestizo', 'F', '2021-11-10', 4.2, TRUE, 'Gris atigrado',
        'Luxación tibiotarsiana traumática. Artrodesis de tarso izquierdo en curso.',
        '2025-10-06 08:50:00');

INSERT INTO PATIENTS (ID, CODE, OWNER_ID, NAME, SPECIES, BREED, SEX, BIRTH_DATE, WEIGHT, NEUTERED, COLOR, MICROCHIP, NOTES, CREATED_AT)
VALUES (6, 'PAC-2025-0006', 2, 'Luna', 'Felino', 'Mestizo', 'F', '2023-01-10', 5.1, TRUE, 'Blanco y negro',
        '977000555111333', 'Paciente sana. Consulta por cojera leve en miembro posterior derecho.',
        '2025-10-06 09:20:00');

-- ============================== INVENTARIO ==================================
-- 20 ítems ortopédicos reales en COP. STOCK_QTY = ENTRADA − consumos de las
-- cirugías completadas (ver movimientos al final).
INSERT INTO INVENTORY_ITEMS (ID, CODE, NAME, CATEGORY, SUB_TYPE, MATERIAL, ITEM_SIZE, UNIT, STOCK_QTY, MIN_STOCK, UNIT_COST, SUPPLIER, LOT_NUMBER, EXPIRES_AT, LOCATION, NOTES, CREATED_AT, UPDATED_AT)
VALUES (1, 'INV-0001', 'Platina LCP 3.5 mm 8 agujeros', 'PLACAS', 'LCP (bloqueo)', 'Titanio',
        '3.5 mm · 8 agujeros', 'pieza', 2, 2, 850000, 'Zimmer Veterinary', NULL, NULL, 'Vitrina A-1',
        'Sistema de bloqueo — requiere tornillos LCP.', '2025-10-06 09:00:00', '2025-10-06 09:00:00');

INSERT INTO INVENTORY_ITEMS (ID, CODE, NAME, CATEGORY, SUB_TYPE, MATERIAL, ITEM_SIZE, UNIT, STOCK_QTY, MIN_STOCK, UNIT_COST, SUPPLIER, LOT_NUMBER, EXPIRES_AT, LOCATION, CREATED_AT, UPDATED_AT)
VALUES (2, 'INV-0002', 'Platina de compresión 2.7 mm 6 agujeros', 'PLACAS', 'Compresión (DCP)', 'Acero 316L',
        '2.7 mm · 6 agujeros', 'pieza', 4, 2, 620000, 'Zimmer Veterinary', NULL, NULL, 'Vitrina A-2',
        '2025-10-06 09:00:00', '2025-10-06 09:00:00');

INSERT INTO INVENTORY_ITEMS (ID, CODE, NAME, CATEGORY, SUB_TYPE, MATERIAL, ITEM_SIZE, UNIT, STOCK_QTY, MIN_STOCK, UNIT_COST, SUPPLIER, LOT_NUMBER, EXPIRES_AT, LOCATION, CREATED_AT, UPDATED_AT)
VALUES (3, 'INV-0003', 'Tornillo cortical 3.5 mm auto-perforante', 'TORNILLOS', 'Cortical auto-perforante',
        'Acero 316L', '3.5 mm', 'pieza', 20, 10, 95000, 'Zimmer Veterinary', NULL, NULL, 'Vitrina B-1',
        '2025-10-06 09:00:00', '2025-10-06 09:00:00');

INSERT INTO INVENTORY_ITEMS (ID, CODE, NAME, CATEGORY, SUB_TYPE, MATERIAL, ITEM_SIZE, UNIT, STOCK_QTY, MIN_STOCK, UNIT_COST, SUPPLIER, LOT_NUMBER, EXPIRES_AT, LOCATION, CREATED_AT, UPDATED_AT)
VALUES (4, 'INV-0004', 'Tornillo cortical 2.7 mm auto-perforante', 'TORNILLOS', 'Cortical auto-perforante',
        'Acero 316L', '2.7 mm', 'pieza', 10, 5, 82000, 'Zimmer Veterinary', NULL, NULL, 'Vitrina B-1',
        '2025-10-06 09:00:00', '2025-10-06 09:00:00');

INSERT INTO INVENTORY_ITEMS (ID, CODE, NAME, CATEGORY, SUB_TYPE, MATERIAL, ITEM_SIZE, UNIT, STOCK_QTY, MIN_STOCK, UNIT_COST, SUPPLIER, LOT_NUMBER, EXPIRES_AT, LOCATION, NOTES, CREATED_AT, UPDATED_AT)
VALUES (5, 'INV-0005', 'Tornillo de bloqueo 3.5 mm cabeza estriada', 'TORNILLOS', 'Bloqueo (LCP)', 'Titanio',
        '3.5 mm', 'pieza', 15, 6, 105000, 'Zimmer Veterinary', NULL, NULL, 'Vitrina B-3',
        'Exclusivo para platinas LCP.', '2025-10-06 09:00:00', '2025-10-06 09:00:00');

INSERT INTO INVENTORY_ITEMS (ID, CODE, NAME, CATEGORY, SUB_TYPE, MATERIAL, ITEM_SIZE, UNIT, STOCK_QTY, MIN_STOCK, UNIT_COST, SUPPLIER, LOT_NUMBER, EXPIRES_AT, LOCATION, CREATED_AT, UPDATED_AT)
VALUES (6, 'INV-0006', 'Clavo Kirschner 1.6 mm x 15 cm', 'PINES', 'Kirschner', 'Acero 316L',
        '1.6 mm x 15 cm', 'pieza', 24, 12, 28000, 'Kruuse Colombia', NULL, NULL, 'Estante D-1',
        '2025-10-06 09:00:00', '2025-10-06 09:00:00');

INSERT INTO INVENTORY_ITEMS (ID, CODE, NAME, CATEGORY, SUB_TYPE, MATERIAL, ITEM_SIZE, UNIT, STOCK_QTY, MIN_STOCK, UNIT_COST, SUPPLIER, LOT_NUMBER, EXPIRES_AT, LOCATION, CREATED_AT, UPDATED_AT)
VALUES (7, 'INV-0007', 'Clavo Kirschner 2.0 mm x 15 cm', 'PINES', 'Kirschner', 'Acero 316L',
        '2.0 mm x 15 cm', 'pieza', 12, 6, 32000, 'Kruuse Colombia', NULL, NULL, 'Estante D-1',
        '2025-10-06 09:00:00', '2025-10-06 09:00:00');

INSERT INTO INVENTORY_ITEMS (ID, CODE, NAME, CATEGORY, SUB_TYPE, MATERIAL, ITEM_SIZE, UNIT, STOCK_QTY, MIN_STOCK, UNIT_COST, SUPPLIER, LOT_NUMBER, EXPIRES_AT, LOCATION, CREATED_AT, UPDATED_AT)
VALUES (8, 'INV-0008', 'Clavo intramedular Steinmann 3.2 mm x 20 cm', 'PINES', 'Steinmann', 'Acero 316L',
        '3.2 mm x 20 cm', 'pieza', 4, 2, 65000, 'Kruuse Colombia', NULL, NULL, 'Estante D-2',
        '2025-10-06 09:00:00', '2025-10-06 09:00:00');

INSERT INTO INVENTORY_ITEMS (ID, CODE, NAME, CATEGORY, SUB_TYPE, MATERIAL, ITEM_SIZE, UNIT, STOCK_QTY, MIN_STOCK, UNIT_COST, SUPPLIER, LOT_NUMBER, EXPIRES_AT, LOCATION, CREATED_AT, UPDATED_AT)
VALUES (9, 'INV-0009', 'Alambre de cerclaje 1.0 mm (rollo 25 m)', 'ALAMBRES', 'Cerclaje', 'Acero 316L',
        '1.0 mm', 'rollo', 6, 3, 45000, 'Kruuse Colombia', NULL, NULL, 'Estante D-3',
        '2025-10-06 09:00:00', '2025-10-06 09:00:00');

INSERT INTO INVENTORY_ITEMS (ID, CODE, NAME, CATEGORY, SUB_TYPE, MATERIAL, ITEM_SIZE, UNIT, STOCK_QTY, MIN_STOCK, UNIT_COST, SUPPLIER, LOT_NUMBER, EXPIRES_AT, LOCATION, NOTES, CREATED_AT, UPDATED_AT)
VALUES (10, 'INV-0010', 'Fijador externo tipo II kit completo', 'FIJADORES', 'Fijador externo tipo II',
        'Acero inoxidable', 'Clamps 3.5/4.0 mm', 'kit', 2, 1, 2400000, 'Kruuse Colombia', NULL, NULL, 'Vitrina E-1',
        'Incluye barras, clamps y llaves.', '2025-10-06 09:00:00', '2025-10-06 09:00:00');

INSERT INTO INVENTORY_ITEMS (ID, CODE, NAME, CATEGORY, SUB_TYPE, MATERIAL, ITEM_SIZE, UNIT, STOCK_QTY, MIN_STOCK, UNIT_COST, SUPPLIER, LOT_NUMBER, EXPIRES_AT, LOCATION, CREATED_AT, UPDATED_AT)
VALUES (11, 'INV-0011', 'Pin transcortical 3.5 mm rosca positiva', 'FIJADORES', 'Pin transcortical',
        'Acero 316L', '3.5 mm', 'pieza', 8, 4, 98000, 'Kruuse Colombia', NULL, NULL, 'Vitrina E-2',
        '2025-10-06 09:00:00', '2025-10-06 09:00:00');

INSERT INTO INVENTORY_ITEMS (ID, CODE, NAME, CATEGORY, SUB_TYPE, ITEM_SIZE, UNIT, STOCK_QTY, MIN_STOCK, UNIT_COST, SUPPLIER, LOT_NUMBER, EXPIRES_AT, LOCATION, NOTES, CREATED_AT, UPDATED_AT)
VALUES (12, 'INV-0012', 'Aloinjerto óseo cortical liofilizado 5 cc', 'INJERTOS', 'Aloinjerto cortical',
        '5 cc', 'frasco', 3, 2, 380000, 'Banco de Tejidos VetCol', 'BT-2025-118', '2027-03-31', 'Refrigerado C-2',
        'Conservar entre 2-8 °C. No congelar.', '2025-10-06 09:00:00', '2025-10-06 09:00:00');

INSERT INTO INVENTORY_ITEMS (ID, CODE, NAME, CATEGORY, SUB_TYPE, ITEM_SIZE, UNIT, STOCK_QTY, MIN_STOCK, UNIT_COST, SUPPLIER, LOT_NUMBER, EXPIRES_AT, LOCATION, CREATED_AT, UPDATED_AT)
VALUES (13, 'INV-0013', 'Injerto sintético TCP granular 10 cc', 'INJERTOS', 'TCP sintético (β-fosfato tricálcico)',
        '10 cc', 'frasco', 4, 2, 290000, 'Zimmer Veterinary', NULL, NULL, 'Estante C-1',
        '2025-10-06 09:00:00', '2025-10-06 09:00:00');

INSERT INTO INVENTORY_ITEMS (ID, CODE, NAME, CATEGORY, SUB_TYPE, MATERIAL, ITEM_SIZE, UNIT, STOCK_QTY, MIN_STOCK, UNIT_COST, SUPPLIER, LOT_NUMBER, EXPIRES_AT, LOCATION, CREATED_AT, UPDATED_AT)
VALUES (14, 'INV-0014', 'Broca 2.5 mm para ortopedia', 'INSTRUMENTAL', 'Broca', 'Acero rápido (HSS)',
        '2.5 mm', 'pieza', 5, 3, 165000, 'Zimmer Veterinary', NULL, NULL, 'Caja de instrumental 1',
        '2025-10-06 09:00:00', '2025-10-06 09:00:00');

INSERT INTO INVENTORY_ITEMS (ID, CODE, NAME, CATEGORY, SUB_TYPE, MATERIAL, ITEM_SIZE, UNIT, STOCK_QTY, MIN_STOCK, UNIT_COST, SUPPLIER, LOT_NUMBER, EXPIRES_AT, LOCATION, NOTES, CREATED_AT, UPDATED_AT)
VALUES (15, 'INV-0015', 'Broca 2.8 mm para ortopedia', 'INSTRUMENTAL', 'Broca', 'Acero rápido (HSS)',
        '2.8 mm', 'pieza', 6, 3, 180000, 'Zimmer Veterinary', NULL, NULL, 'Caja de instrumental 1',
        'Para tornillos de bloqueo 3.5 mm (cabeza estriada).', '2025-10-06 09:00:00', '2025-10-06 09:00:00');

INSERT INTO INVENTORY_ITEMS (ID, CODE, NAME, CATEGORY, SUB_TYPE, MATERIAL, ITEM_SIZE, UNIT, STOCK_QTY, MIN_STOCK, UNIT_COST, SUPPLIER, LOT_NUMBER, EXPIRES_AT, LOCATION, CREATED_AT, UPDATED_AT)
VALUES (16, 'INV-0016', 'PDS-II 0 (aguja FS1)', 'SUTURAS', 'Monofilamento absorbible', 'Polidioxanona',
        '0', 'unidad', 10, 4, 95000, 'Ethicon Colombia', 'PDS25-118', '2027-06-30', 'Estante B-1',
        '2025-10-06 09:00:00', '2025-10-06 09:00:00');

INSERT INTO INVENTORY_ITEMS (ID, CODE, NAME, CATEGORY, SUB_TYPE, MATERIAL, ITEM_SIZE, UNIT, STOCK_QTY, MIN_STOCK, UNIT_COST, SUPPLIER, LOT_NUMBER, EXPIRES_AT, LOCATION, CREATED_AT, UPDATED_AT)
VALUES (17, 'INV-0017', 'Monocryl 3-0 (aguja 3/8)', 'SUTURAS', 'Monofilamento absorbible', 'Poliglecaprona',
        '3-0', 'unidad', 9, 3, 78000, 'Ethicon Colombia', 'MC25-542', '2026-11-30', 'Estante B-1',
        '2025-10-06 09:00:00', '2025-10-06 09:00:00');

INSERT INTO INVENTORY_ITEMS (ID, CODE, NAME, CATEGORY, SUB_TYPE, ITEM_SIZE, UNIT, STOCK_QTY, MIN_STOCK, UNIT_COST, SUPPLIER, LOT_NUMBER, EXPIRES_AT, LOCATION, NOTES, CREATED_AT, UPDATED_AT)
VALUES (18, 'INV-0018', 'Cefazolina 1 g inyectable', 'MEDICAMENTOS', 'Antibiótico cefalosporina',
        '1 g', 'frasco', 6, 6, 12500, 'MSD Animal Health', 'CFZ-2509', '2026-10-31', 'Refrigerado C-1',
        'Profilaxis antibiótica preoperatoria (30 min antes de incisión).', '2025-10-06 09:00:00', '2025-10-06 09:00:00');

INSERT INTO INVENTORY_ITEMS (ID, CODE, NAME, CATEGORY, SUB_TYPE, MATERIAL, ITEM_SIZE, UNIT, STOCK_QTY, MIN_STOCK, UNIT_COST, SUPPLIER, LOT_NUMBER, EXPIRES_AT, LOCATION, NOTES, CREATED_AT, UPDATED_AT)
VALUES (19, 'INV-0019', 'Guantes estériles talla 7.5', 'INSUMOS', 'Guante quirúrgico', 'Látex',
        '7.5', 'par', 8, 10, 4200, 'Kruuse Colombia', NULL, NULL, 'Estante E-1',
        'CRÍTICO: stock bajo permanente por alto consumo.', '2025-10-06 09:00:00', '2025-10-06 09:00:00');

INSERT INTO INVENTORY_ITEMS (ID, CODE, NAME, CATEGORY, SUB_TYPE, ITEM_SIZE, UNIT, STOCK_QTY, MIN_STOCK, UNIT_COST, SUPPLIER, LOT_NUMBER, EXPIRES_AT, LOCATION, CREATED_AT, UPDATED_AT)
VALUES (20, 'INV-0020', 'Venda cohesiva 10 cm x 4.5 m', 'INSUMOS', 'Venda cohesiva',
        '10 cm', 'rollo', 12, 6, 12500, 'Kruuse Colombia', NULL, NULL, 'Estante E-2',
        '2025-10-06 09:00:00', '2025-10-06 09:00:00');

-- ================================ CIRUGÍAS ==================================
-- 1) Bruno · ORIF fémur izquierdo · COMPLETADA (2025-11-18, con consumo).
INSERT INTO SURGERIES (ID, CODE, PATIENT_ID, VET_ID, PROCEDURE_TYPE, BODY_REGION, LATERALITY, DESCRIPTION,
                       SCHEDULED_AT, DURATION_MIN, ANESTHESIA_TYPE, ASA_RISK, PREOPERATIVE_NOTES,
                       POSTOPERATIVE_NOTES, ESTIMATED_COST, STATUS, STARTED_AT, COMPLETED_AT, CREATED_AT)
VALUES (1, 'CIR-2025-0001', 3, 1, 'Reparación de fractura (ORIF)', 'Fémur distal', 'Izquierda',
        'Fractura diafisaria de fémur por atropello. Reducción abierta con platina LCP y cerclaje.',
        '2025-11-18 08:30:00', 120, 'General inhalatoria', 2,
        'Ayuno sólido de 8 h. Radiografías ortostáticas en 2 proyecciones. Perfil preanestésico normal.',
        'Analgesia multimodal, reposo estricto 4 semanas y control radiográfico mensual.',
        3200000, 'COMPLETADA', '2025-11-18 08:40:00', '2025-11-18 11:05:00', '2025-11-13 10:20:00');

-- 2) Dante · TPLO derecha · COMPLETADA (2026-09-03, mes en curso, con consumo).
INSERT INTO SURGERIES (ID, CODE, PATIENT_ID, VET_ID, PROCEDURE_TYPE, BODY_REGION, LATERALITY, DESCRIPTION,
                       SCHEDULED_AT, DURATION_MIN, ANESTHESIA_TYPE, ASA_RISK, PREOPERATIVE_NOTES,
                       POSTOPERATIVE_NOTES, ESTIMATED_COST, STATUS, STARTED_AT, COMPLETED_AT, CREATED_AT)
VALUES (2, 'CIR-2026-0001', 4, 1, 'TPLO (Nivelación de la cresta tibial)', 'Tibia proximal', 'Derecha',
        'Ruptura completa del ligamento cruzado craneal. Osteotomía niveladora con platina de compresión.',
        '2026-09-03 08:00:00', 90, 'General inhalatoria', 2,
        'Ayuno 8 h. Perfil preanestésico y radiografías de rodilla en proyección mediolateral.',
        'Analgesia con AINE 7 días, vendaje Robert Jones 48 h y reposo 6 semanas.',
        4100000, 'COMPLETADA', '2026-09-03 08:10:00', '2026-09-03 10:35:00', '2026-08-28 11:00:00');

-- 3) Rocky · TPLO izquierda · PROGRAMADA (2026-09-24, futura).
INSERT INTO SURGERIES (ID, CODE, PATIENT_ID, VET_ID, PROCEDURE_TYPE, BODY_REGION, LATERALITY, DESCRIPTION,
                       SCHEDULED_AT, DURATION_MIN, ANESTHESIA_TYPE, ASA_RISK, PREOPERATIVE_NOTES,
                       POSTOPERATIVE_NOTES, ESTIMATED_COST, STATUS, CREATED_AT)
VALUES (3, 'CIR-2026-0002', 1, 1, 'TPLO (Nivelación de la cresta tibial)', 'Tibia proximal', 'Izquierda',
        'Ruptura del ligamento cruzado craneal en paciente activo de 34 kg.',
        '2026-09-24 08:00:00', 100, 'General inhalatoria', 2,
        'Ayuno 8 h. Radiografías preoperatorias y perfil preanestésico pendientes de cargar.',
        NULL,
        4300000, 'PROGRAMADA', '2026-09-08 15:30:00');

-- 4) Selma · Artrodesis de tarso · EN_CURSO (2026-09-11, hoy).
INSERT INTO SURGERIES (ID, CODE, PATIENT_ID, VET_ID, PROCEDURE_TYPE, BODY_REGION, LATERALITY, DESCRIPTION,
                       SCHEDULED_AT, DURATION_MIN, ANESTHESIA_TYPE, ASA_RISK, PREOPERATIVE_NOTES,
                       POSTOPERATIVE_NOTES, ESTIMATED_COST, STATUS, STARTED_AT, CREATED_AT)
VALUES (4, 'CIR-2026-0003', 5, 2, 'Artrodesis (Fusión articular)', 'Tarso (tibiotarsiana)', 'Izquierda',
        'Luxación tibiotarsiana traumática crónica. Fusión quirúrgica con clavos Kirschner y cerclaje.',
        '2026-09-11 08:00:00', 75, 'Sedación + local', 3,
        'Felino 4.2 kg. Vía cefálica cateterizada, ayuno de 6 h.',
        NULL,
        1850000, 'EN_CURSO', '2026-09-11 08:15:00', '2026-08-30 09:40:00');

-- ============================ MATERIALES ====================================
-- Cirugía 1 (COMPLETADA): consumo registrado → stock descontado.
INSERT INTO SURGERY_MATERIALS (ID, SURGERY_ID, ITEM_ID, QTY_PLANNED, QTY_USED, UNIT_COST, NOTES)
VALUES (1, 1, 1, 1, 1, 850000, 'Platina LCP de 8 agujeros sobre fémur izquierdo.');
INSERT INTO SURGERY_MATERIALS (ID, SURGERY_ID, ITEM_ID, QTY_PLANNED, QTY_USED, UNIT_COST)
VALUES (2, 1, 3, 6, 6, 95000);
INSERT INTO SURGERY_MATERIALS (ID, SURGERY_ID, ITEM_ID, QTY_PLANNED, QTY_USED, UNIT_COST, NOTES)
VALUES (3, 1, 6, 2, 2, 28000, 'Clavos Kirschner como refuerzo rotacional.');
INSERT INTO SURGERY_MATERIALS (ID, SURGERY_ID, ITEM_ID, QTY_PLANNED, QTY_USED, UNIT_COST)
VALUES (4, 1, 16, 1, 1, 95000);
INSERT INTO SURGERY_MATERIALS (ID, SURGERY_ID, ITEM_ID, QTY_PLANNED, QTY_USED, UNIT_COST, NOTES)
VALUES (5, 1, 18, 1, 1, 12500, 'Profilaxis antibiótica preoperatoria.');

-- Cirugía 2 (COMPLETADA): consumo registrado.
INSERT INTO SURGERY_MATERIALS (ID, SURGERY_ID, ITEM_ID, QTY_PLANNED, QTY_USED, UNIT_COST, NOTES)
VALUES (6, 2, 2, 1, 1, 620000, 'Platina de compresión 2.7 en cresta tibial.');
INSERT INTO SURGERY_MATERIALS (ID, SURGERY_ID, ITEM_ID, QTY_PLANNED, QTY_USED, UNIT_COST)
VALUES (7, 2, 4, 4, 4, 82000);
INSERT INTO SURGERY_MATERIALS (ID, SURGERY_ID, ITEM_ID, QTY_PLANNED, QTY_USED, UNIT_COST)
VALUES (8, 2, 5, 4, 4, 105000);
INSERT INTO SURGERY_MATERIALS (ID, SURGERY_ID, ITEM_ID, QTY_PLANNED, QTY_USED, UNIT_COST)
VALUES (9, 2, 17, 1, 1, 78000);
INSERT INTO SURGERY_MATERIALS (ID, SURGERY_ID, ITEM_ID, QTY_PLANNED, QTY_USED, UNIT_COST)
VALUES (10, 2, 18, 1, 1, 12500);

-- Cirugía 3 (PROGRAMADA): planificación de implantes, sin consumo.
INSERT INTO SURGERY_MATERIALS (ID, SURGERY_ID, ITEM_ID, QTY_PLANNED, QTY_USED, UNIT_COST)
VALUES (11, 3, 1, 1, NULL, 850000);
INSERT INTO SURGERY_MATERIALS (ID, SURGERY_ID, ITEM_ID, QTY_PLANNED, QTY_USED, UNIT_COST)
VALUES (12, 3, 5, 8, NULL, 105000);
INSERT INTO SURGERY_MATERIALS (ID, SURGERY_ID, ITEM_ID, QTY_PLANNED, QTY_USED, UNIT_COST)
VALUES (13, 3, 16, 1, NULL, 95000);

-- Cirugía 4 (EN_CURSO): materiales planificados, aún sin consumo.
INSERT INTO SURGERY_MATERIALS (ID, SURGERY_ID, ITEM_ID, QTY_PLANNED, QTY_USED, UNIT_COST)
VALUES (14, 4, 7, 2, NULL, 32000);
INSERT INTO SURGERY_MATERIALS (ID, SURGERY_ID, ITEM_ID, QTY_PLANNED, QTY_USED, UNIT_COST)
VALUES (15, 4, 9, 1, NULL, 45000);
INSERT INTO SURGERY_MATERIALS (ID, SURGERY_ID, ITEM_ID, QTY_PLANNED, QTY_USED, UNIT_COST)
VALUES (16, 4, 17, 1, NULL, 78000);

-- =========================== MOVIMIENTOS ====================================
-- ENTRADAS iniciales (2025-10-06) para que existencias y movimientos cuadren
-- desde el primer día. Stock final de cada ítem = ENTRADA − SALIDAS.
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, UNIT_COST, REASON, CREATED_AT)
VALUES (1, 1, 'ENTRADA', 3, 3, 850000, 'Compra inicial de inventario (dotación clínica)', '2025-10-06 09:00:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, UNIT_COST, REASON, CREATED_AT)
VALUES (2, 2, 'ENTRADA', 5, 5, 620000, 'Compra inicial de inventario (dotación clínica)', '2025-10-06 09:00:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, UNIT_COST, REASON, CREATED_AT)
VALUES (3, 3, 'ENTRADA', 26, 26, 95000, 'Compra inicial de inventario (dotación clínica)', '2025-10-06 09:00:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, UNIT_COST, REASON, CREATED_AT)
VALUES (4, 4, 'ENTRADA', 14, 14, 82000, 'Compra inicial de inventario (dotación clínica)', '2025-10-06 09:00:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, UNIT_COST, REASON, CREATED_AT)
VALUES (5, 5, 'ENTRADA', 19, 19, 105000, 'Compra inicial de inventario (dotación clínica)', '2025-10-06 09:00:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, UNIT_COST, REASON, CREATED_AT)
VALUES (6, 6, 'ENTRADA', 26, 26, 28000, 'Compra inicial de inventario (dotación clínica)', '2025-10-06 09:00:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, UNIT_COST, REASON, CREATED_AT)
VALUES (7, 7, 'ENTRADA', 12, 12, 32000, 'Compra inicial de inventario (dotación clínica)', '2025-10-06 09:00:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, UNIT_COST, REASON, CREATED_AT)
VALUES (8, 8, 'ENTRADA', 4, 4, 65000, 'Compra inicial de inventario (dotación clínica)', '2025-10-06 09:00:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, UNIT_COST, REASON, CREATED_AT)
VALUES (9, 9, 'ENTRADA', 6, 6, 45000, 'Compra inicial de inventario (dotación clínica)', '2025-10-06 09:00:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, UNIT_COST, REASON, CREATED_AT)
VALUES (10, 10, 'ENTRADA', 2, 2, 2400000, 'Compra inicial de inventario (dotación clínica)', '2025-10-06 09:00:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, UNIT_COST, REASON, CREATED_AT)
VALUES (11, 11, 'ENTRADA', 8, 8, 98000, 'Compra inicial de inventario (dotación clínica)', '2025-10-06 09:00:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, UNIT_COST, REASON, CREATED_AT)
VALUES (12, 12, 'ENTRADA', 3, 3, 380000, 'Compra inicial de inventario (dotación clínica)', '2025-10-06 09:00:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, UNIT_COST, REASON, CREATED_AT)
VALUES (13, 13, 'ENTRADA', 4, 4, 290000, 'Compra inicial de inventario (dotación clínica)', '2025-10-06 09:00:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, UNIT_COST, REASON, CREATED_AT)
VALUES (14, 14, 'ENTRADA', 5, 5, 165000, 'Compra inicial de inventario (dotación clínica)', '2025-10-06 09:00:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, UNIT_COST, REASON, CREATED_AT)
VALUES (15, 15, 'ENTRADA', 6, 6, 180000, 'Compra inicial de inventario (dotación clínica)', '2025-10-06 09:00:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, UNIT_COST, REASON, CREATED_AT)
VALUES (16, 16, 'ENTRADA', 11, 11, 95000, 'Compra inicial de inventario (dotación clínica)', '2025-10-06 09:00:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, UNIT_COST, REASON, CREATED_AT)
VALUES (17, 17, 'ENTRADA', 10, 10, 78000, 'Compra inicial de inventario (dotación clínica)', '2025-10-06 09:00:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, UNIT_COST, REASON, CREATED_AT)
VALUES (18, 18, 'ENTRADA', 8, 8, 12500, 'Compra inicial de inventario (dotación clínica)', '2025-10-06 09:00:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, UNIT_COST, REASON, CREATED_AT)
VALUES (19, 19, 'ENTRADA', 8, 8, 4200, 'Compra inicial de inventario (dotación clínica)', '2025-10-06 09:00:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, UNIT_COST, REASON, CREATED_AT)
VALUES (20, 20, 'ENTRADA', 12, 12, 12500, 'Compra inicial de inventario (dotación clínica)', '2025-10-06 09:00:00');

-- Salidas por consumo de la cirugía 1 (CIR-2025-0001, completada 2025-11-18).
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, REASON, SURGERY_ID, CREATED_AT)
VALUES (21, 1, 'SALIDA', 1, 2, 'Consumo cirugía CIR-2025-0001', 1, '2025-11-18 11:05:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, REASON, SURGERY_ID, CREATED_AT)
VALUES (22, 3, 'SALIDA', 6, 20, 'Consumo cirugía CIR-2025-0001', 1, '2025-11-18 11:05:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, REASON, SURGERY_ID, CREATED_AT)
VALUES (23, 6, 'SALIDA', 2, 24, 'Consumo cirugía CIR-2025-0001', 1, '2025-11-18 11:05:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, REASON, SURGERY_ID, CREATED_AT)
VALUES (24, 16, 'SALIDA', 1, 10, 'Consumo cirugía CIR-2025-0001', 1, '2025-11-18 11:05:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, REASON, SURGERY_ID, CREATED_AT)
VALUES (25, 18, 'SALIDA', 1, 7, 'Consumo cirugía CIR-2025-0001', 1, '2025-11-18 11:05:00');

-- Salidas por consumo de la cirugía 2 (CIR-2026-0001, completada 2026-09-03).
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, REASON, SURGERY_ID, CREATED_AT)
VALUES (26, 2, 'SALIDA', 1, 4, 'Consumo cirugía CIR-2026-0001', 2, '2026-09-03 10:35:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, REASON, SURGERY_ID, CREATED_AT)
VALUES (27, 4, 'SALIDA', 4, 10, 'Consumo cirugía CIR-2026-0001', 2, '2026-09-03 10:35:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, REASON, SURGERY_ID, CREATED_AT)
VALUES (28, 5, 'SALIDA', 4, 15, 'Consumo cirugía CIR-2026-0001', 2, '2026-09-03 10:35:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, REASON, SURGERY_ID, CREATED_AT)
VALUES (29, 17, 'SALIDA', 1, 9, 'Consumo cirugía CIR-2026-0001', 2, '2026-09-03 10:35:00');
INSERT INTO INVENTORY_MOVEMENTS (ID, ITEM_ID, MVMT_TYPE, QTY, STOCK_AFTER, REASON, SURGERY_ID, CREATED_AT)
VALUES (30, 18, 'SALIDA', 1, 6, 'Consumo cirugía CIR-2026-0001', 2, '2026-09-03 10:35:00');

-- ========================= CONTROLES POSTOPERATORIOS ========================
-- Cirugía 1 (Bruno, completada 2025-11-18): los primeros controles cumplidos
-- y la evaluación a 90 días quedó vencida.
INSERT INTO FOLLOW_UPS (ID, SURGERY_ID, SCHEDULED_DATE, CONTROL_TYPE, NOTES, STATUS, DONE_AT)
VALUES (1, 1, '2025-12-02 10:00:00', 'RETIRO_PUNTOS', 'Retiro de puntos de piel.', 'CUMPLIDO', '2025-12-02 10:15:00');
INSERT INTO FOLLOW_UPS (ID, SURGERY_ID, SCHEDULED_DATE, CONTROL_TYPE, NOTES, STATUS, DONE_AT)
VALUES (2, 1, '2025-12-18 16:00:00', 'CONTROL_RADIOGRAFICO',
        'Radiografía de control a 30 días para evaluar callo óseo.', 'CUMPLIDO', '2025-12-18 16:40:00');
INSERT INTO FOLLOW_UPS (ID, SURGERY_ID, SCHEDULED_DATE, CONTROL_TYPE, NOTES, STATUS)
VALUES (3, 1, '2026-02-16 09:00:00', 'EVALUACION',
        'Evaluación de consolidación y función del miembro a 90 días (vencida, contactar).', 'PENDIENTE');

-- Cirugía 2 (Dante, completada 2026-09-03).
INSERT INTO FOLLOW_UPS (ID, SURGERY_ID, SCHEDULED_DATE, CONTROL_TYPE, NOTES, STATUS, DONE_AT)
VALUES (4, 2, '2026-09-08 08:30:00', 'CURACION', 'Curación de herida quirúrgica.', 'CUMPLIDO', '2026-09-08 08:50:00');
INSERT INTO FOLLOW_UPS (ID, SURGERY_ID, SCHEDULED_DATE, CONTROL_TYPE, NOTES, STATUS)
VALUES (5, 2, '2026-09-10 10:00:00', 'RETIRO_PUNTOS', 'Retiro de puntos (vencido, llamar a la fundación).', 'PENDIENTE');
INSERT INTO FOLLOW_UPS (ID, SURGERY_ID, SCHEDULED_DATE, CONTROL_TYPE, NOTES, STATUS)
VALUES (6, 2, '2026-10-03 16:00:00', 'CONTROL_RADIOGRAFICO',
        'Radiografía de control post-TPLO a 30 días.', 'PENDIENTE');

-- Cirugía 3 (Rocky, programada 2026-09-24).
INSERT INTO FOLLOW_UPS (ID, SURGERY_ID, SCHEDULED_DATE, CONTROL_TYPE, NOTES, STATUS)
VALUES (7, 3, '2026-10-01 10:00:00', 'CURACION', 'Curación de herida quirúrgica.', 'PENDIENTE');
INSERT INTO FOLLOW_UPS (ID, SURGERY_ID, SCHEDULED_DATE, CONTROL_TYPE, NOTES, STATUS)
VALUES (8, 3, '2026-10-24 16:00:00', 'CONTROL_RADIOGRAFICO',
        'Control radiográfico post-TPLO.', 'PENDIENTE');

-- Cirugía 4 (Selma, en curso desde 2026-09-11).
INSERT INTO FOLLOW_UPS (ID, SURGERY_ID, SCHEDULED_DATE, CONTROL_TYPE, NOTES, STATUS)
VALUES (9, 4, '2026-09-18 10:00:00', 'CURACION', 'Primera curación de la herida quirúrgica.', 'PENDIENTE');
INSERT INTO FOLLOW_UPS (ID, SURGERY_ID, SCHEDULED_DATE, CONTROL_TYPE, NOTES, STATUS)
VALUES (10, 4, '2026-10-11 16:00:00', 'CONTROL_RADIOGRAFICO',
        'Control radiográfico de la artrodesis a 30 días.', 'PENDIENTE');

-- ===================== SINCRONIZAR GENERADORES ===============================
-- Los INSERT usan IDs explícitos; se dejan los generadores por encima del
-- máximo sembrado para que GEN_ID no colisione (patrón ISALAB-TR 0005).
SET GENERATOR GEN_VETS_ID TO 10;
SET GENERATOR GEN_OWNERS_ID TO 10;
SET GENERATOR GEN_PATIENTS_ID TO 10;
SET GENERATOR GEN_INVENTORY_ITEMS_ID TO 50;
SET GENERATOR GEN_SURGERIES_ID TO 10;
SET GENERATOR GEN_INVENTORY_MOVEMENTS_ID TO 100;
SET GENERATOR GEN_SURGERY_MATERIALS_ID TO 50;
SET GENERATOR GEN_FOLLOW_UPS_ID TO 50;
-- Contadores de código (respaldo de los triggers BI_*): a la par del máximo
-- sembrado. La app calcula los códigos con "máximo existente + 1", igual que
-- la web, por lo que estos valores son solo colchón.
SET GENERATOR GEN_PATIENT_CODE TO 6;
SET GENERATOR GEN_INV_CODE TO 20;
SET GENERATOR GEN_SURG_CODE TO 4;
