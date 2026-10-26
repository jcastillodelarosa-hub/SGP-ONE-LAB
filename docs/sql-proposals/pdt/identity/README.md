# Identidad PDT PANEL / FRAME — implementación en rama, SQL no aplicado

## Regla y diagnóstico definitivo

PANEL → PANELES_2; FRAME → FRAMES_2, obtenidos del maestro activo. Una producción
puede tener ambas líneas. El nombre, una clave enviada por el cliente o el primer
resultado de una búsqueda no son autoridad suficiente para resolver la línea.

Causa confirmada: `openProductionNovelty()` llamaba `sharedMetaForOrder` sin clave
ni clasificación. `sgp_aluminio_pendiente_crear` resolvía por nombre/reserva mediante
`ORDER BY ... LIMIT 1` y no comprobaba la línea de una clave proporcionada.
La propuesta anterior de permitir contexto cruzado FRAMES/PANEL está **obsoleta y
bloqueada**; no se instala ni se utiliza como excepción.

Lecturas reales, ninguna escritura:
- Run 40260774688: firmas/cuerpos/ACL, columnas y guard real instalado.
- Run 40261173332: respaldo69, 47 PANELES_2 POR_VALIDAR y 22 FRAMES_2 VALIDADO,
  todos LEGACY y maestro PANEL activo: 11 PENDIENTE, 6 PROCESADO, 5 PICKING.
  Sin detalles, movimientos, cierres o vínculos NC en esas tablas para los69.
- Run 40263861377: novedades pertenece a postgres; RLS desactivado e INSERT directo
  permitido a anon/authenticated. Es un permiso preexistente **no modificado**.
  La nueva RPC exige los mismos roles efectivos del creador anterior y no amplía
  acceso. No se presenta esta corrección como endurecimiento global del backend.

El guard real `sgp_pdt_guardar_contrato()` permite actualizaciones LEGACY sin
activar las reglas de inmutabilidad V2. Por eso la reparación key-only de los22
puede usar UPDATE normal: no se desactiva, reemplaza ni elude ningún trigger.
Su huella, estado habilitado y ausencia de otros triggers se verifican antes.

## Frontend y backend

- Formulario de Producción: pide una pieza real del catálogo de orígenes
  verificado; muestra tipo, línea y clave. No usa `sharedMetaForOrder` por nombre.
  Reserva/acabado/cambio de perfil invalidan la selección y exigen revalidarla.
- Resolver servidor: código SAP clasificado y activo, identidad real `id_pieza`,
  producción base registrada desde su clave fuente, destino del maestro,
  producción/sistema exactos y asociación reserva/acabado en esa línea.
  No inventa IDs ni infiere una línea por prefijos/nombres. Si hay más de una
  producción candidata, rechaza incluso si el cliente ofrece una clave.
- Compatibilidad del maestro: PANEL/FRAME deben coincidir con su destino; los
  tipos ya existentes COVER/REFUERZO/MUNTIN conservan su destino explícito del
  maestro, sin inventarlo. Tipo/destino ausentes o inconsistentes se rechazan.
- Algunas importaciones históricas alojan una pieza FRAME bajo una clave fuente
  PANEL. Se usa la identidad base registrada de esa fuente y el maestro para
  resolver el TARGET correcto FRAMES_2, sin cambiar la fila importada ni aceptar
  PANEL como línea del PDT FRAME. Ambos maestros de producción deben coincidir
  en identidad base, nombre y sistema; la reserva/acabado debe pertenecer al target.
- Firma antigua de creación conservada (12 parámetros, UUID, defaults y roles),
  con resolución única por maestro. No selecciona una pieza arbitraria si solo
  se recibió perfil; el encabezado mantiene id_pieza NULL en ese modo legacy.
- Nueva RPC `sgp_produccion_novedad_pdt_crear_v3`: pieza explícita, revalidación,
  novedad y PDT atómicos. Actor sale de la sesión, nunca del JSON del navegador.
  Un fallo posterior al INSERT del PDT también revierte ambos INSERT.
