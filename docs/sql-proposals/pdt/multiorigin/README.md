# PDT v2 multiorigen — revisión antes de instalar

Estado: IMPLEMENTADO EN RAMA / VERIFICADO LOCALMENTE con datos sintéticos.
NO APLICADO EN SUPABASE por este trabajo; NO PUBLICADO.
Base: main `1a0deae41e3446efde3901932cda90ed73ab4d0d` (LAB v361).
Candidato: LAB v362. Proyecto exclusivo: LAB `ocvxbwzqxbrfndkvjmfx`.

## Causa y evidencia

La definición suministrada en `scripts/pdt-compatibility/evidence/PDT_FUNCIONES_REALES.json`
resuelve la clave de entrega por nombre/principal, ordena semana y usa `LIMIT 1`.
Con una misma producción presente en PANEL y FRAME puede seleccionar FRAME.
Su INSERT de pendientes omite contrato V2; el guard de identidad v3 sí comprueba
la línea canónica. El error no demuestra una selección equivocada del patinador.

Prueba reproducida en PG17.11 aislado: se hace ganar la semana FRAME y la función
real de ocho parámetros falla con `PDT_CLAVE_NO_CORRESPONDE_A_MAESTRO`; no deja
entrega ni pendientes. La nueva ruta registra la misma pieza en PANELES_2, sin
NC, como V2/POR_VALIDAR, sin quitar el guard.

No se consultó producción en esta sesión: los conteos 82/81/1 del encargo son
antecedentes facilitados, NO un inventario actualizado propio. No hay MCP Supabase
ni sesión SGP de planta disponible. Las huellas instaladas actuales y la función
subyacente de listado Picking quedan por contrastar antes de autorizar instalación.

## Contratos y solución

- `sgp_pdt_registro_fuentes_v4(token, origen, contexto)` →
  `{ok:true, contract_version:4, fuentes:[...]}`. Deriva fuentes del helper canónico
  v3, maestro activo PANEL, producción exacta, reserva/acabado y clave de línea.
  Picking además intersecta IDs con `sgp_picking_piezas_panel` y programación
  activa/sistema/acabado/principal. No resuelve identidad solo por texto.
- `sgp_pdt_registrar_v4(token, origen, contexto, piezas, idempotency_key)` →
  `{ok:true, ids_pendientes:[...], id_entrega?}`. Un UUID por evento, conservado
  al reintentar. Cambio de contenido/actor con el mismo UUID se rechaza.
  La misma pieza no se repite dentro del lote; eventos distintos no se fusionan.
- Picking: `contexto` incluye `id_programacion`, `produccion`, `completa`,
  `fecha_entrega`, `turno` y observación. Completa delega a la implementación
  instalada de ocho argumentos; incompleta crea entrega, faltantes y PDTs en
  la MISMA transacción. No se invoca su INSERT defectuoso ni se retorna a LEGACY.
  El trigger original contra entregas completas duplicadas continúa activo.
- Ensamble/Empaque: contexto con `key_produccion`, `produccion`, sistema opcional
  y reserva opcional. Si hay varias relaciones, se selecciona la pieza/reserva
  concreta entre las fuentes verificadas. No crea entregas de mecanizado.
- Piezas: ID real + clave canónica + perfil + fabricación + longitud + acabado
  + reserva/principal + cantidad entera positiva. El servidor contrasta todo;
  una clave enviada no es prueba. No acepta más que la referencia actual.
  Se conserva UUID PDT, fuente física, lote/fila y snapshot; no migra históricos.
- NC vacía: permitida solo en Picking, visible como **NC PENDIENTE DE ASIGNAR**.
  Ensamble/Empaque rechazan espacios/vacío. Referencia no encontrada se conserva
  en el campo histórico; coincidencia única del catálogo crea enlace con snapshot;
  ambigüedad rechaza el evento. No se inventa un estado de validación NC.
- Vinculación posterior: RPC existente `sgp_aluminio_pendiente_nc_vincular_v1`,
  sin cambiar roles ni permitir NC en PDT cerrado.
- Metadatos aditivos para seguimiento: `sgp_pdt_registro_metadatos_v4` aporta
  origen/fecha/usuario/NC. Se combinan con el listado v2 existente; no sustituye
  cantidades, movimientos, estados NC o cierres. Filtros origen/NC/fechas se
  combinan con búsqueda por producción/reserva/perfil/estado/semana.

El scope V2 sigue siendo PANEL; no se extiende a FRAME por similitud de perfiles.
Las dos firmas antiguas y el esquema compat no se reemplazan. Clientes antiguos
pueden seguir llegando al fallo de identidad anterior en entregas incompletas;
la corrección requiere publicar este frontend después de instalar y validar la
nueva ruta. No se oculta ese fallo desactivando seguridad.

## Permisos efectivos

Se usa `sgp_pdt_validar_rol_real`, NO la equivalencia RECEPCION → LIDER.

