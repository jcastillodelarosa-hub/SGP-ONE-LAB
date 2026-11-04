# Publicación LP — ejecución autorizada y controles

03/11/2026, America/Bogota. Encargo actual autoriza sincronizar main, corregir ACL,
instalar únicamente contratos seguros, fusionar y publicar **si los controles pasan**.
No autoriza inventar datos, SQL09, desactivar RLS, credenciales cliente privilegiadas
ni intervenir GOOGLE/LAC. Este estado sustituye prohibiciones de entregas anteriores
para las acciones expresamente autorizadas; no convierte pruebas locales en producción.

## Sincronización y paquete

main4b1e98e incorporado a la rama existente, conservando ambos bloques styles.css:
modal Usuarios y Programación móvil. App y cambios de reservas compartidas de main
se conservan, sin reescribir Programación. No se fuerza el PR con conflictos.

El paquete anterior era demostrativo. Ahora `artifact_kind=runtime` construye un
frontend real por lista positiva, sin archivo sintético ni bridge demo, conservando
los módulos RPC y autenticación. La importación XLSX es servidor, nunca service_role
en cliente. Backend, documentos, pruebas, archivos privados y node_modules quedan
excluidos. `public/` es el único directorio de Hosting.

Se reutiliza firebase-hosting.yml y la misma cuenta/proyecto. Push a la rama de
trabajo solo prepara y sella el ZIP sin secretos. HOLD de main puede preparar,
pero nunca publicar. La política permanece legacy hasta verificar backend; una
publicación runtime exige certificación Hosting, backend verificado, huellas LP,
SHA/run/digest revisados y versión live esperada. Los nombres lp-visual del ZIP/
artifact se conservan por compatibilidad del contrato; el manifiesto acredita runtime.
Un paquete demo no pasa como runtime y viceversa. El publicador protegido sigue
requiriendo la operación manual publish tras comprobar los pins; no se añade un
job para saltarla ni se cambia la cuenta.

## Corrección acotada de catálogos

00_catalogos_accesos_REVIEW.sql bloquea ambas tablas, comprueba ACL/owner/RLS/
columnas y los cinco consumidores nativos, revoca acceso directo PUBLIC/anon/
authenticated. No cambia datos, flags RLS, propietarios, sesiones ni funciones.
Se conservan service_role servidor y propietario. No se concede ningún privilegio.

SELECT de dependencias encontró exactamente cinco funciones consumidoras, todas
SECURITY DEFINER del propietario postgres; sin vistas ni políticas dependientes.
Frontend usa esas RPC; no hay consumidor SDK directo de las tablas en este repo.
[Metadatos sin identidades](../../tests/lp01-roles/evidence/release-consumers-readonly.json).
Cambios fuera de este repo no se presuponen auditados.

Respaldo previo: snapshot privado ACL/owner/RLS/columnas/hash de consumidores,
0700/0600, excluido de Git/CI. SHA256
`503bc9afbf2a85bf8b87f0d84ee8648978ec303e0ab51f3ad54e0a7baf0d8404`.
No copia cuentas ni permisos personales ni una base de datos. Es recuperación de
metadatos de privilegios para un cambio que no modifica datos.

00R restaura los privilegios originales únicamente con autorización de emergencia
explícita, porque reintroduce el riesgo. Comprueba deriva antes de restaurar; no
es rollback automático ni remedio para un error de interfaz. Preferir corrección
hacia adelante. Fuera de la transacción no debe restaurarse sin evaluar seguridad.
Prueba aislada verifica rollback exacto por privilegio (independiente del orden
interno ACL), cinco RPC administrativas y de accesos, denegaciones directas,
fallo atómico y admisión posterior de SQL10 contenido.

## Recuperación de Hosting acreditada por lectura

Inspect41707119884, intento2, job126297855680, misma cuenta ya configurada; GET
exitoso el03/11 a19:17 America/Bogota (00:17UTC04/11). Publish/recover no ejecutados.
[Resumen](../../tests/lp01-roles/evidence/hosting-before-release.json): live FINALIZED
`sites/sgp-one-lab/versions/0312f467cf0e9c29`,79 archivos, inventario/config iguales
al intento anterior. Esa versión retenida es la referencia exacta de recuperación;
no se equipara a main ni a un ZIP reconstruido. Releer inmediatamente antes de
publicar y detener ante cambio; serializar publicadores externos durante la ventana.
La configuración de Hosting queda acreditada, no la nueva funcionalidad LP.

## Secuencia de ejecución

1. CI del HEAD sincronizado y checks dirigidos nuevos. No aplicar si hay fallos.
2. 00 solo tras respaldo ACL, consumidores y recuperación probados. SELECT posterior
   confirma denegación directa y que las funciones/ACL/RLS nativas no derivaron.
