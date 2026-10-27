# Etapa 2E — escritores, permisos, riesgos y pruebas

## Escritores y concurrencia

| Escritor | Evidencia | Bloqueos/revisiones vistos | Conclusión |
|---|---|---|---|
| Entrega Picking6/8 | Capturas previas, INSERT entrega/faltantes/PDT | No protocolo fila producción B2 demostrado | No certificable como escritor coordinado actual |
| validar_recepcion | Captura hace FOR UPDATE de entrega, luego actualiza faltantes/PDT y estado | Entrega primero; no demuestra producción→turno | No agregar un hook tardío y afirmar ausencia de deadlocks |
| Guard de completa duplicada | SQL versionado/captura, advisory hash(programación\|producción,0) | Serializa completas activas en ese ámbito | No sustituye el lock global de producción del motor |
| Guard PR125 | Main, BEFORE INSERT por fecha/turno Bogotá | No bloquea producción B2; no es coordinador de fuentes | Conservar y no eludir sus rechazos |
| PDT v2 / multiorigen | SQL REVIEW/capturas de estados, detalles/movimientos | Locks/UUID de PDT no demuestran lock común B2 | Contrastar definición instalada, sin alterar LEGACY |
| Planificador registrar/mover/arrastrar | Llamadas versionadas, cuerpos actuales ausentes | Transacción, acumulado e inclusión Export no demostrados | No leer ejecución como eventos nuevos por defecto |
| Carga semanal | Código usa advisory SGP_CARGA_SEMANAL por año/semana e inserta producción/aluminio | Lock por periodo, no fila producción B2 | Considerar también este escritor al certificar fuentes |
| Aplicar Export diario | Llamada versionada; cuerpo instalado no disponible | Orden de locks/atomicidad no comprobados | Bloqueo de certificación de corte/eventos |
| B2/C2/D2 propuestos | Contratos y pruebas anteriores | UUID→producción→turno; notificación previa en misma transacción | Verificado aislado, no cooperación productiva |
| Manifiesto E2 propuesto | SQL nuevo privado | Producción compartida con ACK/eventos, sellado inmutable | Prueba real PG solo con escritores QA cooperantes |

Una huella detecta una modificación al leer, pero no elimina una carrera con un
escritor productivo que no tome el lock. Antes de certificar: listar todos los
escritores (también accesos directos/batch), bloquear keys en orden determinista,
invalidar ANTES de mutar, conservar transacción y revisión, probar cada combinación.
Los SELECT de catálogos/pg_depend no garantizan cubrir SQL dinámico ni procesos externos.

## Correspondencia de cargos y roles: no asumir equivalencias

| Operación | Código disponible | Falta / conducta segura |
|---|---|---|
| Validación Picking legacy | Captura permite PICKING, SUPERVISOR DE PICKING, LIDER LINEA, LIDER y coordinador/admin | Eso no es automáticamente permiso de validación consolidada por producción |
| Registro multiorigen | REVIEW distingue origen Picking de Ensamble/Empaque | No ampliar derechos usando origen declarado por navegador |
| Validación consolidada D2 | Rol real LIDER/LIDER PICKING/LIDER ENSAMBLE/COORDINADOR + ámbito y validationRole servidor | Labels funcionales no están contrastados con catálogo instalado |
| B2 ejecución/lectura | Sesión real + producción y etapa; roles existentes propios | El permiso nuevo de validar no amplía permiso para ejecutar/corregir |
| Lectura manifiesto E2 | autorizar ENSAMBLE y EMPAQUE desde BD, funciones sin grants navegador | No usar un permiso de ventana de UI como ámbito de producción |

En código figuran SUPERVISOR DE PICKING y LIDER LINEA, mientras D2 contempla labels
LIDER PICKING/LIDER ENSAMBLE y un grant adicional para LIDER genérico. Se requiere
un binding servidor explícito del cargo a rol/usuario/producción/etapa, con revisión;
no se crea por similitud de nombres, ni se falsifica la sesión para llamar otra RPC.
No se modifica D2 para adivinar este binding. RECEPCION→LIDER legacy no se hereda.
Se bloquea toda ampliación pendiente de esa evidencia, sin pedir contraseñas.

