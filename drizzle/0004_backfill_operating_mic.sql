-- SPEC-015 / ADR-012 — Backfill de la identidad de mercado a OPERATING MIC.
--
-- ADR-007 fijó la identidad del símbolo como (ticker, mic_code) pero no dijo CUÁL MIC.
-- Los símbolos ya persistidos llevan el MIC de SEGMENTO que devolvía Twelve Data
-- (XMAD, XNGS…). ADR-012 canoniza en el OPERATING MIC (BMEX, XNAS…), así que hay que
-- migrar los existentes o dejarían de casar con el proveedor de cotizaciones.
--
-- Lo que NO se pueda mapear se deja TAL CUAL a propósito (CA-10): un símbolo sin
-- operating MIC canónico simplemente no se cotiza — no se inventa su mercado, porque
-- cotizar el mercado equivocado falsearía el P/L (RN-09/RN-06). Quedan visibles con su
-- MIC original (o NULL, los legacy pre-ADR-007); el diagnóstico al usuario es SPEC-016.
--
-- Idempotente: re-ejecutar no cambia nada (los operating MIC ya canónicos no se tocan).

-- España — BME (Bolsas y Mercados Españoles)
UPDATE symbols SET mic_code = 'BMEX' WHERE mic_code IN ('XMAD', 'XMCE', 'XBAR', 'XBIL', 'XVAL');--> statement-breakpoint
-- EEUU — Nasdaq (Global Select / Global Market / Capital Market)
UPDATE symbols SET mic_code = 'XNAS' WHERE mic_code IN ('XNGS', 'XNMS', 'XNCM');--> statement-breakpoint
-- Alemania — Xetra
UPDATE symbols SET mic_code = 'XETR' WHERE mic_code = 'XETA';
