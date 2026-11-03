# Principal A — diseño verificable, no instalación

02/11/2026, America/Bogota. Referencia **0a6b48d**, mismo Draft **#183**, Issue
**#184**. A seleccionada exclusivamente para diseño/preparación. **LISTO PARA
REVISIÓN / PROBADO EN AISLAMIENTO / BLOQUEADO EN EL ENTORNO REAL ACTUAL.** No hay
principal productivo, credencial, secreto, job, permiso nuevo, SQL aplicado ni
worker operativo. La aplicación y sus propuestas de instalación 01–06 no cambian.

## Viabilidad de Supabase: resultado y límites

El catálogo real observado mediante [SELECT reproducible](../../../tests/lp01-principal-a/catalog-readonly.sql)
se conserva en [evidencia](../../../tests/lp01-principal-a/evidence/supabase-catalog.json):
PostgreSQL **17.11**, esquema LP ausente, misma función de sesión SGP
`e964ea0d6f9af2c88010542cd3c84f9e`. No se consultaron filas productivas,
identidades/personas, tokens, claves de producción ni secretos; no se reintentó
la consulta sensible bloqueada del encargo anterior.

**Impedimento demostrado:** existen **83** funciones `sgp_* SECURITY DEFINER`
con `EXECUTE` para `PUBLIC` en el esquema public; **80** son invocables excluyendo
retornos trigger/event_trigger. Además PUBLIC tiene USAGE en public y
CONNECT/TEMPORARY en la base. No se observaron grants a PUBLIC sobre tablas public.
Ejemplo acotado: `sgp_reservas_por_produccion_json(text)` devuelve JSON consultando
una vista de reservas con derechos del propietario y sin validación de sesión en
su cuerpo. Solo se leyó su definición, **nunca se ejecutó**. No se afirma que las
80 funciones carezcan de autorización interna ni que todas escriban datos.

Un nuevo LOGIN también recibe privilegios de PUBLIC. **NOINHERIT no lo elimina y
REVOKE al rol no lo niega**: PostgreSQL no tiene DENY que reste esa concesión.
Por tanto, otorgar únicamente tres funciones nuevas al principal **no garantiza
«solo ABRIR» en esta base**. TEMP también impide prometer ausencia total de DDL.
La prueba sintética reproduce ambas situaciones, sin ejecutar helpers reales.
El control de perímetro propuesto falla cerrado, pero **no revoca los permisos
ajenos que el worker podría invocar directamente**. No resuelve por sí solo el
impedimento. No se alteran ACL globales ni otros módulos para solventarlo.

