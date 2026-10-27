# Etapa 2C — puentes de fuentes y límites verificables

## Estado de la entrega

**PARCIAL para integración con fuentes reales. IMPLEMENTADO / VERIFICADO AISLADO**
el protocolo servidor y sus bloqueos. **NO APLICADO EN SUPABASE / NO PUBLICADO.**
Rama feat/linea-stage2c-source-bridges, base exacta122
8888981d74bbd485cf07e1dea2ee11b3c6a20463; stack117→121→122→Draft2C.
Main observado b228ab2977ee29fa8c3db1db2ec2c2b594e3dc2d. El checkpoint de main
sigue refiriéndose a116: no acredita integración de117/121/122. No rebase/merge.
Versión runtime no cambia (LABv362 del stack); no se toca frontend.

## 2C.1 — contraste y procedencia

| Fuente | Evidencia disponible | Conclusión / límite |
|---|---|---|
| sgp_previsualizar_export_diario | app.js:1233 llama p_token,p_linea,p_datos | Firma de llamada, no definición instalada ni autorización real completa |
| sgp_aplicar_export_diario | app.js:1250 llama token/línea/nombre/datos; respuesta id_carga_diaria usada en sgp_resumen_eventos_actualizacion | UI aplica por línea/semanas incluidas, sin enlace versionado de eventos locales al corte |
| sgp_export_diario_historial | Metadatos reportados por propietario: carga, identidad, saldos, fecha | No se dispone del DDL/cuerpo que prueba orden de cortes o inclusión de eventos |
| sgp_lotes_carga | DDL versionado contiene lote/carga/tipo/estado/fechas | Fechas/estado de carga no prueban inclusión de unidades locales |
| Ejecución nueva2B | sgp_linea_b2.eventos: UUID, key, etapa, fecha, turno, delta, usuario y auditoría; orden acumulada/revisión | Identidad local explícita inmutable, no enlace automático con escritores legacy |
| Ejecución instalada | Referencias sgp_linea_plan_registrar/consultar y contratos1 | Cuerpos instalados e identificadores exportados no disponibles; no se reconstruyen por coincidencia |
| PDT versionado | docs/sql-proposals/pdt/multiorigin/01_multiorigin_REVIEW.sql y 02; fuentes id_pieza/key/reserva y origen de carga/fila; entregas y asignaciones cuantifican piezas | No identifican ventanas afectadas; no se implementa una conversión pieza→unidad |
| Autenticación | Cuerpo capturado sgp_sesion_actual reutilizado por2B | Probado con sesiones hash sintéticas, no consulta de usuarios productivos |
| Ámbitos reales | Cinco grants amplios de planificación y SECURITY DEFINER reportados | No constituyen permiso funcional. No se dispone de un catálogo servidor contrastado etapa/producción |
| Escritores existentes | Scripts versionados no demuestran que todos tomen el lock2B | Compatibilidad transaccional productiva NO demostrada; impide certificar lectores reales |

Se leyeron Skills database-rpc, security-auth, business-rules, testing-qa y continuity;
lectura explícita, no activación nativa acreditada. GitHub REST disponible. No hay
herramienta Supabase autenticada en esta sesión y no se usaron secretos para simularla.
La consulta **CONTRAST_SOURCE_READONLY.sql** está preparada para los cuerpos/columnas/
triggers que faltan. Solo catálogos, sin filas operativas, tokens ni sesiones; no se
repiten como descubrimiento las seis funciones DEFINER/grants ya informadas. Cualquier
resultado futuro debe ser revisado por su contenido, no solo por huellas o grants.

## 2C.2 — contrato del lector Export

Nuevo esquema privado sgp_linea_c2. Ningún lector real se registra automáticamente.
Registro privado `lectores`: componente, firma text→jsonb STABLE, MD5 de definición,
huella de propietario/ACL/SECURITY DEFINER/configuración,
protocolo PRODUCCION_B2_V1 y referencia de evidencia. Solo propietario revisado puede
registrar; no navegador/pool público. Las huellas detectan cambios, NO prueban por sí
solas la corrección del cuerpo ni participación de escritores.

