# Selector de reservas: acabado y origen (preparado, no publicado)

Base de revisión: LAB v454, commit ab102489. No requiere SQL, nueva RPC,
cambio de datos ni modificación de permisos. La versión de publicación debe
asignarse al integrar este paquete, separadamente de la optimización del índice.

Cada opción presenta reserva, sistema, acabado, Retail/Proyecto y el estado
Compartida/Candidato local. La selección se repite en texto ajustable debajo del
control nativo para que el móvil pueda leerla completa.

## Fuentes y límites

- Compartidas: `references[].fuentes[].origen` del catálogo validado v2.
  Se muestran todos los orígenes distintos; DESCONOCIDO u otro valor no se
  transforma en Proyecto. BASE no define el origen.
- Acabado compartido: snapshot vigente del lector de programación existente,
  `relations[].raw.acabado`, solo de BASE_COMPARTIDAS y ASOCIADAS_RPC, con
  coincidencia exacta de reserva, sistema y ámbito. Se agrupan todas las
  producciones coincidentes, sin elegir arbitrariamente una de ellas.
- Definiciones verificadas mediante lectura de metadatos: el RPC de programación
  devuelve `reservas_compartidas` usando `sgp_reservas_por_produccion_json`, que
  expone `sgp_produccion_reservas_v.acabado_reserva`. El RPC de asociaciones usa
  el mismo contrato. No se copian filas reales ni identificadores al repositorio.
- El acabado de esa vista es el dato operativo por reserva. No se interpreta
  como acabado certificado de todas las piezas del PDF ni se reconstruyen
  acabados que la vista haya devuelto nulos por ambigüedad.
- Locales: todos los `associations[].entry.finish` del índice original y su
  origen explícito. Nunca se usan para completar una reserva del servidor.
- Nulo, falta de snapshot o relación exacta: «Acabado no disponible». Si hay
  datos conocidos y huecos, ambos se muestran. Varios acabados se enumeran.
- Identidades de opciones, autorización de cortes, documentos y selección no
  cambian. El refresco explícito mantiene el comportamiento previo de limpiar
  selección; los re-renders del índice conservan la identidad seleccionada.

## Evidencia sintética

- `node --test tests/opt-*.test.mjs`: 275/275 PASS.
- Workflow DOM y catálogo DOM: PASS (incluye sesión obsoleta, scope cambiado,
  selección, autorización y rechazo de estado incompatible).
- Browser `import-upload-browser.cjs`: PASS en 1440×1000 y 390×844, con fuentes
  diferentes para índice local y programación, selección/reselección, re-render,
  refresco de catálogo y segunda sesión. Tráfico remoto completamente simulado;
  cero escrituras productivas.
- Browser `workflow-browser.cjs`: PASS PC/móvil, origen individual desconocido,
  PDF original y registro bloqueado para candidatos locales.
- Capturas sintéticas inspeccionadas: `tests/opt-digital/evidence/`
  `import-upload-second-cutter-desktop.png` y
  `import-upload-second-cutter-mobile.png`. Son artefactos locales ignorados,
  regenerables por el test. No son capturas de aceptación productiva.

Pendiente: autorización de publicación e integración con número de versión;
validación visual final del lector con sesión autorizada tras publicar.

## Preparación independiente v455
Main comprobado por GitHub: ab102489 (v454), sin cambios posteriores. Candidata v455 preparada con sello/cache-bust coherentes; módulo opt-reservation-label incluido explícitamente en lista de publicación. Verificación de release y42 archivos OPT contra artefacto construido PASS. Browser import y workflow PC/móvil PASS sobre el artefacto completo, sin red productiva. La prueba espera ahora la finalización del lector de índice antes de inspeccionar opciones. Hosting actual no se pudo reconsultar: HTTP403 y herramienta web inaccesible; no se afirma nueva aceptación productiva. Requiere autorización independiente para push/PR/merge/publicación. No incluye CPU, Retail v3 ni SQL.