- Trigger adicional valida asociaciones nuevas y cambios de identidad desde
  cualquier ruta, sin cambiar el guard V2 existente ni bloquear ediciones
  históricas que no alteren la identidad. No hay degradación de contratos.
- Fuentes/distribución/Picking V2: maestro PANEL obligatorio y misma clave
  PANELES_2 en pendiente, pieza y snapshot. FRAME no anuncia operaciones PANEL V2.
  Se mantienen cantidades originales, validación de reservas, avances/reversos,
  NC y certificado de cierre. No se habilitan cierres sin evidencia.
- Nueva UI sin contrato servidor instalado: bloquea crear PDT y explica la causa;
  no reintenta por el creador antiguo. Novedades sin perfil conservan su flujo.

## Migración de los22 y transacción integral

Archivos de revisión, **fuera de supabase/migrations**:
1. `00_repair_22_REVIEW.sql`: solo los22 del respaldo69 aún en FRAMES_2.
2. `01_creation_and_source_identity_REVIEW.sql`: creador seguro, catálogo, RPC
   atómica y trigger de identidad, con helpers privados propiedad de postgres.
3. `02_panel_v2_identity_REVIEW.sql`: verificaciones estrictas PANEL V2.

Preparar una sola transacción, sin conectarse a ninguna base:

```bash
python scripts/build-pdt-identity-install.py > /tmp/PDT_IDENTITY_INSTALL_REVIEW.sql
```

**No ejecutar en producción sin autorización separada.** Verificar proyecto
`ocvxbwzqxbrfndkvjmfx`, huellas y estado actuales. La transacción mantiene lock
exclusivo de pendientes mientras verifica y cambia únicamente key_produccion en22.
No actualiza, elimina ni recrea los47. Verifica que:
- backup contiene69 IDs únicos y siguen presentes los69;
- exactamente22 son LEGACY/VALIDADO y conservan todos los campos de su backup;
- distribución11/6/5 y estado PENDIENTE no han cambiado;
- maestro PANEL activo y un único destino PANELES_2 por ID base, nombre, sistema,
  reserva/acabado; ningún detalle/movimiento/cierre/vínculoNC nuevo;
- los otros47 ya están en Paneles y permanecen idénticos antes/después;
- JSON completo de cada uno de los22 cambia solo en key_produccion;
- historial, guard habilitado y su definición permanecen iguales.

Un ledger administrativo privado conserva antes/después y digest del historial;
RLS habilitado y ningún permiso para PUBLIC/anon/authenticated/service_role.
No contiene ni necesita credenciales. El respaldo69 original permanece intacto.
Cualquier inconsistencia, bloqueo ocupado o definición desconocida aborta todo.

## Reversión segura

Antes del COMMIT: ROLLBACK de la transacción integral revierte tanto las22 claves
como todas las funciones, permisos y trigger nuevo; fallo inyectado comprobado.
Después de COMMIT: preferir conservar las asociaciones correctas y corregir forward.
No restaurar un dump anterior sobre nuevas escrituras ni quitar validaciones V2.

`00_repair_22_ROLLBACK_REVIEW.sql` permite revertir únicamente el lote registrado
si cada fila/historial sigue idéntico al estado posterior, sin nuevas dependencias,
y siguen los guards originales. Nunca toca los47 ni borra el ledger. Si ya está
instalado el nuevo trigger estricto, **aborta**; no lo desactiva para restaurar una
asociación incorrecta. Toda contingencia posterior requiere revisión/autorización.
La reversión no constituye una vía para volver a permitir PANEL en FRAMES_2.

## Pruebas y evidencias

