-- 0007 · Configuración de la clínica (identidad para los documentos).
-- Fila única (ID = 1): nombre, NIT/registro, dirección, teléfono, correo y
-- logo (data URL base64, p. ej. «data:image/png;base64,…»). Los documentos
-- imprimibles (consentimiento, fórmula, historias) usan estos datos en el
-- encabezado y el pie en lugar del nombre genérico de la aplicación.
--
-- El logo se guarda como data URL para no depender de rutas del disco que
-- pueden moverse entre equipos. Como los data URL de imágenes reales superan
-- el máximo de VARCHAR de Firebird (32 672 chars), la columna es BLOB SUB_TYPE
-- TEXT: rsfbclient lo mapea a String sin configuración extra.
CREATE TABLE CLINIC_SETTINGS (
  ID INTEGER NOT NULL PRIMARY KEY,
  CLINIC_NAME VARCHAR(120) CHARACTER SET UTF8,
  TAX_ID VARCHAR(40) CHARACTER SET UTF8,
  ADDRESS VARCHAR(200) CHARACTER SET UTF8,
  PHONE VARCHAR(40) CHARACTER SET UTF8,
  EMAIL VARCHAR(120) CHARACTER SET UTF8,
  LICENSE VARCHAR(80) CHARACTER SET UTF8,
  LOGO_DATA_URL BLOB SUB_TYPE TEXT CHARACTER SET UTF8,
  UPDATED_AT TIMESTAMP
);

-- Fila única desde el inicio (upsert del repositorio sobre ID = 1).
INSERT INTO CLINIC_SETTINGS (ID, UPDATED_AT) VALUES (1, CURRENT_TIMESTAMP);