3. Instalación contenida01→06→08→10, **sin09**. 07 no acredita emisor PDT por existir.
   Registrar cada COMMIT y verificar firmas/flags/RLS. No habilitar formatos o
   escrituras sin el servidor y las condiciones correspondientes verificadas.
4. Verificar runtime XLSX/orígenes. Cualquier variante sin evidencia falla cerrada.
   Roles nuevos se asignan desde Configuración; no inventar cuentas o sesiones
   humanas para producir una prueba. Confirmar qué operaciones quedan habilitadas.
5. Certificar política runtime y huellas, preparar artefacto revisado, CI y merge
   autorizado. La adopción de política no despliega accidentalmente; obtener el
   artefacto del SHA final. Publish protegido con SHA/run/ZIP/baseline exactos.
6. PC/móvil contra versión publicada: acceso por etapa y sesión, consultas reales,
   guardados solo con un actor real autorizado y evidencia de origen suficiente.
   Diferenciar controles de backend de una escritura productiva realmente probada.
7. Si falla backend tras uso:02 contención y corrección hacia adelante, preservar
   auditoría. Si falla frontend: recuperar la misma versión retenida, sin resetear
   datos/roles/Export. No usar00R ni restaurar tablas para un rollback de frontend.

PDT y Export conservan sus límites de origen; no se infiere liberación o inclusión.
Apertura automática sigue inactiva. Ninguna bandera local da por cumplida una etapa.
Estado de ejecución y evidencias CI se consolidan en ESTADO_OPERATIVO_ACTUAL.md.

## Diferencia detectada por CI

Run41748574445: hardening PASS, después compatibility.py abortó con
`fatal: invalid object name 'b4cf8c8'`. El checkout del job era shallow; el
contrato de la prueba requiere ese antecedente real. Se añade fetch-depth=0 y
persist-credentials=false solo a LP01. No se elimina ni se simula la comparación.
CI anterior no acredita el HEAD corregido. No se instaló SQL durante ese fallo.

El runtime XLSX toma los dos orígenes HTTPS exactos de Firebase LAB por defecto;
override explícito válido opcional. CORS no admite comodines, credenciales URL,
paths o HTTP. Pruebas nuevas ejercitan la configuración y el handler HTTP real
para OPTIONS/origen ajeno, sin RPC ni guardados simulados. Autenticación propia
SGP permanece en handler y SQL; verify_jwt=false ya era el contrato propuesto,
no desactiva RLS ni reemplaza sesión por un claim del navegador.

## Navegación y runtime dirigidos

Se detectó que las pestañas mostraban ambas etapas a los supervisores aunque SQL10
ya denegaba la etapa contraria. Se usa el rol obtenido por la sesión nativa para
limitar pestañas y selector; el retorno de Operación vuelve al turno autorizado.
El líder conserva ambas. Los accesos históricos de Seguimiento de los demás roles
no se sustituyen. Esto solo presenta capacidades; no cambia el motor de autorización.

Prueba PC1440/móvil390 con cuentas sintéticas y las RPC nativas/SQL10 reales:
supervisores limitados, clic programático contrario sin cambiar etapa, líder ambas,
Gestión de Usuarios/Roles, revocación y cierre individual T2 con cancelación/auditoría.
Las nuevas capturas de ambos tamaños se conservan en el artifact de CI del check LP;
las capturas anteriores siguen como evidencia de sus versiones, sin sobrescribirlas.
Deno2.5.6: check del entrypoint y parser real sin modificar, ambos XLSX anónimos
33/37 filas,186 ventanas por archivo, sin red. No equivale al gateway desplegado.
[Evidencia Deno](../../tests/lp01-roles/evidence/runtime-deno.json).

Respaldo privado adicional de definiciones y restricciones administrativas originales,
sin cuentas/sesiones,0600: SHA256
`a498db1d39409800565c52e49e60510bcdce7f48e664c55a87cccbf3c865e3dd`.

CI41749387056 y41750971099 agotaron los15min del job; el segundo canceló
durante navegadores tras SQL, roles PC/móvil y continuidad PASS. No es evidencia
de un check completo aprobado. El límite pasa a25min sin quitar escenarios ni
alterar disparadores/despliegues; se exige resultado concluyente del nuevo HEAD.

La primera captura adicional de Empaque mostraba Inicio por no navegar desde el
menú; se descarta como evidencia visual de etapa. El recorrido corregido usa el
menú nativo, espera la consulta SQL y no fuerza visibilidad de paneles: PC1440 y
móvil390 PASS, captura de Empaque inspeccionada. Las capturas válidas nuevas se
generan en el artifact CI. Las fixtures de política ahora fijan explícitamente
legacy no aprobado y visual/runtime aprobado, sin depender del modo real de la
política; backend false sigue bloqueando publicación. Ninguna prueba publica.

