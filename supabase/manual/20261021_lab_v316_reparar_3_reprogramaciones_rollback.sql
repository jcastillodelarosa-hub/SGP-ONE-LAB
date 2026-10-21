-- LAB v316 · REVERSIÓN MANUAL DE REPARACIÓN HISTÓRICA (NO DE LA RPC).
-- NO EJECUTAR SIN AUTORIZACIÓN. Revisar que las 3 filas no hayan sido editadas o consumidas.
BEGIN;
DELETE FROM public.sgp_mecanizado_programacion_detalle
 WHERE id_programacion IN ('169ce156-5726-4965-8c03-98c2ac4204fb'::uuid,'63a5685f-46e6-4052-9ab7-5796a8791b04'::uuid,'c432eff2-873f-4979-ac3f-76d1ee094974'::uuid)
   AND origen='REPARACION_REPROGRAMACION';
COMMIT;
