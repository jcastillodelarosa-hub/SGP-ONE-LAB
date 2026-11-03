# Apertura automática — preparación y decisión de identidad

> Actualización desde 0a6b48d: **A seleccionada solo para diseño/preparación**.
> [Diseño verificable, pruebas y bloqueo real PUBLIC](principal-a/DISENO.md).
> No autoriza creación de identidad, grants, conexión, secretos, jobs o instalación.
> El contrato de aplicación descrito abajo conserva PREPARATION_ONLY; la referencia
> técnica y su journal existen únicamente en el prototipo sintético separado.

02/11/2026, America/Bogota. Base **a19a9f6**, mismo Draft #183 y rama.
**PREPARADO / PROBADO EN AISLAMIENTO EN SU ALCANCE / EJECUCIÓN TÉCNICA BLOQUEADA.**
No se declara ejecutor automático funcional, job instalado ni registro persistente
de intentos automáticos. La restricción del encargo exige detener la decisión de
**privilegios técnicos nuevos**: el motor actual no tiene esa identidad aprobada.

## Resultado disponible

| Requisito | Preparado y comprobado | Límite exacto |
|---|---|---|
| Horarios | Plan de servidor por línea/etapa, usando periodo/siguiente y HORARIOS_TURNOS | Solo configuración vigente; sin inventar overrides por línea o festivos |
| Cierre previo | ABRIR ahora exige el último cierre con auditoría/snapshot coincidentes, incluido SIN ACTIVIDAD | No basta cambiar el estado a CERRADO |
| Identidad, cantidades y continuidad | Reutiliza ABRIR existente; no cambia su copia de raíces, antigüedad, SALE o avances | Certificación del futuro actor técnico pendiente |
| Reintentos | Intención determinista por ámbito, cierre origen/version y horario; protocolo de recibo existente | No hay canal técnico activo que envíe esa intención |
| Origen abierto | Bloqueo calculado visible para coordinador, con destino y atraso; nunca cierra/salta turnos | La consulta no persiste un evento del ejecutor |
| Ejecutor restringido | Contrato y alternativas de principal/privilegios mínimos definidos abajo | Decisión pendiente; sin roles, GRANT técnicos, credenciales ni secretos creados |
| Autorización | Fachada de lectura sigue sesión/ámbito; ABRIR conserva controles reales de rol/ámbito/contención | No se usa el nombre de un actor en JSON como autorización |
| Recuperación manual | Coordinador puede usar el ABRIR existente después de cierre válido | No se concede ABRIR al líder ni se suplanta un usuario |
| Observabilidad | Metadata de servidor y artefacto local reproducible con estados/bloqueos/intenciones | Sink duradero y ejecución técnica pendientes de la misma decisión |

## Fuentes y límites de configuración

SELECT únicamente de catálogo/configuración confirma esquema LP ausente, sesión
con huella `e964ea0d6f9af2c88010542cd3c84f9e` y una sola clave relevante:
**HORARIOS_TURNOS**, con lunes_sabado/domingo y turno1/turno2. No hay claves de
festivos ni calendarios por línea observadas. Es configuración global común vigente;
se evalúa independientemente para PANELES_2/FRAMES_2 y Ensamble/Empaque. No se
codifican horas de operación en el preparador ni se asignan horas diferentes a una
línea sin fuente. Una futura configuración por línea debe usar el mismo resolvedor
que ABRIR, no un horario paralelo del ejecutor.

No se consultaron nombres de producción/personas, tokens ni datos sensibles; no
se reintentó el bloqueo anterior. Se reutiliza continuidad/documentación vigente,
sin repetir auditoría general. #184 conserva las reglas operativas y SIN ACTIVIDAD;
no concede una identidad técnica ni un nuevo permiso de ejecución.

## Contrato de preparación implementado

La fachada existente `sgp_lp_operacion_consultar` añade `automaticOpening` con
contrato **LP-AUTO-OPEN-PREP-1**. No se crea otra RPC pública. Usa reloj de servidor
(no parámetro del navegador), último período persistido de esa línea/etapa y su
siguiente período configurado. Devuelve solo metadata, sin cantidades de producción.

