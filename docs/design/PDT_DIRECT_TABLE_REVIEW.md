# PDT · boceto 1 seleccionado

Tabla directa aprobada con menos texto explicativo. Referencia visual:
SGP_PDT_boceto_1.png, inspeccionada; continuidad de diseño B aprobado.

## Cambios
- Registro de Ensamble/Empaque: referencias y piezas visibles en tabla; la
  identidad sigue siendo producción, reserva e id de pieza, nunca el texto.
- Registro manual: tabla existente, fila seleccionada resaltada, jerarquía entre
  elección de pieza y datos del faltante; se conservan fuentes, NC múltiples,
  observación general, origen y filtros.
- Varias piezas mantienen cantidades/NC/observaciones independientes. No se
  convierte NC en novedad ni se cambia validación, límites o idempotencia.
- Ayudas de registro manual y cálculo Tecno pasan a desplegables. Validaciones,
  errores y estados no se ocultan.
- No se implementa búsqueda de accesorios en PDT; aquella aclaración pertenece
  al flujo independiente de alertas G05.
- Número de novedad tiene preparación separada con su contrato y pruebas.

## Evidencia y estado
IMPLEMENTADO LOCAL sobre v464. 1368 Node PASS, 10 omitidas; DOM auditoría de
entrada PDT/guardado/roles PASS. Browser sintético preparado para manual y
Ensamble a 1440/768/390 con dos piezas independientes. CI/capturas pendientes.
No SQL ni publicación. Integrar después de Picking v465 conservando sus roles,
y coordinar con OPT. No presentar esta preparación como cambio productivo.
