# Recepción: rueda sobre las tablas

Implementado en rama `fix/recepcion-wheel-scroll`; pendiente integración/publicación.

La captura de Johan corresponde a Mecanizado → Recepción. El contenedor horizontal
usaba `overscroll-behavior:contain`, también en el eje vertical, impidiendo que la
rueda sobre las celdas desplazara la página. Se mantiene la contención horizontal
y se permite el encadenamiento vertical nativo. Sin handlers de rueda nuevos,
sin cambios de filtros, datos, permisos ni desplazamiento horizontal/táctil.

Verificación local: `node --test tests/reception-scroll.test.mjs tests/reception-table.test.mjs`
7/7 PASS; `git diff --check` PASS. Chromium no arranca en este sandbox (`socket()
Operation not permitted`), por lo que no se acredita prueba visual. Se incluye
`python tests/reception-ui/wheel.py` para comprobar rueda vertical sobre celdas y
horizontal con CSS real a 1440 y 390 px en un entorno con navegador disponible.

Siguiente: integrar con la siguiente entrega coordinada (v424/v425 en curso),
incrementar versión en ese lote y verificar en Recepción tras publicar. Esta rama
no reserva versión, no altera pins y no acredita publicación.
