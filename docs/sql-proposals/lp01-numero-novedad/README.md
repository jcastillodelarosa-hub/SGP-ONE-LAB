# Número de novedad · preparado, NO aplicado

Base frontend main `9054025`, LAB v464. Integrar con la siguiente versión del padre.

## Contrato

- Se reutiliza el reporte compartido de afectación, no se crea otro evento de
  Mecanizado. `sgp_mecanizado_novedades.numero_novedad` pertenece a otro flujo y no
  identifica esta afectación.
- `sgp_lp_shared_order.reports.numero_novedad`: texto opcional de hasta 80 caracteres,
  solo causa `NOVEDAD`; conserva ceros iniciales, letras y separadores. No genera
  consecutivos ni vincula una NC. Histórico existente sigue sin número.
- Comando `noveltyReference` admitido en CREATE/CORRECT de NOVEDAD. Campo omitido en
  CORRECT preserva el número (compatibilidad cliente anterior); cadena vacía lo
  borra explícitamente. SOLVE/CONFIRM no modifican la referencia.
- Lector actual usa `to_jsonb(reports)` y el historial before/after: ambos incluyen
  el nuevo campo sin reemplazar la RPC de lectura. UI muestra número y permite
  corregirlo con observación, revisión CAS e historial completo.
- No roles, grants, RLS, permisos, saldos o turnos nuevos. RPC original conserva
  autorización por orden/etapa, locks y replay exacto. Número no equivale a
  existencia/verificación de una novedad externa.

## Aplicación posterior, solo bajo coordinación

1. Releer `00_preflight_READONLY.sql`. RPC command baseline MD5
   `90ed49a62696d59997db69d0f52e9f37`; ACL `{postgres=X/postgres,anon=X/postgres}`.
   Desviación aborta, no sustituir hash sin revisar delta.
2. Exportar y restaurar en base aislada las tablas privadas reports/events/versions
   y las definiciones de command/read, con conteos y hashes iguales. El catálogo
   adjunto es evidencia de lectura, NO respaldo de datos restaurable.
3. Aplicar `01_install_REVIEW.sql` una vez. Es una transacción; no modifica filas
   preexistentes salvo añadir columna NULL. No cambia ACL. Verificar contenido
   original de reportes excluyendo columna nueva, events/versions, ACL, RLS y
   rechazo de sesión inválida. Si resultado incierto, solo lectura; no reintentar.
4. Publicar frontend integrado y validar guardar/recargar con sesión real, sin
   usar una orden productiva como prueba inventada. La UI nueva no debe publicarse
   antes del escritor: backend anterior rechaza `noveltyReference` explícitamente.
5. Recuperación: atender envíos inciertos antes de revertir, verificar sus UUID;
   volver frontend anterior y restaurar escritor con `02_restore_writer_REVIEW.sql`
   (guarda de cuerpo exacto). Conservar columna y eventos: no eliminar números ni
   historial. Un cliente previo no puede editar números, pero los conserva.

## Pruebas realizadas

- PGlite: almacenamiento/corrección/borrado, cero inicial, históricos sin número,
  compatibilidad, replay/CAS, causa incorrecta, tipo/longitud/control, autorización
  sintética y ausencia de acceso directo de anon. No prueba multisesión/alojada.
- DOM JSDOM: entrada/lista/historial, precarga al corregir, omisión en solución,
  escape HTML, identidad de reintento incierto y separación con NC.
- Node contrato de transporte: número opcional y validación de tipo/causa.

Ejecución de pruebas aisladas con dependencias instaladas (no añade dependencia al app):

```sh
PGLITE_MODULE=/ruta/al/modulo/pglite/dist/index.js node tests/lp01-numero-novedad/pglite.mjs
JSDOM_MODULE=/ruta/al/modulo/jsdom/lib/api.js node tests/lp01-numero-novedad/dom.mjs
node --test tests/lp01-shared-order.test.mjs tests/nc-glass-shared-preparation.test.mjs
```

No se aplicó SQL, no se fusionó, no se publicó y no hubo prueba productiva.