| Pregunta | Evidencia / resultado |
|---|---|
| ¿Supabase soporta LOGIN PostgreSQL propio? | Sí como capacidad documentada de plataforma: [roles](https://supabase.com/docs/guides/database/postgres/roles). Crear un usuario por servicio es compatible en principio. No se creó ni autenticó uno en este proyecto |
| ¿Basta una clave supabase-js o el token SGP? | No. El LOGIN PostgreSQL es identidad de conexión TCP; la arquitectura vigente usa frontend Firebase Hosting → API Supabase y sesiones SGP propias. No existe runtime de worker TCP desplegado; no se reutiliza coordinador, anon/service_role ni secreto general |
| ¿Qué ruta se propone comprobar? | Conexión directa servidor → PostgreSQL, TLS con validación del certificado/hostname y `session_user` igual al LOGIN aprobado. [Conexiones administradas](https://supabase.com/docs/guides/database/connecting-to-postgres) documentan directa IPv6:5432 (IPv4 requiere alternativa/add-on), Supavisor sesión IPv4:5432 y transacción:6543 |
| ¿Está certificada la ruta real? | No: no se han probado endpoint, acceso de red, TLS, login, SCRAM, límites ni disponibilidad de IPv6 desde un runtime aprobado. No se requieren/leen credenciales para este diseño |
| ¿Pooler intercambiable? | No se asume. Antes de elegir Supavisor/PgBouncer hay que verificar soporte del LOGIN propio, formato del usuario, `session_user` efectivo a través del pooler, conexiones aisladas por identidad, transacciones y configuración. La documentación de [pooling](https://supabase.com/docs/guides/database/connecting-to-postgres/pooling-and-limits) no prueba esa identidad en este proyecto |
| ¿A desplegable en el entorno actual? | **No, tal como está**: perímetro PUBLIC incompatible y canal real no acreditado. Requiere resolver/autorizar esos puntos por separado antes de cualquier instalación |

No basta una prueba en PostgreSQL local para certificar las particularidades de
Supabase. El test usa LOGIN reales sin contraseña por socket local y trust **solo
en el contenedor desechable sin red**; no prueba contraseña, TLS ni pooler real.

## Separación de autorización y núcleo compartido

[Referencia ejecutable aislada](shared-reference.sql), **no instalador**, protegida
por marca sintética + GUC explícito y rechazo de producciones no QA. No contiene
CREATE ROLE, contraseñas ni GRANT; las concesiones del test son fixtures locales.
La doble marca evita ejecución accidental, no es una frontera de seguridad para
un DBA que deliberadamente la eluda. No conectarla a migraciones ni al runtime.

```text
Humano: fachada SGP + token → sesión real + COORDINADOR/ADMINISTRADOR + ámbitos ┐
                                                                           ├→ core_open privado → ABRIR existente
Técnico: sesión PostgreSQL → session_user/OID + registro/ámbitos/perímetro ────┘
```

La fachada técnica construye internamente el actor. No acepta token humano,
`actor`, `role`, `usuario`, capacidad ni operaciones diferentes de ABRIR en JSON.
Ni un GUC ni los claims HTTP son credenciales técnicas. No se usa SET ROLE para
simular un LOGIN válido; el `session_user` original debe coincidir con OID y nombre
registrados. Recrear un rol del mismo nombre no conserva autorización. Se rechazan
membresías y atributos incompatibles. El núcleo nunca se concede al worker.
La fachada humana de referencia también rechaza una sesión DB registrada técnica,
incluso ante un grant accidental y un token SGP sintético válido. Esto no corrige
fachadas históricas ajenas: su permiso PUBLIC continúa siendo el bloqueo señalado.

El núcleo comparte **la rama real ABRIR de incorporación e inicialización de
Empaque de 01**, comprobada byte a byte salvo sus dos predicados de permisos,
proyectados a comprobación humana/técnica. Usa periodo/siguiente, cierre_valido,
raíces, iniciar_empaque, auditoría, CAS y los mismos mutex/admisión existentes.
No hay stub de negocio ni llamada como coordinador desde la fachada técnica.
Las fachadas de referencia se prueban juntas; **la extracción todavía no está
integrada en las RPC de instalación/aplicación**, por el bloqueo de perímetro y el
alcance de diseño. Antes de instalar habrá que proponer/revisar esa integración,
conservar firmas humanas, y comprobar regresiones de los contratos consumidores.

La identidad en auditoría es `TECH_DB:<OID>`, `actorKind=TECHNICAL`, `LP_ABRIDOR`,
no COORDINADOR. Los ámbitos técnicos son independientes de usuarios SGP y requieren
registro explícito activo por **principal, línea, etapa y producción**. No se
infieren de tener acceso a otra etapa ni se omiten órdenes fuera de ámbito.
OID/nombre, vigencia, flags de lectura/apertura y ámbitos se validan antes y después
del mutex; el bloqueo compartido del registro/ámbitos se mantiene hasta COMMIT.
Toda administración futura de ámbitos deberá bloquear primero su registro padre.
Una revocación confirmada impide nuevas admisiones; espera las ya admitidas, no
pretende cancelar instantáneamente una transacción que aún está en curso.

## Matriz exacta propuesta (no concedida)

Nombres `lp_a_*` son del prototipo. Nombre productivo/propietario definitivo queda
para el SQL de integración revisado, nunca para creación automática.

| Objeto/acción | Principal técnico | Humano autorizado | Propietario de funciones |
|---|---|---|---|
| LOGIN DB | Dedicado, NO superuser/BYPASSRLS/createdb/createrole/replication/inherit; sin membresías; límite de conexiones acotado | No se concede LOGIN nuevo a usuarios SGP | Propietario separado NOLOGIN a determinar/revisar; nunca propiedad del worker |
| Base | CONNECT exclusivamente; sin CREATE/TEMP | Contrato histórico | Solo lo necesario para administrar instalación autorizada |
| `lp_a_api` | USAGE; sin CREATE | USAGE por roles del contrato SGP | Propiedad controlada |
| `plan(text,text)` | EXECUTE: metadata de horario/cierre de su línea/etapa | Lectura humana vigente, sin ampliar | Lee funciones protegidas |
| `open(jsonb,uuid)` | EXECUTE: ABRIR exclusivamente, nunca capacidad/bootstrap/reapertura | No por esta entrada | Ejecuta núcleo privado como definer |
| `receipt(uuid)` | EXECUTE: resultado propio, vuelve a validar ámbitos | Recibo humano vigente | Lee intentos/auditoría |
| `human_open(text,jsonb)` | **Denegado** | Sesión SGP y coordinador/administrador reales; conserva cobertura de producción | Construye actor humano |
| Núcleo, registro, ámbitos, journal/tablas LP y datos upstream | **Sin USAGE privado, EXECUTE, SELECT, DML, TRUNCATE ni propiedad** | Sin acceso directo añadido | Derechos mínimos explícitos que exige el núcleo; RLS permanece activo |
| RPC humanas, otras funciones SGP/PUBLIC, cambio de configuración/saldos, cierre/reapertura/importación | **Denegado requerido; hoy incumplido por PUBLIC** | Contratos existentes, sin ampliación | No abrir otras fachadas ni exponer el core |
| Otorgar/revocar, SET ROLE de otros, crear funciones/tablas/esquemas/extensiones/jobs | **Denegado** | Sin permisos nuevos | Administración autorizada separada |

SECURITY DEFINER implica derechos del propietario dentro del núcleo. El prototipo
usa postgres propietario solo en aislamiento; **no demuestra mínimo privilegio del
futuro propietario productivo**. Debe definirse propietario NOLOGIN con grants
privados acotados, dependencias/fijación de search_path vacío y cualificación total.
Nunca ejecutar el worker como ese propietario. Revocar PUBLIC por función nueva,
verificar ACL efectivos/default ACL y eventuales permisos por columna/secuencias,
no solo grants directos del worker. No desactivar RLS ni exponer API privada en
PostgREST. La revisión global necesaria para resolver PUBLIC queda fuera de este
cambio acotado y exige autorización propia.

## Transacción, contención e intentos persistentes

Se reutiliza la intención determinista ya implementada sin convertir su
`canExecute=false` en una autorización. El test enlaza command + referencia de
cierre/versión/inicio/fin únicamente a la fachada aislada. El servidor revalida:

1. Sesión técnica registrada, vigencia, atributos/perímetro y cobertura completa;
   admisión de escrituras con su bloqueo compartido.
2. UUID de intención ligado a principal y payload inmutable; UUID de intento
   separado. Mutex de petición → mutex línea/etapa → fila de turno, compatibles
   con el motor actual; reautorización después de esperar.
3. Destino siguiente configurado, origen CERRADO con último corte acreditado
   (incluido SIN ACTIVIDAD), misma referencia y horario aún vigente; reloj DB ya
   alcanzó inicio. No bootstrap técnico, salto ni cierre automático del origen.
4. Destino ausente y revisión esperada. Otro request que ya creó el turno recibe
   EXISTING_REQUIRES_RECONCILIATION: no reincluye órdenes ni cambia capacidad/SALE.
   El request idéntico con apertura confirmada devuelve su resultado previo.
5. Rama de continuidad real; cantidades/raíces/antigüedad/afectaciones permanecen,
   destino tiene ejecutado cero. Capacidad, reparto y decisiones de coordinador
   pendientes continúan visibles; el worker no las inventa.

`intents` liga UUID/principal/ámbito/payload; `events` agrega cada intento admitido,
fecha/hora servidor, identidad por OID, request y resultado seguro. Auditoría LP
registra el ABRIR efectivo. Ambos journals son append-only con RLS, sin acceso
worker directo. Repetir el mismo attempt devuelve el mismo evento; nuevo attempt
puede registrar reintento con el mismo request/payload. Cambiar cierre/horario
requiere refrescar plan y nueva intención determinista, no reciclar el UUID.

Errores de negocio se capturan en subtransacción: revierten efectos del núcleo y
se **confirma** evento BLOCKED en la transacción exterior. El cliente debe confirmar
COMMIT aun al recibir `{ok:false}`; si aborta la transacción tampoco habrá evento.
Errores de autenticación, payload o contención se rechazan antes del journal.
Un timeout/cancelación, caída de conexión o rollback no garantiza evento persistido:
consultar recibo en nueva conexión antes de reintentar. Si la apertura se confirmó
y se perdió la respuesta, receipt recupera resultado sin abrir otra vez.
No guardar tokens, secretos ni filas productivas en errores o logs.

La observabilidad de servidor futuro necesita métricas de demora/último éxito,
BLOCKED por causa, conflictos, fallos de autenticación/transporte y heartbeat;
alerta al coordinador por retraso/origen abierto y runbook con request/attempt.
Los rechazos anteriores al journal necesitan logs del host/DB sin datos sensibles.
El diseño persiste eventos en el prototipo; **no hay sink de host, pantalla nueva,
worker ni job instalado**, ni se afirma visibilidad productiva de esos eventos.
La observación coordinador ya existente y apertura manual quedan intactas.

## Reversión y recuperación propuestas

- Antes de una instalación futura: guardar definiciones/ACL/propietarios/default
  ACL de objetos afectados, configuración, versión/fingerprints y punto de
  recuperación autorizado. No se creó respaldo/copia ni se exportó base real.
- Primero detener disparador, deshabilitar admisión técnica (`allow_open=false`)
  con transacción/registro padre bloqueado, esperar drenaje y registrar corte.
  Mantener `allow_read` y ámbitos necesarios para resolver recibos inciertos.
- El conmutador global de escrituras sigue siendo contención común: espera
  admitidos y no registra eventos nuevos mientras esté apagado; lectura de recibos
  continúa si la autorización sigue válida. No reactiva otros escritores por su cuenta.
- Tras drenaje y recibos: revocar EXECUTE técnico y USAGE, impedir nuevas conexiones
  con NOLOGIN, retirar job/secretos del runtime futuro con autorización. NOLOGIN no
  expulsa sesiones existentes: comprobar/cerrar exclusivamente las identificadas
  del worker si se autoriza terminación, nunca otras sesiones.
- No borrar eventos, intenciones, auditoría, cierres ni órdenes. Rotación futura:
  identidad nueva registrada por su OID, no reutilizar un rol eliminado esperando
  que conserve autorización; transición/drain explícitos y trazabilidad separada.
- Si no hubo ABRIR confirmado, restaurar firmas/cuerpos/ACL previos tras verificar
  huellas y dependencias. Si hubo aperturas o turnos sucesores, **corrección hacia
  adelante** del código/permiso/ámbito; no borrar arrastres ni decrementar ejecución
  ni deshacer saldos. Reapertura solo coordinador y motor vigente. Resolver recibos
  y la cadena antes de una corrección histórica funcionalmente autorizada.
- El perímetro PUBLIC no tiene rollback propuesto aquí: cualquier futura
  modificación global exige mapa de consumidores, autorización y plan de
  compatibilidad independiente. No restaurar permisos indiscriminadamente.

## Alternativa B, sin implementación

A no es viable **tal como está hoy**. B mantiene identidad de carga verificable
(emisor/sub/aud/caducidad/replay), puerta de servidor estrecha y canal DB protegido;
puede evitar entregar un LOGIN SQL al proceso que dispara. Requiere proveedor,
validación, runtime y núcleo comunes, límites de invocación y observabilidad.
No usar service_role ni un token coordinador como sustituto. B **no arregla por sí
sola** los privilegios PUBLIC del principal de su adaptador DB: debe demostrarse
una frontera que impida SQL arbitrario a la carga y evaluar el canal interno y su
riesgo residual. Una función aislada con más privilegios tampoco prueba el mínimo
privilegio exigido. No se selecciona ni implementa B automáticamente; requiere
nueva decisión arquitectónica si no se autoriza resolver el perímetro de A.

## Pruebas pertinentes y evidencia reutilizada

Ejecutar `python tests/lp01-principal-a/postgres.py` con Docker local disponible.
Crea un PostgreSQL 17.11 nuevo `--network none`, sin puertos, aplica solo allí el
candidato LP y la referencia, crea roles sintéticos sin contraseñas, prueba y
destruye el contenedor. No conecta a Supabase. El test no invoca catálogo remoto.
[Evidencia de esta ejecución](../../../tests/lp01-principal-a/evidence/postgres.json).
Verifica rama fuente real/proyección, sesiones LOGIN y no SET ROLE falso, denegación
de tablas/DDL/core/humanos y otras operaciones, claims falsos, atributos/membresías,
índices/identidades de intentos, SIN ACTIVIDAD, concurrencia/reapertura, inválidos,
reintentos, recuperación y contención; el reparto 288 mantiene cuatro raíces sin
reproducir avances ni convertir piezas en ventanas. CSV-QA solo alimenta el cierre
normal sintético; **no certifica el adaptador XLSX**, que permanece intacto.

Se reutilizan evidencias válidas de 0a6b48d: horarios domingo/nocturno, preparador,
PC/móvil y motor LP/Power BI/continuidad/SIN ACTIVIDAD. Sin UI o runtime modificado,
no se repiten las 111 pruebas ni auditorías generales. Workflow nuevo ejecuta
únicamente esta prueba aislada, sin secretos, Supabase ni jobs operativos. La CI
general obligatoria puede repetir su propia batería; no sustituye esta prueba ni
certifica producción.

## Operaciones posteriores que requieren autorización expresa

1. Resolver **el perímetro PUBLIC** mediante propuesta independiente: inventario
   acotado de consumidores/dependencias, mínimo privilegio y compatibilidad antes
   de cualquier REVOKE/GRANT global, cambio de default ACL o aislamiento alternativo.
   No hay autorización para afectar otros módulos desde este diseño.
2. Definir/crear propietario privado y LOGIN técnico con atributos/conexiones
   revisados; otorgar CONNECT/USAGE/EXECUTE efectivos mínimos; registrar sus ámbitos
   y vigencia reales. Toda DDL/DCL/DML productiva requiere autorización separada.
3. Generar/provisionar/rotar credenciales y secretos; elegir runtime/endpoint/red;
   validar TLS, autenticación del LOGIN y `session_user`, límites y pooler si aplica
   mediante prueba controlada autorizada. No se solicita ni ejecuta ahora.
4. Preparar y aprobar instalador real, extracción del núcleo/fachadas y journal,
   firmas/hashes/dependencias, respaldo previo autorizado, orden de instalación,
   regresiones humanas y reversión/corrección hacia adelante. **No instalar esta
   referencia sintética** ni tratar 01 sin modificar como integración técnica.
5. Aprobar ámbitos/responsables, retención/sink/alertas, activación de escrituras y
   alcance de pruebas productivas; preparar jobs y frecuencia solo tras identidad
   y observabilidad verificadas. No definir festivos ni horarios nuevos por inferencia.
6. Crear/configurar jobs, desplegar runtime/frontend/Edge, fusionar/publicar y
   activar ejecución automática: cada operación permanece fuera de la autorización
   actual. Hasta entonces se conserva la apertura manual ya preparada y desactivada
   productivamente junto al módulo.
