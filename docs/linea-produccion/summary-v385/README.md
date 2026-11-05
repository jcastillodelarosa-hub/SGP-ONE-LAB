# LAB v385 · presentación compacta PDT y resumen por causa

IMPLEMENTADO EN RAMA fix/seguimiento-summary-v385, dependiente de PR196/bc6970a.
No publicado, sin push/PR, SQL, nuevos roles/EXECUTE ni cambios de datos.
No mezcla SALE/abiertas del líder ni la cadena vieja B14–B27. Versión384→385 de
esta entrega candidata; renumerar las ramas viejas aisladas al integrarlas.

## Comportamiento

Pendientes de aluminio: referencia, cantidad explícita en piezas, NC, estado NC,
origen. Details nativo accesible por teclado/táctil abre fabricación, longitud,
acabado, reserva, contrato, estados PDT, causa, ventanas acreditadas y trazabilidad.
UUID no visible en fila contraída. No inferir estado NC desde validación/reposición
PDT: consultar sgp_pdt_manual_nc_consultar_v1 existente y verificar identificación
por numero o consecutivo. Sin autorización/dato compatible muestra No disponible;
si NC denegada, revalidar lectura LP antes de conservar el panel. No ampliar roles.

Seguimiento contraído: cantidades reportadas por categoría NC_AL/NC_V/TECNO/NOVEDAD
menos confirmación física. Solución en origen/NC finalizada no libera ventanas.
No sumar categorías para unión ni disponibilidad: usar consolidado servidor con
misma revisión y saldo acreditado, y available coherente. Ante lector antiguo sin
aluminumPending, cobertura no autorizada, pendiente de aluminio sin relación o
cambio Export, total/disponibilidad quedan pendientes. Piezas jamás se transforman
en ventanas; cantidades heredadas no se copian automáticamente a reportes nuevos.
Los números por categoría describen reportes pendientes, no una unión de ventanas
sin solapamiento. Reportes con ID duplicado/etapa ajena/cantidad imposible se rechazan.

El resumen se consulta en segundo plano con máximo3 solicitudes, una batería activa;
no bloquea la lista ni repinta formularios. Se reutiliza caché únicamente en el mismo
ámbito/sesión; al revocar se invalida secuencia global y se limpia vista/cache.
Una respuesta global anterior no puede restaurar datos tras ese rechazo.

## Límites explícitos

- ACCESORIOS no existe en CHECK ni escritor del contrato actual: se muestra No
  disponible. Añadirlo requiere extensión coordinada de almacenamiento, escritores,
  lectores y pruebas; no fingir que el formulario actual permite registrarlo.
- Consolidación y registro permanecen en el panel y contratos existentes, por rol.
- Esta entrega no resuelve SALE por orden ni abiertas del líder; corrige el texto
  heredado para reconocer la regla de Johan, sin convertir la restricción en regla.
- Si el lector13 de PR196 no está instalado, otros orígenes quedan no disponibles;
  el frontend no sustituye su instalación ni llama tablas privadas.
- La lista global hace lecturas por orden; límite3/cancelación probados con30órdenes,
  no constituye medición de latencia productiva con cientos de órdenes.

## Evidencia

498 Node PASS y verify:release385. Chromium1440/390, tests/lp01-summary-ui:
10Al +8Vidrio con unión validada12 y disponibles8; LEGACY19piezas sin ventanas;
NC solucionada conserva bloqueo físico; details teclado, borrador20s, revocación,
respuesta global retenida rechazada y máximo3 consultas aun después40s.
Capturas: tests/lp01-summary-ui/evidence; resultado JSON en misma carpeta padre.
Pruebas regresión tracking-ui PC/móvil pasan, filtros/foco/scroll/3ciclos20s intactos.
PostgreSQL aislado unassigned-app PC/móvil: registro real sin asignación, PDT sinNC,
idempotencia, turno cerrado rechazado y revocación. all-origins SQL+PC/móvil+
recuperación guardada PASS. Evidencia sintética, no verificación de Hosting.
Revisión independiente cerró tres hallazgos de revocación/cobertura/caché; sin
bloqueantes restantes en delta. Workflow preparado para ejecutar nueva UI en CI.

Siguiente: revisión conjunta de presentación/limitaciones, CI propia de SHA nuevo,
rebase solo tras integrar PR196 y política/pins de nueva entrega. No reutilizar
política196 como aprobación de385; HOLD se conserva hasta actualización coordinada.
