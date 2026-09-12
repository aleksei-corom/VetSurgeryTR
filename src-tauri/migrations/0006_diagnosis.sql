-- 0006 · Diagnósticos formales de la cirugía.
-- Presuntivo: antes/durante (motivo quirúrgico). Definitivo: hallazgo
-- confirmado (postoperatorio). Alimentan la sección de diagnóstico de los
-- documentos imprimibles (consentimiento, fórmula, historia clínica).
--
-- NOTA: no usamos D_NOTES (VARCHAR(4000) UTF8 = hasta 16 KB por columna)
-- porque Firebird limita el tamaño máximo de fila (~64 KB) y SURGERIES ya
-- llega cerca del límite: con D_NOTES la segunda ALTER falla con
-- "new record size is too big". 1.000 caracteres son de sobra para un
-- diagnóstico y mantienen la fila dentro del límite.
ALTER TABLE SURGERIES ADD PRESUMPTIVE_DIAGNOSIS VARCHAR(1000) CHARACTER SET UTF8;
ALTER TABLE SURGERIES ADD DEFINITIVE_DIAGNOSIS VARCHAR(1000) CHARACTER SET UTF8;
