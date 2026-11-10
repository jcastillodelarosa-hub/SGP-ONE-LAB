# Programar varias partes · candidata LAB v437

Alcance: seleccionar varias partes semanales existentes de una misma reserva,
con fecha/turno común y prioridad consecutiva. Cada parte conserva su registro e
identidad. La parte parcialmente programada admite sus órdenes enteras pendientes;
las órdenes con cantidades parciales usan su editor existente. Históricos REVISAR,
cobertura ausente, identidades duplicadas y composiciones inválidas quedan bloqueados.

El lote no es una transacción atómica. Se refrescan composición/cobertura antes
del lote y antes de cada parte posterior, se conserva cada éxito confirmado y se
detiene al primer error. El resultado enumera confirmadas, fallida/incierta y no
intentadas antes del refresco. Espera máxima de 25 segundos por consulta/escritura;
ninguna escritura se reintenta. Una respuesta tardía no continúa el lote.

Se reutiliza sgp_mecanizado_programar: roles ADMINISTRADOR/COORDINADOR, reserva
principal, locks por producción, saldo y composición canónica. Catálogo productivo
consultado en solo lectura el 2026-11-10: definición de diez argumentos MD5
ac5d891aa93baf17a197a5297c6c767c, igual a reserva-compartida-canonica.sql.
No hay migraciones, datos, permisos, pins ni políticas de publicación modificados.
Se seleccionan partes vigentes como contenedores: la RPC existente no recibe una
firma CAS de composición, por lo que permanece la ventana entre lectura y escritura.
No se promete inmutabilidad del contenido si otro coordinador lo cambia en esa ventana.

Pruebas:
- node --test tests/programming-part-selection.test.mjs
- npm test
- npm run verify:release
- python3 tests/programming-parts/browser.py
- python3 tests/programming-scroll/browser.py

Node cubre selección, duplicados, cobertura, parciales, identidad, fechas/prioridades,
lecturas fallidas, cambios entre guardados, sesión, resultado parcial, errores,
promesas sin resolver y respuestas tardías. Navegador usa HTML/CSS/funciones reales
con RPC sintéticas: selección PC/móvil, cancelación, teclado, doble clic, bloqueo
durante guardado, errores parciales y reapertura sin selección. No llama backend.
El script de scroll de PR250 conserva seis viewports, escalas y control de z-index.

Estado inicial: IMPLEMENTADO EN RAMA, CI y revisión visual pendientes. Chromium
local falla al abrir socket (restricción de entorno); no se afirma QA visual local
ni operación en planta. PR apilado sobre fix/mecanizado-modal-scroll-v435.
No fusionar sobre esa rama. Esperar integración de PR249/250, coordinar v436 y
rebasar sobre main; verificar versión libre, CI exacta y publicación autorizada.