Estados: MANUAL_BOOTSTRAP_REQUIRED, BLOCKED_PREVIOUS_OPEN, BLOCKED_INVALID_CLOSE,
WAITING_SCHEDULE, READY_PENDING_TECHNICAL_APPROVAL, BLOCKED_SCHEDULE_INVALID y
BLOCKED_WRITES_DISABLED. La contención no genera una intención ejecutable ni una
instrucción engañosa de apertura manual.
Incluye destino, inicio/fin, corte de origen, demora y atraso. Sin origen no inventa
un primer turno. Con origen abierto/revisión no lo cierra ni lo omite. Si se retrasa,
conserva el siguiente vencido; no salta a la fecha actual ni crea cierres intermedios.

`src/server/lp01-opening-preparation.js` produce observaciones e intenciones, con
**canExecute=false** siempre. UUID determinista y fingerprint excluyen el reloj de
reintento e incluyen ámbito/cierre/horario. Un cambio de esos datos obliga a preparar
otra intención; el futuro servidor deberá rechazar una intención obsoleta antes de
escribir, además del CAS vigente. No contiene Supabase client, llamadas de red,
lectura de tokens/variables de entorno ni código de ejecución de ABRIR.

Herramienta local de revisión, sin jobs ni conexiones:

```sh
node scripts/lp01-opening-prepare.mjs snapshots.json resultado.json
```

La salida declara PREPARATION_ONLY, cero escrituras y artefacto local. No es un
registro persistente de producción ni una confirmación de apertura. No se debe
conectar a tokens de coordinadores para hacerlo pasar por un ejecutor técnico.

## Alternativas del hito anterior: identidad y privilegios mínimos

ABRIR exige actualmente sesión SGP con rol COORDINADOR/ADMINISTRADOR y ámbitos
por producción/etapa derivados de su línea. Usar su token en un cron sería reutilizar
credenciales humanas; usar service_role añadiría privilegios generales. No se
implementa ninguna de esas salidas ni una sesión ficticia con rol coordinador.

| Alternativa a aprobar | Autenticación/ejecutor | Condición de mínimo privilegio y desarrollo pendiente |
|---|---|---|
| A. Principal PostgreSQL dedicado para worker de servidor | Conexión autenticada exclusivamente como principal técnico, sin superuser/BYPASSRLS | Solo USAGE de API privada y EXECUTE de una entrada técnica ABRIR, con ámbitos explícitos/activos por línea/etapa/producción. Refactorizar ABRIR a núcleo privado compartido con validación de actor humano/técnico en sus fachadas; no conceder acceso al núcleo ni tablas. No se ha aprobado/creado rol, fachada ni autenticación |
| B. Identidad de carga de trabajo externa | Identidad de servicio verificable por emisor/sub/aud, sin token SGP humano | Adaptador servidor verifica identidad y utiliza canal DB igualmente restringido, sin service_role. Requiere proveedor, validación y el mismo núcleo protegido/ámbitos; tampoco está aprobado/implementado |

A plantea una frontera DB explícita, condicionada al perímetro efectivo descrito
en el diseño posterior; B puede evitar una credencial DB permanente del worker si
la plataforma lo soporta. A está seleccionada solo para diseño/preparación, sin
autorización operativa. Un pg_cron nativo solo sería admisible si se acredita ejecución con
el principal restringido: no asumir que un job como postgres cumple el requisito.
La elección del principal y mecanismo de autenticación es necesaria antes de conectar
la ejecución; aplicar roles/GRANT, instalar jobs o configurar secretos seguirán
requiriendo autorizaciones posteriores, separadas de aprobar el diseño.

**Permitido al futuro principal, solo tras aprobación:** leer metadata de sus ámbitos,
solicitar ABRIR del siguiente período y comprobar su recibo; telemetría append-only
limitada a esos intentos. **Denegado:** SALE manual, ejecutar producción, cerrar o
reabrir, importar BI/Export, PDT, cambiar permisos/configuración, DDL o acceso SQL
arbitrario/directo a tablas. No ampliar automáticamente sus ámbitos a producciones
nuevas; cobertura incompleta debe bloquear y avisar, sin omitir órdenes.