`tests/pdt-identity/installed-contracts.json`: esquema real de pendientes/maestro/
novedades, cuerpos y permisos consultados; **sin filas operativas ni credenciales**.
`read-only-evidence.json`: conteos y permisos reales acotados a esta tarea.
`results.json`: PostgreSQL17.11, 17 escenarios SQL aprobados en contenedor sin
red/puertos, con columnas y cuerpos reales disponibles y datos sintéticos.
`evidence/browser-results.json`: PC1440x1100/móvil390x844, cero escrituras.

| Caso obligatorio | Evidencia aislada |
|---|---|
| Producción simultánea en ambas líneas | Mismo nombre e ID base; selección por maestro |
| Creación PANEL | PANELES_2, clave hostil FRAMES rechazada |
| Creación FRAME | FRAMES_2, sin entrar en distribución PANEL |
| Reservas compartidas | Asociada y principal verificadas; actor no falsificable |
| Sin clasificación verificable | Sin escritura; UI deshabilitada; sin fallback |
| Validación/distribución V2 | 5+4, avance, entrega/acreditación/cierre con clave única |
| PROCESADO | 6 registros reparados sin cambiar ningún otro campo |
| PICKING | 5 registros reparados sin cambiar ningún otro campo |
| Compatibilidad existente | Firma antigua, roles reales, 47 intactos, NC/historial conservados |

Negativos: clave manipulada, otra pieza, maestro inconsistente, principal errónea,
producción ambigua, falta de permisos y fallo después del primer INSERT. Reparación
rechaza cambios posteriores, nuevas dependencias y destino ambiguo. El bundle
completo confirma o revierte todos sus componentes; no deja instalación parcial.

- `npm test`: 235 PASS.
- `python tests/pdt-identity/run-isolated.py`: 17 escenarios SQL PASS.
- `python tests/pdt-identity/browser.py`: PC/móvil PASS, cero escrituras.
- Build vendor/verificación release, sintaxis y diff: PASS.

## Estados y riesgos pendientes

- **PROPUESTO:** ejecución del bundle, integración y publicación futuras.
- **IMPLEMENTADO:** frontend, backend SQL versionado y reparación/reversión22.
- **APLICADO:** ninguno de estos SQL en producción. Los47 corregidos previamente
  por el propietario/ChatGPT externo se comprobaron en lectura y no se repitieron.
- **PUBLICADO:** ningún cambio de este encargo; main sigue LAB v354/e1a5ca5.
- **VERIFICADO:** inventario productivo en lectura y pruebas aisladas descritas.
  No se declara verificación funcional ni de escritura en producción.

La fixture reproduce columnas relevantes, autenticación/guards reales y contratos,
no toda la instalación Supabase ni todos los triggers de otras tablas/servicios.
Antes de una aplicación autorizada, ensayar sobre una réplica actual restaurada,
confirmar backup/restauración vigentes y coordinar escrituras. El respaldo69 es
solo de ese conjunto, no un respaldo completo de Supabase. Si el conjunto cambia,
el script debe detenerse, no relajar comprobaciones ni recalcular un lote más amplio.
La creación productiva mantiene su comportamiento anterior hasta aplicar/revisar
backend y publicar el frontend. La revisión del PR no autoriza ninguna de esas acciones.

### Reproducción local

Usar el contenedor QA existente `sgp-pdt-qa-91`, sin red ni puertos. Si no existe,
preparar PostgreSQL17 aislado localmente; no emplear URLs/credenciales productivas.
El runner comprueba el aislamiento y crea bases nuevas con prefijo QA; no borra
las anteriores ni modifica otro entorno.

```bash
node --test tests/pdt-piece-identity.test.mjs tests/pdt-flow-guidance.test.mjs
python tests/pdt-identity/run-isolated.py
python tests/pdt-identity/browser.py
```

Los tokens son fixtures con sesiones SHA256; los cuerpos de autenticación y el
guard son reales. No se simula que se inició sesión como un usuario de planta.
Los demás tests de fases PDT anteriores se conservan; no se repitió su auditoría.
