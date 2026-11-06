# Paquete de autorización — no ejecutado

La autorización para crear PR no autoriza estas operaciones. No se ha realizado ninguna de ellas. Picking v396, calendario, HOLD, pins, ACL previas y `sgp_lp_operacion.config.escrituras` permanecen intactos.

## 1. Definiciones SQL

Instalar en orden `01_storage_REVIEW.sql` y `03_native_bridge_REVIEW.sql`, con las huellas exactas de `manifest.json`. Antes: comprobar dependencias del README y definición de `archivos_adaptador_check`. Después: cuatro tablas privadas con RLS y cinco funciones nuevas (tres RPC de cierre, una RPC de apertura y una función interna de trigger); sin acceso API. Los tres indicadores nuevos nacen falsos.

## 2. Cierre y pantalla

Destino: Edge Function existente `lp-powerbi`, mismo origen permitido y `verify_jwt=true`. Conexión preparada en su entrypoint usando la credencial servidor ya referenciada por ese servicio; no solicita ni crea otra credencial.

ACL propuesta, antes: ningún EXECUTE para service_role en las funciones nuevas. Después, exclusivamente:

- `public.sgp_lp_official_read_v1(text,jsonb)` → EXECUTE a `service_role`.
- `public.sgp_lp_official_context_v1(text,jsonb,uuid,text)` → EXECUTE a `service_role`.
- `public.sgp_lp_official_commit_v1(text,jsonb,uuid,text,text,bigint,jsonb,jsonb,jsonb)` → EXECUTE a `service_role`.

Sin EXECUTE para anon/authenticated/PUBLIC, sin acceso directo a tablas. La allowlist nueva de Edge contiene solo esas tres RPC; la allowlist V1 se conserva. Cada RPC valida sesión SGP y ámbito existente.

Operaciones separadas a aprobar: desplegar el candidato integrado de Edge/pantallas; establecer `SGP_LP_OFFICIAL_CLOSE_ENABLED=true`; habilitar `sgp_lp_official.config.enabled` y `native_close`. No habilitar escrituras globales si están contenidas: el flujo respeta `admitir()` y falla explícitamente.

Comprobación posterior propuesta: importación autorizada de archivo real, recarga idéntica con delta cero, cierre con cobertura completa, consulta histórica y cotejo de Disponible. No introducir datos productivos de prueba.

## 3. Apertura automática (autorización independiente)

Código preparado: `src/server/lp-official-turn-runner.js` y `public.sgp_lp_official_open_due_v1(text,text,text)`.

Permiso adicional propuesto: EXECUTE de esa única RPC a `service_role`; nunca a API pública. Habilitar `automatic_open` solo tras identificar y aprobar una identidad SGP de servidor con rol/ámbitos existentes, su ciclo de renovación y revocación, y el host/job que la utiliza. No existe identidad técnica aprovisionada ni job instalado por este bloque. Esos identificadores concretos siguen pendientes; no se debe activar con una sesión humana copiada ni con credenciales enviadas al chat.

El job propuesto invoca periódicamente los ámbitos autorizados ENSAMBLE/EMPAQUE × PANELES_2/FRAMES_2; el servidor calcula período según HORARIOS_TURNOS y America/Bogota. No recibe fechas/horarios inventados del job, no cambia configuración y no salta turnos pendientes. Frecuencia/host requieren confirmación operacional antes de programarlo.

## Contención y recuperación

`02_contain_REVIEW.sql`: deshabilita `enabled`, revoca RPC nuevas de API/service_role y conserva todos los datos. Detener el job si se instaló y quitar el opt-in de Edge. Con 03 instalado, poner también `native_close=false` y `automatic_open=false` como contención explícita. No eliminar archivos V2, cierres, definiciones, incorporaciones o recibos; no reabrir turnos automáticamente ni retirar el formato V2 mientras existan archivos de ese tipo.

Pruebas ya disponibles: PostgreSQL efímero de persistencia/workflow/puente, dominio y recorrido UI sintético PC/móvil. Falta CI del candidato integrado y aprobación específica de las operaciones anteriores.