La entrada técnica futura deberá validar identidad, ámbitos completos, horario
vencido, mismo último cierre válido y destino antes de abrir, dentro de la
transacción/admisión/mutex/CAS actuales. Un header o booleano “technical=true” no
sirve como autorización. Este desarrollo y sus pruebas de seguridad están pendientes.

## Observabilidad y recuperación propuestas, sin sink configurado

Evento LP-OPENING-EVENT/1: principal técnico, UUID estable de intención, UUID de
intento, ámbito, cierre/revisión de origen, horario, hora observada, demora,
fingerprint y resultado/código de bloqueo; nunca tokens ni datos de piezas/clientes.
Append-only y deduplicado por intención/intento. Confirmación remite a auditoría ABRIR.

Protocolo del futuro ejecutor:

1. Recuperar pendientes e intentar consultar el recibo antes de reenviar un commit
   incierto. Respuesta perdida no autoriza usar otro UUID ni anunciar éxito.
2. Reconsultar estado/horario/cierre actual. Un destino ya abierto manualmente se
   reconcilia como existente, no se vuelve a incorporar para inventar otra ejecución.
3. Registrar intento en sink restringido antes del envío; si falta el sink o la
   identidad, no abrir. Persistir bloqueos solo cuando ese permiso esté aprobado.
4. Origen abierto/cierre inválido: evento bloqueado, coordinador ve el estado,
   ninguna llamada CERRAR ni salto de turno. Contención: no ejecutar ni escribir
   diagnósticos LP por una ruta que evada el flag; un sink externo separado podrá
   observar el bloqueo sin modificar el esquema LP, si se aprueba.
5. Timeout/caída: resultado desconocido hasta comprobar recibo; reintento exacto
   bajo límites de la plataforma, no sondeo agresivo. Tras reactivar escrituras,
   descartar revisiones obsoletas y verificar nuevamente el plan.
6. El coordinador conserva recuperación manual autenticada. ABRIR existente
   serializa intentos y comprueba cierre real; no se cierra el origen por el worker.

Estos pasos definen el contrato; no se presentan como persistencia o runtime probado.
Falta seleccionar sink/retención/cadencia/alertas junto al principal, sin introducir
ahora un job, un secreto ni excepciones de calendario. Los festivos no se omiten
por inferencia: si se requieren, hace falta regla/configuración funcional explícita.

## Pruebas y evidencia delimitadas

- Seis pruebas nuevas del preparador: mismo UUID en concurrencia, cambio de corte/
horario/ámbito, bloqueo por espera/origen, retrasos y ausencia de ejecución habilitable.
- Seis grupos PostgreSQL real aislado: planes horarios de servidor, domingo/nocturno,
SIN ACTIVIDAD, origen abierto, cierre no acreditado, configuración variable, permisos,
contención y recuperación manual. Dos llamadas ABRIR concurrentes y recibo utilizan
**sesiones de coordinador sintéticas, únicamente como referencia manual del motor**;
no acreditan identidad técnica, despliegue de worker ni autenticación de alternativa A/B.
- PC1440/móvil390, UI→transporte local→SQL real: bloqueo visible, consultas sin
escrituras, origen sin cerrar no abre siguiente y fallback manual tras SIN ACTIVIDAD.
No se usa un stub “autorizado” para declarar operativo el ejecutor.
- Regresión SQL afectada de operación por la guarda de cierre acreditado. Resto de
evidencia válida reutilizada; no se repiten manualmente las 111 completas.

[Evidencias y límites](../../tests/lp01-apertura/evidence/). Sin validación productiva.

## Instalación y recuperación

01 continúa como propuesta de instalación fresca con flags apagados y permisos
vacíos; la modificación añade observación privada y la guarda de cierre, sin GRANT
nuevos ni otro escritor. No hay SQL de cron, roles técnicos, secretos o migración
aplicada. 03 permite verificar firmas. 06/Power BI, Programación, Export y PDT
permanecen intactos. Ante esquema ya instalado, abortar y preparar actualización
específica. Recuperación por contención/lecturas/recibos y corrección hacia adelante,
sin borrar historial. **No solicitar activación hasta resolver la identidad técnica.**
