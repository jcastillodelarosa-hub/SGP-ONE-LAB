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
IMPLEMENTADO EN PR280 sobre v465. 1371 Node PASS, 10 omitidas; DOM de
entrada PDT/guardado/roles PASS. Browser sintético preparado para manual y
Ensamble a 1440/768/390 con dos piezas independientes. CI visual inicial PASS (run43968682190); capturas revisadas y cabecera B ajustada.
Regresiones posteriores al ajuste y captura final pendientes.
SQL de novedad preparado y respaldo privado restaurado, todavía NO aplicado.
Candidata v467 conserva Picking v465 y sus roles; no publicada,
y coordinar con OPT. No presentar esta preparación como cambio productivo.
