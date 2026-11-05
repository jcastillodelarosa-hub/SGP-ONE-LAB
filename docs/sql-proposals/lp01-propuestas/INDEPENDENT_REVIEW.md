# Revisión independiente B12/B13

Revisor: agente review_b12_b13, dos pasadas de solo lectura, 05/11/2026. Sin aprobación formal del PR ni mutaciones productivas.

1. Picking linked global podía pertenecer a Empaque: se coteja con fuentes V4 de reportes propios de Ensamble.
2. Antigüedad usaba arrastre: ahora consume progress.ENSAMBLE.opening acreditado; desconocido no se infiere.
3. Historial mezclaba partes: cada evento identifica asignación.
4. Fallo de relectura tras guardar podía negar éxito: conserva confirmación, con prueba de cliente por fallo inyectado.

Segunda pasada: cuatro hallazgos cerrados,8 pruebas focalizadas PASS; reproducción independiente confirmó cero RPC con enabled omitido y conservación de éxito tras relectura fallida. Singleflight/AbortController/background revisados sin nuevo bloqueante concreto. Observación menor resuelta: detalle dice Origen del arrastre para distinguirlo de apertura.

SQL REVIEW mantiene flag false, RLS y revocación de EXECUTE; no se instala en este PR.