| Operación | Roles SGP |
|---|---|
| Fuentes/registro PICKING | ADMINISTRADOR, COORDINADOR, LIDER MECANIZADO, LIDER, LIDER LINEA, PATINADOR, PICKING, SUPERVISOR DE PICKING |
| Fuentes/registro ENSAMBLE o EMPAQUE | ADMINISTRADOR, COORDINADOR, LIDER, LIDER LINEA |
| Metadatos | Los roles anteriores, RECEPCION y CONSULTA, solo lectura |
| Vincular NC después | Contrato existente: ADMINISTRADOR, COORDINADOR, PATINADOR |
| Validar/mecanizar/entregar/cerrar | Contratos existentes, sin nuevas autorizaciones |

Transporte anon/authenticated: EXECUTE únicamente sobre RPC públicas; sin USAGE
ni privilegios en el esquema privado. Helpers privados revocados, search_path
vacío, SECURITY DEFINER. No service_role frontend, nuevas políticas amplias,
RLS deshabilitado, flags de bypass ni triggers apagados.

## Orden y alcance de SQL REVIEW

Fuera de `supabase/migrations`, no forma parte de la instalación automática.

1. `01_multiorigin_REVIEW.sql`: preflight de PG17/dependencias/guards/cuerpos
   conocidos, esquema privado y RPC aditivas. Aborta ante definición desconocida.
2. `02_canonical_lifecycle_REVIEW.sql`: preflight exacto y respaldo de cuerpos en
   ledger privado; fuentes/distribución/acreditación utilizan la misma identidad
   canónica. La fuente física no se reescribe. Mantiene validación, cantidad
   original, avances/reversos, permisos, snapshots y evidencia cuantitativa.
   En reserva compartida, admite principal solo si la vista verifica su relación
   exacta con clave/reserva del PDT. VALIDADA sigue siendo el único estado
   acreditable, nunca AUDITADA_DIFERENCIA.

Para una futura aplicación autorizada: revisar ambos archivos y combinar sus
cuerpos en UNA transacción (sin BEGIN/COMMIT interiores), con ventana/rollback
controlados. Primero validar en entorno aislado compatible con los metadatos
instalados vigentes; las huellas incluidas NO prueban actualidad productiva.
Instalar backend antes del frontend; el nuevo frontend falla cerrado si falta
la RPC, incluso para entrega completa. No publicar parcialmente.

No aplicar las antiguas reparaciones de 47/22 PDT ni reconstruir entregas históricas.

## Reversión y recuperación

`ROLLBACK_REVIEW.sql` exige que no existan eventos nuevos; restaura solo código del ciclo desde el ledger si su huella
posterior sigue igual; revoca el registro nuevo conservando eventos, PDTs,
entregas, NC e historial. No elimina esquemas ni tablas, no usa CASCADE y no
restaura un backup sobre escrituras nuevas. Pausar solo uso del editor nuevo
antes de revertir; volver al frontend aprobado no corrige el defecto del cliente
antiguo. Si ya hay eventos V2 activos con identidad remapeada o reserva compartida,
NO revertir sus lectores/certificados sin conciliarlos: la definición anterior
puede bloquear su procesamiento/cierre. El rollback aborta si hay eventos.
`CONTENER_REGISTRO_REVIEW.sql` revoca solo el registro nuevo y conserva lectores,
procesamiento, cierre y datos; requiere autorización administrativa. Preferir corrección hacia delante.
La prueba aislada demuestra preservación de filas, no recuperación de producción.

## Integración compartida de Ensamble y Empaque

No se reconstruyeron los módulos paralelos. Main ya integra PR32/47; las ramas
`feat/linea-produccion-ensamble-empaque-tabs` y
`feat/linea-produccion-reservas-multiples-v328` existen. No se modificaron.
Se añadieron accesos mínimos en las celdas de producción de las hojas existentes,
solo para claves PANEL y roles autorizados. Integración estable reutilizable:

```js
await window.SGPPdtRegistration.open({
  origin: 'ENSAMBLE', // o EMPAQUE
  context: {key_produccion: row.key_produccion, produccion: row.produccion,
            sistema: row.sistema},
  onSaved: async result => { /* actualizar solo datos afectados del módulo */ }
});
```

El host resuelve cliente/sesión actuales, no exige credenciales al módulo.
Componente `src/modules/pdt-registration-form.js`; repositorio de RPC y dominio
separados. Picking usa `mountPdtRegistration` en su diálogo de entrega y un único
commit servidor; NO llamar primero a una entrega y luego al formulario separado.

## Pruebas y límites

- Node: **326/326**, incluidas 12 pruebas nuevas de registro y regresiones existentes.
- PG17.11, red `none`, sin puertos: **25 comprobaciones**, incluido error anterior,
  rollback de instalación, NC/roles, atomicidad, reservas compartidas, claves
  remapeadas, ciclo hasta cierre, transporte anon, concurrencia e idempotencia y
  reversión sin pérdida de eventos. `tests/pdt-multiorigin/evidence/sql.json`.
- La fuente subyacente Picking es fixture: NO equivale a consulta productiva.
  Se reutilizan definiciones reales suministradas para auth, entrega y trigger.