Cada lector recibe exclusivamente key de producción y devuelve desde servidor:
- production, revision opaca no reutilizable, generation entero positivo creciente,
  complete, sourceRef y identity {production,line,part,reserves:[...]}.
- EXPORT: applied, historyId, loadId, assembled, packed y events [{id,
  disposition: INCLUDED/EXCLUDED, sourceRef}]. Debe seleccionar el corte oficial
  vigente por identidad exacta, nunca por máximo de fecha ni nombre ambiguo.
- Las tres identidades deben coincidir. Reservas compartidas no mezclan producciones
  ni partes ni autorizan reparto de cantidades por reserva.
- Para un nuevo corte se exige clasificación explícita de TODOS los eventos locales
  existentes bajo lock. Cada evento tiene referencia de inclusión/exclusión del
  origen. Ningún evento nuevo se supone incluido por fecha/igualdad numérica.
- Nuevos eventos posteriores al corte se suman como locales; el siguiente corte
  debe volver a clasificarlos. No se sobrescriben saldos/tablas oficiales.
- Cortes incompletos/contradictorios, generación antigua o revisión reutilizada
  fallan. Un loadId ya sellado con cantidades/inclusiones diferentes se rechaza;
  una corrección oficial necesita un nuevo corte inmutable con trazabilidad.

`reconciliar` lee dentro del lock de producción, valida contratos e identidades,
normaliza el corte2B y aplica inclusión explícita. Fuentes idénticas no cambian
revisión. Evidencia ausente/error devuelve SIN_CONCILIAR, available=null, elimina
ámbitos cacheados y borra referencias conciliadas actuales; conserva historial,
eventos y cortes anteriores. Operación insegura nunca se registra como cero.

**Bloqueado en fuente real:** falta contrato instalado y ledger de inclusión por
UUID local. Si Export no contiene ese vínculo, capturarlo en el proceso oficial
con una tabla de reconocimientos (corte, evento, disposición, origen, revisión),
transaccional y revisada. Es PROPUESTA, no tabla ni cambio legacy aplicado aquí.
No inventar esa relación a posteriori por hora/cantidad/turno.

## 2C.3 — PDT y dato adicional requerido

PDT lector: items [{id,stage,active,sourceRef,sourceVersion,unitIds?}], complete.
Para ENSAMBLE activo requiere unidades persistentes explícitas, no cantidad de
piezas. Mapa unitMap {assembled,packed,sourceRef}; se contrasta cardinalidad/estado
con corte y ejecución. Mismo PDT/unidad no duplica impacto; pendientes de EMPAQUE
permanecen independientes. Origen/estado desconocidos fallan de forma segura.

No existe en la evidencia disponible un registro productivo de unidades ni su
relación verificable con PDT. Se detiene esa parte del puente real. Requerido:
identidad persistente de unidad de producción y asociación auditada PDT→unidad,
con producción, reserva/parte verificadas, versión, responsable, motivo y estado.
Capturar al identificar físicamente el impacto, no generar IDs desde id_pieza,
ordinal, perfil o cantidad. Correcciones deben versionar/anular vínculos con
trazabilidad. Esto es **PROPUESTO**, necesita revisión funcional y de fuente.

Las pruebas con U1…U10 son explícitamente SINTÉTICAS: verifican el protocolo,
no prueban existencia de esas unidades en planta. Fuentes reales sin el dato
retornan SIN_CONCILIAR y bloquean el incremento dependiente.

## 2C.4 — seguridad, frescura y concurrencia

PERMISOS lector: grants [{user,stage,sourceRef,sourceVersion}] del servidor.
Se reemplaza caché2B por fuente versionada. Rol real y vigencia de sesión se validan
con sgp_sesion_actual; no alias RECEPCION→LIDER ni roles de navegador. Una revocación
invalida caché y evidencia. Falta contrastar la fuente instalada de ámbitos y
configurar/revisar el pool mínimo: pruebas usan propietario QA, no rol productivo.