## Estado real instalado y aceptación exclusiva SQL10

CI códigoe4f8a37: los seis runs completaron SUCCESS, incluido41762498849
(SQL y PC/móvil), antes de instalar. Preparación41762493647 selló un ZIP runtime,
no una publicación. [Recibo SELECT y límites](../../tests/lp01-roles/evidence/installation-production.json).

| Instalación confirmada | Versión Supabase | Estado |
|---|---|---|
| ACL00 | 20261104025405 | Acceso directo anon/authenticated revocado en dos catálogos; cinco RPC sin cambios, RLS intacto |
| SQL01 | 20261104025604 | Esquema privado, escrituras=false |
| SQL06 | 20261104025619 | Contrato XLSX servidor, formato BI=false |
| SQL08 | 20261104025624 | Ámbitos temporales contenidos; sin responsables reales añadidos |
| SQL10 | 20261104033408 | Aceptada por conector; ocho cuerpos exactos, cinco contratos nativos preservados, CHECK validado; perfil=false |

Se ejecutó **solo** `10_roles_cierre_individual_REVIEW.sql`, SHA256
`08d17548ad781ab3f7d8b400121c448d1f064269fc858055498e36cdbdd67d82`.
No repitió01/06/08/00, no incluyó09, no activó ni publicó. Tras caducidades, el
usuario indicó que podía aceptar la tarjeta y el conector devolvió success.
[Recibo y comprobaciones reales](../../tests/lp01-roles/evidence/sql10-production.json).

- Único DROP previsto en SQL10: CHECK actual de `public.sgp_usuarios`, localizado por
  definición exacta, sustituido en la misma transacción por
  `sgp_usuarios_rol_lp10_check`: conserva los nueve roles y añade los dos supervisores.
  No DROP de tablas, DELETE, TRUNCATE ni actualización masiva de cuentas.
- Añade defaults a `public.sgp_rol_accesos` con ON CONFLICT DO NOTHING;
  no sobrescribe accesos existentes, incluidos false, ni asigna usuarios.
- Crea `sgp_lp_operacion.perfil_roles` privado/habilitado=false y cuatro helpers
  privados: operaciones_rol, acceso_rol, puede_operar y auditar_rol.
- Reemplaza cuerpos conservando firma/owner/ACL de contener_ambitos,
  permisos_en_periodo, verificar_temporal, sesion, confirmar_ambito, y las públicas
  sgp_lp_operacion_comando, sgp_lp_operacion_consultar, sgp_admin_usuario_guardar.
  Añade dos columnas de trazabilidad y un trigger a la auditoría LP.
- Los UPDATE/INSERT de cuentas/órdenes dentro de cuerpos son código para futuras
  operaciones protegidas, no se ejecutan al instalar. No cambia cuentas,
  contraseñas o sesiones actuales ni saldos Export; no desactiva RLS o abre catálogos.
- Preflight, lock/statement timeout y transacción completa: un error revierte
  instalación entera. Tras COMMIT, mantener escrituras contenidas; ante incidencia,
  contención02/corrección hacia adelante preservando auditoría. Restaurar función y
  CHECK originales solo tras comprobar que no hay cuentas con nuevos roles ni
  dependencias; no borrar usuarios/historial para forzar una reversión.

Respaldo privado de ACL, definiciones/constraint nativos y fuentes versionadas,
hashes arriba; no copia de base de datos ni datos personales. Restauración00R
reintroduciría el riesgo y no es rollback de10 o frontend. Pruebas aisladas de
Roles/Usuarios, revocación y compatibilidad, más menú PC/móvil y CI completa,
acreditan el contrato probado; no equivalen a guardados humanos en producción.

## Ajuste de red solicitado y ejecución protegida

Solo en configuración del **entorno de esta tarea Codex**, lista de destinos de
salida: permitir HTTPS443 a `sgp-one-lab.web.app`, `sgp-one-lab.firebaseapp.com`
y `ocvxbwzqxbrfndkvjmfx.supabase.co`. Conservar reglas/proxy/TLS, sin comodines.
No altera SGP live, Firebase, Supabase, usuarios, RLS ni secretos. Las herramientas
del entorno solo leen estado/diagnóstico; el responsable debe guardar/aplicar el
cambio por el flujo de configuración revisado. Tras reinicio observado, revisión5
aún no contiene esos destinos; no se infiere configuración concedida por el reinicio.

La publicación seguirá en el workflow existente/proyecto/cuenta existentes. El
conector no expone workflow_dispatch: un operador tendrá que iniciarlo desde
GitHub cuando se entreguen SHA/run/digest/live exactos y la política permita publicar.
No ejecutar publish ahora: faltan runtime/orígenes/verificación y activación;10 ya está instalado.
No crear infraestructura, transferir credenciales, saltar403/proxy o publicar una
versión incompleta como operativa. El rollback exacto de Hosting conserva su
referencia0312f467cf0e9c29; refrescarla inmediatamente antes de publicar.