- Browser: handlers reales de entrega + componente real, RPC sintéticas;
  PC1440, tableta768, móvil390, varios PDT, NC, reintento/doble clic, entrega
  completa, fuentes vacías/ausentes, scroll y sin errores JS ni desborde horizontal.
  Capturas con aviso sintético en `tests/pdt-multiorigin/evidence`.
- `npm run verify:release`, sintaxis y diff aprobados.
- Main base aislado: 314 pruebas/301 pasan/13 fallan. Se corrigió solo el
  acumulador `partialReceiptBase` sin inicializar y 11 pruebas de release ligadas
  a v360 (ahora contrastan `releaseLabel`). No se cambian cantidades ni reglas.

Reproducir: `node --test tests/pdt-registration.test.mjs`, `npm test`,
`npm run verify:release`, `python tests/pdt-multiorigin/browser.py`,
`python tests/pdt-multiorigin/run-isolated.py`.
La prueba SQL requiere contenedor local PostgreSQL17 llamado `sgp-pdt-qa-91`,
network none/sin puertos y utilidades psql/createdb; construye una base nueva de
fixtures, nunca clona producción. No es un respaldo ni un instalador productivo.

Pendiente antes de producción: contraste autenticado de cuerpos instalados y
listado PANEL, aprobación SQL, aplicación controlada, publicación autorizada y
recorrido real PATINADOR. Ninguno se declara ejecutado por tener CI verde.

## Revisión crítica PR116 — convivencia LEGACY/V2 (2026-10-27)

Esta sección prevalece sobre el orden inicial de instalación descrito arriba.

**01 es aditivo e independiente de 02.** Permite registrar nuevos V2; no necesita
convertir ningún LEGACY ni reemplaza sus RPC. Instalar 01 no equivale a validar
el ciclo completo de todos los nuevos pendientes: los casos con claves de carga
remapeadas/compartidas pueden necesitar 02 para su tratamiento posterior.
No publicar el ciclo completo hasta resolver la compatibilidad real pendiente.

**02 es opcional, separado y BLOQUEADO para instalación pendiente del contraste
productivo del validador.** La versión original del PR reemplazaba una función
compartida capaz de convertir individualmente un LEGACY. Ese riesgo se elimina
mediante despacho por propiedad del registro:

- Solo `contrato_pdt='V2'` MÁS una fila en el ledger privado de registro v4
  seleccionan las implementaciones canónicas nuevas.
- Todos los LEGACY y los V2 previos sin ese marcador ejecutan una copia exacta
  de su cuerpo instalado original, obtenida transaccionalmente antes del cambio.
- Los cinco entrypoints mantienen firmas/ACL; sus copias y nuevas implementaciones
  son privadas, sin EXECUTE al navegador. Preflight exige cuerpos/seguridad
  esperados. No adaptar automáticamente una definición distinta.
- No se modifican los guards globales, validador tradicional, resolver ni cambio
  de estado LEGACY. No hay UPDATE masivo ni conversión durante instalación/lectura.
- La preparación individual existente sigue siendo una acción explícita de un
  rol autorizado; no es requisito de registro, listado, cierre ni publicación.

Regresión: cuatro LEGACY sintéticos (abierto, validado, con historial de cambio de
etapa y cerrado), ocho operaciones cada uno, antes/después: 32 resultados iguales,
con éxitos y rechazos esperados contrastados; filas e historial idénticos. Resolver
y estado usan cuerpos reales suministrados; el validador tradicional procede del
SQL versionado, **no se presenta como su definición productiva vigente**.
Evidencia: `tests/pdt-multiorigin/evidence/legacy.json`. Nuevas discrepancias de
cuerpo o SECURITY INVOKER se rechazan antes de instalar 02.

Listados muestran contrato y filtro LEGACY/V2; informe CSV incluye Contrato,
ID, origen, estado/validación y cantidad original. No se infiere contrato si falta
el dato. La exportación usa solo filas ya consultadas y neutraliza fórmulas CSV.

### Definición real que falta (no confundir con los siete contratos suministrados)

Se necesitan los resultados YA disponibles, si el propietario los conserva, en
`PDT_VALIDAR_DETALLES_REAL.json`: definición completa actual de
`public.sgp_aluminio_pendiente_validar_detalles_v1(text,uuid,jsonb,text,text)`,
fecha/proyecto, firma, owner, SECURITY DEFINER, search_path, ACL y huellas.
No hacen falta datos operativos, sesiones, tokens, claves ni volver a exportar las
siete funciones anteriores. Esa función no aparece en esos siete contratos ni en
el complemento de sesión/programación ni en el inventario de creación de PR94.
No se dispone de acceso Supabase autenticado para recuperarla en esta sesión.

La huella `f07b67e8cf194181310928b672946f8f` de 02 es MD5 de **prosrc** del SQL
versionado reproducido en QA; NO es MD5 de pg_get_functiondef ni evidencia de
igualdad con producción. No cambiarla ni eludir el preflight para forzar instalación.
Solo al recibir la definición real podrá cerrarse la discrepancia del punto 9.