Adaptador `src/server/linea-source-bridge.js` solo recibe sesión/producción/solicitud
normal del resolvedor121; nunca snapshots, unidades ni permisos. UUID advisory lock
→ fila producción → turno, en una transacción. Reutiliza adaptador2B/resolvedor121
sin cambios mediante SAVEPOINT en la MISMA conexión. SIN_CONCILIAR confirma únicamente
invalidación, no consumo. Reintento válido no duplica ejecución.

`notificar` es hook privado para invocar ANTES de modificar una fuente en la MISMA
transacción del escritor. Obtiene lock de producción y conserva invalidación hasta
commit. No se conectó a tablas productivas. Triggers solo sobre objetos NUEVOS2B
recomprueban huellas/versiones antes de registrar eventos/auditoría; no modifican
ningún contrato legacy. Cortes ajenos al lector no pueden activarse para C2.

No basta polling ni un trigger agregado después de que un escritor tomó locks en
orden inverso. Antes de certificar un lector deben inventariarse todos los escritores,
ordenar bloqueos por key, invalidar antes de mutar y probar su colaboración real.
Los accesos directos heredados de lectura/reintento2B no se presentan como API2C;
las lecturas productivas futuras deben pasar por este boundary y scopes actuales.
No es una autorización para exponer el schema privado al navegador.

## Pruebas, instalación y reversión

PostgreSQL17.11 en Docker existente, network none/sin puertos. Fuentes/scopes de QA
sintéticos; auth capturada real. Se ejecuta regresión2B y se archiva resultado nuevo
bajo2C, conservando evidencia base sin cambios. Tests Node cubren1/2A/2B y2C.

```
python tests/linea-stage2c/run-postgres.py
node tests/linea-stage2c/adapter-postgres.mjs
python tests/linea-stage2c/safety-postgres.py
python tests/linea-stage2c/recovery-postgres.py
npm test
npm run verify:release
```

Resultados concretos en tests/linea-stage2c/evidence. Carreras reales con conexiones
psql distintas: consumo entre turnos, invalidación PDT contra consumo, cambio Export
contra conciliación, revocación de permisos contra ejecución y reintentos concurrentes
Node. No se sustituye concurrencia PostgreSQL con una prueba serial JavaScript.
Sin interfaces: no se requieren nuevas capturas PC/móvil.

Instalador REVIEW valida huellas de la base122 y hace rollback ante fallos. No está
en supabase/migrations. Reversión vacía con huella; con historial se rechaza DROP.
La contención es por keys ya gestionadas; no es un cierre global del servicio. El
operador debe impedir registrar nuevas keys mientras exista una intervención.
Para contención invalidar fuentes de esas keys con contenido=true sin borrar eventos/snapshots;
no restaurar sobre nuevas operaciones ni retirar guards dejando evidencia obsoleta.
Rehabilitación por propietario: limpiar contenido solo tras verificar fuentes; la próxima
operación debe reconciliar nuevamente. SQL preparado y probado solo en QA. No aplicar estas propuestas productivamente.

## Siguiente paso único

Revisión de ChatGPT del Draft2C y del catálogo faltante de fuentes/escritores.
No certificar producción hasta disponer de inclusión Export explícita, impacto PDT
por unidades, ámbitos reales y pool/orden de locks contrastados. No iniciar frontend,
nueva etapa, instalación, fusión ni despliegue automáticamente.

## Resultado de esta ejecución

393/393 Node; verify:release LABv362 y sintaxis PASS. PostgreSQL17.11: 18
comprobaciones2C + seis de seguridad + dos de reversión/contención; cuatro del
adaptador Node sobre PG real; regresión2B 16 PASS. Ver regression.json para fecha,
DB QA y hashes protegidos. La consulta de catálogos se ejecutó únicamente sobre
QA para validar sintaxis/READ ONLY; no se dispone de un resultado productivo nuevo.
La reversión vacía y la contención no son una prueba de restauración productiva.