## Alternativa vigente: conservar JWT (propuesta, no desplegada)

La revisión automática rechazó la primera solicitud Edge con verify_jwt=false y
credencial privilegiada integrada por faltar aprobación explícita de esa frontera.
No se reintentó con otra vía. El usuario eligió **mantener JWT y revisar alternativa**.

| Capa | Propuesta concreta | Límite |
|---|---|---|
| Gateway de Edge | verify_jwt=true; Authorization Bearer con JWT público anon existente/activo, mismo proyecto | Identifica la aplicación/proyecto, **no a una persona**; la firma debe verificarse realmente en plataforma |
| Cliente | Campo lpPowerBiGatewayJwt adicional, rol anon/proyecto/expiración comprobados antes de transmitir; clave sb_publishable del SDK sin cambios | No service_role, secretos o sesiones humanas en configuración; los checks locales no validan criptografía del servidor |
| Persona | Token propio SGP en p_token, separado del JWT público; sgp_sesion_actual y SQL10 verifican estado/accesos | No se convierte el token SGP en JWT ni se inventan usuarios Supabase Auth |
| Servidor | Credencial integrada SUPABASE_SERVICE_ROLE_KEY solo en Edge, allowlist exacta sgp_sesion_actual/sgp_lp_operacion_importar_xlsx | Credencial con privilegios elevados preexistentes; no es un principal restringido nuevo y requiere aprobación expresa. Nunca se envía al navegador |
| SQL | Sesión, rol, línea, etapa, producción, revisión y contención transaccionales ya instalados | Escrituras/BI/perfil=false hasta comprobar servidor y autorización; no se amplían grants |

El JWT anon existente se observó activo y su payload es rol anon/proyecto correcto;
no se generó o rotó ninguna clave. Es compatibilidad **legada**, no una migración
de identidad. La [guía oficial actual](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)
indica soporte de claves legadas hasta finales2026 y recomienda retirarlas: revisar
esta dependencia antes de esa fecha. El resto de SGP conserva la clave moderna.
No se certifica hoy la aceptación de firma por el gateway real; falta desplegar y probar.

Pruebas nuevas: separación de cabeceras, JWT ausente/rol elevado/proyecto ajeno/
expiración rechazados antes de enviar, error del gateway sin falsa importación,
RPC sesión indisponible503 frente a sesión inválida401. Estas últimas son fixtures
de transporte, **no** una prueba de autenticación real. Deno2.5.6 compila; solo se
repitió el recorrido XLSX afectado PC1440/móvil390 con handler/parser y PostgreSQL
reales sintéticos. Adaptador XLSX y motor SQL no cambian.
[Evidencia limitada](../../tests/lp01-roles/evidence/jwt-alternative.json).

Para verificar HTTPS se prepara scripts/lp-backend-readiness.py en **el mismo**
job prepare del workflow existente. No despliega Edge ni usa credenciales
privilegiadas; solo clave pública, JWT anon público y marcador de sesión inválida.
Comprueba CORS, JWT ausente/firma alterada rechazados, JWT público válido alcanzando
la validación SGP, salud de RPC sesión y denegación de lectura sin sesión en ambas
etapas. No llama RPC de escritura ni crea órdenes/cierres/datos ficticios. Un error
de sesión se devuelve503 para no confundir servidor roto con una denegación sana.

Inicialmente backend_probe_required no está habilitado: resultado NOT_REQUESTED,
sin conexión ni certificación. Se habilita únicamente tras despliegue Edge aprobado;
las llamadas se hacen desde la red propia del runner Actions ya autorizado para
la publicación, sin modificar/proxificar la red restringida de Codex ni sortear403.
El comprobador es una comprobación de endpoints públicos, **no** una vía alternativa
para ejecutar el despliegue rechazado. Verificar pantallas y guardados con datos
reales requerirá una cuenta SGP autorizada; nunca se simulará esa identidad.

La nueva frontera (JWT=true + credencial integrada privilegiada solo servidor)
fue autorizada expresamente por el usuario para el commit8f85586 y desplegada por
el conector: lp-powerbi v1 ACTIVE, verify_jwt=true. Se recuperaron y compararon
los cinco archivos del servidor, byte-idénticos a la fuente aprobada.
[Recibo real](../../tests/lp01-roles/evidence/edge-jwt-production.json).
Se habilita ahora backend_probe_required en prepare del workflow existente;
pendiente resultado real HTTPS. No frontend publicado, escrituras/BI/perfil=false,
firma gateway y usuarios/guardados reales aún sin certificar. El rechazo de la
propuesta JWT=false no se sorteó: se revisó y aprobó una frontera distinta.
