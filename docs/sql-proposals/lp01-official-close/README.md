# Cierre oficial · persistencia aislada en revisión

Sin instalación/activación productiva, grants ni credenciales nuevos. No fusionar
ni publicar todavía. Continúa `26fc8fdd` y no depende del worktree de afectaciones.

## Recorrido implementado

`lp-powerbi-handler.js` acepta el opt-in `LP-PBI-XLSX-2` **solo si** el servidor
recibe `officialService`; por defecto null, devuelve bloqueo. La ruta V1 conserva
su implementación. No hay otro lector XLSX: V2 llama al mismo `parsePowerBI`.
No se cambia la configuración de la Edge Function ni se conecta el servicio
en producción. `lp-official-close-service.js` recibe únicamente archivo/comando;
catálogo, actor, hora, plan, estado y horario se obtienen de RPC autenticada.

Propuesta `01_storage_REVIEW.sql`: cuatro tablas privadas/RLS, configuración
apagada, dos RPC sin EXECUTE para roles API. Contexto lee estado durable y
fuentes, commit compara revisión y fingerprint, bloquea fuentes durante commit,
persiste transición, recibo y XLSX original. UUID reintentado recupera recibo
previo después de volver a comprobar sesión/ámbito. Error sin respuesta después
del commit devuelve HTTP503; debe conservarse el UUID, nunca fingir rechazo.
Historial/archivos son inmutables y el plan se congela al cerrar. Las entradas
ausentes no se borran. Ninguna escritura en acumulados Export o ejecución manual.

La función de horario reutilizada es `sgp_lp_operacion.periodo(date,integer)`:
lee `HORARIOS_TURNOS`; se conserva su zona America/Bogota. Sin horario real o
turno nativo existente devuelve bloqueo. No crea turnos ni horarios de relleno.

## Dependencias y permisos antes/después

| Objeto | Antes | Después de definición, aún deshabilitada |
|---|---|---|
| sgp_lp_official | Ausente | Esquema privado, owner postgres |
| config/ledger/events/files | Ausentes | Owner solamente; RLS; cero grants API |
| sgp_lp_official_context_v1 | Ausente | SECURITY DEFINER/search_path vacío; owner solamente |
| sgp_lp_official_commit_v1 | Ausente | SECURITY DEFINER/search_path vacío; owner solamente |
| Roles/ACL/sesión existentes | Vigentes | Sin cambios |

Dependencias: `sgp_lp_operacion.sesion`, `admitir`, `periodo`, `inmutable`, permisos,
turnos, producciones y asignaciones existentes. No se reemplazan. Si default ACL
asigna un privilegio adicional a los objetos nuevos, la definición aborta de
forma atómica; no cambia default ACL como atajo. Solo se admite ejecución del
instalador como postgres, owner revisado. Nuevas RPC **no deben concederse a anon
o authenticated**: el commit recibe transición calculada por servidor de confianza.

Activación futura requeriría revisión específica del acceso del servidor ya
existente, wiring del handler y configuración nueva. No se prepara una credencial,
rol ni habilitación automática. Este paquete no solicita activación mientras
subsistan las integraciones pendientes abajo. Huellas en `manifest.json`.

`02_contain_REVIEW.sql` es recuperación no destructiva: apaga exclusivamente
este escritor y revoca únicamente sus dos RPC de roles API (incluido service_role
si existe); conserva datos, originales y recibos. No DROP ni borrado de historial.
Ningún archivo del paquete fue aplicado en Supabase.

## Evidencia y límites

`tests/lp01-official-close/postgres.py` ejecuta el servicio Node real, parser
existente y RPC reales en PostgreSQL17.11 aislado sin red. Identidades, sesiones,
planes y archivos son sintéticos/anonimizados; auth capturada reutilizada del
harness existente. El test crea únicamente su contenedor efímero y lo elimina.
Resultados: `postgres-result.json`. No prueba de los XLSX originales nuevos ni
sesión productiva. Pruebas HTTP dirigidas adicionales verifican opt-in apagado,
rechazo de autoridad del cliente y respuesta incierta. No CI completa repetida.

**Pendiente:** este journal aún no cambia `sgp_lp_operacion.turnos` a CERRADO
ni adapta su predecesor/arrastre. Tampoco escribe las definiciones de Disponible
activas: falta persistir/conciliar su base intraturno. La UI aún no consume V2 ni
retira el campo manual. El estado de cierre oficial almacenado no acredita un
turno operativo cerrado. Falta completar esos enlaces y contrastar los originales
antes de congelar candidato e iniciar la única CI completa coordinada.

Resumen compartido: esperando ruta/API exacta de `sharedOrderSummary` del hilo
dueño. No se copia ni recrea esa función. `mountTrackingAffectations` ya se
consume con target null/scope.stage en las hojas, desde el incremento26fc8fdd.