## Riesgos y contención

| Riesgo | Control actual | Pendiente real |
|---|---|---|
| Saldo interpretado como ejecutado / doble Export-local | Campos separados y SIN_CONCILIAR; ACK explícito | Semántica/corte y vínculo externo verificable |
| Sumar PDT superpuestos o piezas | Sin consolidación automática, D2 vigente | Composición y validación humana con cobertura real |
| Descontar dos veces | D2 bruto/neto explícito; contexto E2 nunca adivina | Certificar base de cada fuente |
| Históricos sin key o reservas compartidas | Rechazo de identidad/cobertura incompleta | Resolver con evidencia, no reconstrucción especulativa |
| Race fuente/consumo | Protocolo privado común y pruebas PG | Escritores reales y fuente de ámbitos revisados |
| Recibo tratado como certificado | SELLADO_NO_CERTIFICADO / PENDIENTE_CERTIFICACION_EXPORT, available=null | Integración atómica del importador y su semántica |
| Alterar cierres | Ledger/manifiesto inmutable, hashes de cierres preservados | Mantener procedimiento de reapertura autorizado |
| Reversión borra nuevas operaciones | Reversión solo vacía; con evidencia se niega | Reparación hacia delante, no restaurar backup sobre escrituras posteriores |
| Cambios concurrentes main | Sin cambios a archivos operativos; PR125/128 leídos por SHA | Revisar stack completo antes de integrar, nunca sobrescribir main |

## Evidencia ejecutada y reproducción

- `npm test`: **421/421**,14 nuevas. Incluye regresión de etapas anteriores y D2.
- `python tests/linea-stage2e/run-postgres.py`: **9 comprobaciones PostgreSQL17 reales**.
- `node tests/linea-stage2e/manifest-adapter.mjs`: **4 comprobaciones** sobre PG.
- `bootstrap.py`: reconstruyó la fixture sintética B2 (16 comprobaciones), solo
  para disponer de entorno QA tras la pérdida de /tmp; restaura los archivos de
  evidencia previos byte a byte. No recrea producción ni pretende instalar D2 entero.
- Sintaxis y diff check; hashes de fuentes D2/capturas/operación preservados.

El contenedor QA existente usa postgres:17, network none y ningún puerto publicado.
No Supabase, servicio externo ni credencial productiva. El test PR125 instala su
código exacto sobre cinco columnas mínimas SINTÉTICAS; no es un clon del esquema
productivo ni demuestra todos sus triggers/overloads instalados.
Concurrencia usa conexiones PostgreSQL separadas: escritor evento/ACK frente a
sellado, con ambos órdenes seguros. No se presenta una simulación serial JS como
concurrencia PG ni una fixture como integración con Export real.

Reproducir: si no existe la base QA registrada, `python .../bootstrap.py`; después
`run-postgres.py`, `manifest-adapter.mjs` y `npm test`. No cambiar nombres para apuntar
a otra base. Los scripts validan prefijos QA/aislamiento. La suite heredada D2 y
sus evidencias permanecen sin modificar; no se repite una auditoría general.
No hay cambios visuales y no se requieren capturas PC/móvil nuevas en esta fase.

## Instalación propuesta / reversión, no ejecutadas en producción

SQL en docs/sql-proposals/linea-etapa2e, fuera de migraciones automáticas. En QA se
inyecta error y comprueba rollback completo; luego se verifica éxito, lecturas con
sesión/ámbitos, rechazo de acceso directo anon/authenticated y modificación histórica.
No hay ruta, pool, lector C2 o productor de certificados conectado al runtime.
Con esquema vacío ROLLBACK_REVIEW elimina solo la propuesta E2. Con recibos,
rechaza DROP: mantener lector bloqueado, retirar una futura ruta de activación y
preservar evidencias. La ampliación no emite créditos de disponibilidad por sí misma.
No se desactiva CI ni un servicio operativo y no se modifica ningún saldo oficial.
