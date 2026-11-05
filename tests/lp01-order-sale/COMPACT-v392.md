# Disponible compacto · LAB v392

Base publicada: main 90518a07f297c4079cdd97dc1c89ba83ffb94e90,
Hosting cf7a564682e0d50e. Solo se cambia la presentación de la definición
SALE por orden; el contrato y el SALE operativo por turno permanecen intactos.

Verificación local: `python3 tests/lp01-order-sale/compact-browser.py` en
Chromium 1440 y 390 px comprueba lectura automática acotada, valor / Por definir,
formulario cerrado en reposo, Guardar/Cancelar, reintento del mismo comando tras
respuesta incierta, conservación durante render silencioso y limpieza por
revocación y permanencia del diálogo modal tras repintar. Un smoke dirigido de
`renderTracking` real con dos órdenes sintéticas comprobó encabezado Disponible,
40 / Por definir, edición visible y enfocada tras refresco silencioso, Cancelar
y altura de fila sin cambio (PC 82→82 px, móvil 250→250 px).
`npm test` y `npm run verify:release` comprueban el paquete.
Son datos sintéticos: no acreditan aceptación de una sesión real.

Las imágenes Library referenciadas fueron resueltas y su OCR consultado, pero
no se pudieron materializar los píxeles por la política de red de este entorno.
La revisión visual de referencia queda pendiente; no se afirma equivalencia
exacta con el boceto. El control de celda sí se inspeccionó en capturas
generadas localmente para PC y móvil.
