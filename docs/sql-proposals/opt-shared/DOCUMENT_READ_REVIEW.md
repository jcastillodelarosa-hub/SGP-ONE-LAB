# Consulta documental completa · candidata LAB v451

IMPLEMENTADO EN RAMA, NO APLICADO EN SUPABASE, NO FUSIONADO, NO PUBLICADO.
Base: LAB v450, merge de PR #263. Solo código, contrato SQL y fixtures sintéticos.

## Contrato

`sgp_opt_referencias_documentales_v1` conserva actor, roles y scope BASE existentes.
Una asignación de la reserva/sistema dentro del scope autoriza leer ese documento
completo. Devuelve todas sus referencias y cantidades documentales; no devuelve
UUID de piezas, destinos, usuarios ni capacidades de registro. Un sistema ausente
o ambiguo es null: la UI no inventa una matriz.

`sgp_opt_esquema_documental_v2` verifica el mismo anclaje documental y la referencia,
y lee exclusivamente geometría persistida con documento, manifiesto, aprobación y
digest de evidencia coincidentes. No reconstruye geometría a partir de longitudes.
Proyecta los campos documentales necesarios; oculta IDs y etiquetas de proyecto
fuera del ámbito seleccionado. Documento o referencia ajenos se rechazan.

La UI consume ese contrato separado para navegar. Solo la intersección con el
estado de cortes v2 validado conserva casillas y controles. El servicio de cortes,
la RPC de registro, reservas, asignaciones y resúmenes no cambian. Los contadores
indican documento frente a ámbito de corte; fallo de lectura no acredita saldo cero.
Las respuestas documentales caducan al cambiar sesión, grupo o consulta.

## Presentación

Referencias a la izquierda en PC; cabecera y matriz arriba a la derecha, esquema
con todo el ancho de la columna inferior. En móvil se apilan. Matriz automática
por sistema/referencia exactos usando la biblioteca existente; ausencia, ambigüedad
y error explícitos. Resumen conserva sus dos tablas apiladas. Blanco/azul SGP.

## Aplicación futura (requiere autorización separada)

1. Revisar `document_read_REVIEW.sql` y las dependencias privadas en el destino.
2. Aplicar instalación aditiva; por defecto revoca EXECUTE de ambos lectores.
3. Revisar/aplicar `document_read_access_REVIEW.sql` solo si el catálogo mantiene
   sus grants. No concede roles SGP ni acceso directo a tablas.
4. Verificar con sesión autorizada documentos completos y registro fuera de scope
   rechazado; preparar artefacto v451 y obtener autorización para publicar.

Contención: revocar EXECUTE de los dos lectores nuevos; el frontend indica que la
consulta completa no está disponible y mantiene el ámbito de corte anterior.
Reversión completa: tras retirar el frontend, DROP de las dos firmas nuevas.
No alterar el writer v2 ni sus ACL. No se requieren cambios de datos/importaciones.

## Evidencia local

- Node: 1273 PASS, 10 omitidas; sin afirmación de verificación productiva.
- Nuevo lector: 4 pruebas Node, membresía exacta, sustituciones, caducidad y ruta v2.
- Writer original: 308 comprobaciones SQL sintéticas PASS; matriz DOM PASS.
- DOM documental: sistema ambiguo conserva cortes autorizados, fallo del ledger no
  acredita cero, referencias ajenas sin selección y fallback explícito PASS.
- PostgreSQL/WASM aislado: 32 comprobaciones con actor de prueba y funciones reales
  de scope, binding y writer; otras líneas/semanas/años, inactivo, excluido, sin
  asignación, usuario solo lectura y ACL cerradas. Cero eventos/cortes añadidos.
- Playwright Chromium: PC 1440×1000 y móvil 390×844; cuatro referencias sintéticas,
  dos fuera del registro; matriz automática, imagen decodificada, ausente/error,
  respuestas tardías, esquema completo bajo matriz, resumen apilado, confirmación,
  cancelación y registro exacto de las dos piezas autorizadas.
- Capturas locales: `tests/opt-digital/evidence/shared-scheme-{desktop,mobile}.png`.
  No se publican imágenes/documentos reales.

Límite: las dos referencias visuales de Library se resolvieron, pero la transferencia
fue bloqueada por la política de red del entorno (HTTP CONNECT 403). No se afirma
comparación de píxeles con el boceto. La prueba visual inspecciona la implementación
sintética según la disposición textual aprobada. SQL productivo y aceptación con
sesión real quedan pendientes; no se tocaron datos ni se desplegó.
