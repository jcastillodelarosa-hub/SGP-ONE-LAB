# Publicación controlada LP — procedimiento preparado, no ejecutado

Basebb7d052, mismo Draft183. Se adapta **firebase-hosting.yml**, proyecto
sgp-one-lab y **la misma** FIREBASE_SERVICE_ACCOUNT_SGP_ONE_LAB. No nuevos sitios,
canales, cuentas, claves, secretos, IAM o infraestructura. Ningún workflow manual,
API Firebase o publicación se ejecutó en este encargo.

**Dictamen:** mecanismo PREPARADO y probado localmente; publicación LP BLOQUEADA
por política uncertified y falta de identidad live/recuperación acreditadas.

## Por qué omitir solo el merge no era suficiente

Si se omite un único deploy pero el siguiente push publica la raíz, las cinco
pestañas pendientes se publicarían indirectamente. Tampoco se puede apagar todo
pushmain indefinidamente sin interrumpir SGP. La solución separa el código fuente
preparado en el PR del artefacto autorizado para cada vía.

Política versionada `deployment/lp-hosting-policy.json`:
mode=legacy, hosting_certified=false, baseline_version/rollback_version=null,
approved_lp_files vacío. **No se marca certificada al terminar tests o subir PR.**
La navegación anterior se conserva byte a byte desde la base PRbb224f, con SHA256;
no se reconstruye por apariencia ni se equipara a una versión Hosting activa.

| Evento / estado | Resultado | Secretos / Firebase |
|---|---|---|
| Pull request que toca workflow/helpers | Solo validación local de política/YAML; gate y deploy omitidos | Ninguno |
| Push que introduce por primera vez la política183 (merge normal, squash, rebase o lote) | HOLD, ningún deploy | Ninguno |
| Cambio posterior de política o archivos protegidosLP mientras legacy | HOLD; revisión explícita | Ninguno |
| Otro pushmain, política legacy sin cambios LP | Publicación habitual con app/config/main actuales y navegación LP anterior; bootstrap nuevo excluido | Misma acción/cuenta existentes; no lectura nueva de Hosting obligatoria |
| Dispatch sin seleccionar nada | prepare: pruebas, construir/sellar y guardar artifact14d | Ninguno |
| Dispatch inspect | GET de sitio/live/version/inventario, resumen saneado | Misma cuenta existente; sin mutaciones |
| Dispatch publish/recover con política actual | HOLD, aunque se aporten pins correctos | Ninguno |
| Transición futura legacy→visual certificada | HOLD del push; preparar/revisar/publicar manualmente | No deploy por el cambio de política |
| Push ordinario después de aprobación visual | Solo si hashes LP permanecen aprobados; construye visual readonly + cambios ordinarios SGP, lectura y postcheck | Misma cuenta, sin ampliar permisos; si falla lectura, detiene |
| Cambio LP tras aprobación | HOLD hasta nueva revisión/pins | Ninguno |

El guard usa árboles before/after y huellas, **no títulos de PR o mensajes de merge**.
Si se integra la política separadamente por otro PR/backport, revalidar la adopción;
las actualizaciones LP siguen retenidas por cambio de hashes y nunca se activan
por el siguiente push ordinario. Push de otra funcionalidad no publica LP pendiente.
Un push mezclado con cambios LP queda retenido; el siguiente push ordinario publica
el resto de main con LP anterior, sin perder los cambios fuente del PR.

Programación/Ensamble/Empaque/ubicaciones existentes conservan scripts, contenedores,
app/config y APIs actuales en vía habitual. Solo se restaura la navegación de base
y se excluye el nuevo entrypoint LP de index del artefacto. No se aplica rollback
a main, no se borran módulos fuente ni se modifica Programación. Si main cambia
legítimamente esa navegación antes de integrar, revisar la base preservada y su
huella para evitar una regresión. No confundir preservación de semántica de main
con acreditación de la versión actualmente live, que sigue pendiente.

## Publicación exclusivamente por artefacto

Ambas acciones Firebase reciben `entryPoint` en runner.temp, nunca raíz del repo:

- habitual: sgp-ordinary/firebase.json → public/ generado por lista positiva;
- LP: lp-reviewed/firebase.json → public/ extraído del ZIP revisado.

Configuración habitual mantiene el destino por defecto del mismo proyecto, como
el workflow previo, sin inferir un sitio nuevo. LP exige site concreto verificado
por GET antes de usar su config. No hay funciones/rewrites ni SQL. Privados/tests/
docs/backend/deployment/históricos originales excluidos; vendor solo tres assets
públicos del build existente. El riesgo public='.' no se traslada al artefacto.

### Secuencia futura (cada ejecución requiere autorización pertinente)

1. **inspect**, desde main o la rama exacta183, con la cuenta ya configurada.
   Preparado con google-github-actions/auth, sin archivo de credenciales ni clave
   nueva; token OAuth efímero para autenticación normal de esa misma cuenta.
   GET sitio del proyecto, canal live, vínculo release→version, estadoFINALIZED,
   inventario paginado y configuración. No redirige, no reintenta ni usa otro rol
   ante403/401/404. Si la cuenta no permite esa lectura, detener; no ampliar IAM.
   No se afirma que esta API/identidad hayan sido probadas en Firebase aquí.
2. Responsable revisa metadatos/retención y vía de recuperación exacta. Inventario
   bruto queda privado/efímero en runner; solo IDs necesarios, recuentos y hashes
   de metadatos se guardan como artifact. No se exportan correos/tokens/rutas de
   archivos reales. Retener evidencia privada conforme a la custodia autorizada.
3. Con aprobación funcional y técnica, futuro cambio de política: mode=visual,
   hosting_certified=true, referencia de certificación y baseline_version /
   rollback_version completos del sitio acreditado, hashes exactos de los archivos
   PROTECTED del gate. Esta entrega **no rellena** esos campos ni inventa IDs.
   El push de ese cambio NO despliega. Policy/razón de dispatch son controles
   mecánicos y referencias de revisión, no sustitutos de autorización del dueño.
4. **prepare** sobre ese SHA: npm/SDK/verificación/tests; sello reproducible del
   commit y su fecha de referencia; ZIP + digest.json artifact `lp-visual-SHA`14d.
   No credencial ni Firebase. Revisar tests/CI, contenido, destinos y hash externo;
   no asumir que reconstruir un ZIP de otro run conserva su hash.
5. **publish** sobre el mismo SHA/ref aprobado. Inputs: source_sha completo,
   artifact_run_id de prepare, ZIP SHA256 revisado, expected_live_version idéntico
   a baseline_version certificada y referencia explícita de autorización.
   Descarga solo artifact de ese SHA en este repo; valida pin, inventario y cada
   hash, bootstrap visual, rechazo RPC/HTTP y equivalencia de bytes al source/SDK.
   Un ZIP auto-consistente pero incompleto o de otro commit se rechaza antes de
   cuenta/Firebase. No se publica una reconstrucción distinta del ZIP revisado.
6. GET Hosting verifica sitio/canal/versión actual y coincide con expected_live.
   Cambios concurrentes/lectura fallida => no deploy. Acción existente publica solo
   lp-reviewed/public. Compartimos `firebase-hosting-live` para serializar estas
   ejecuciones y los pushes habituales. La validación read-only de PR usa un grupo
   separado por número de PR, para no ocupar la cola live. Congelar otros publicadores externos al
   workflow durante la ventana: no hay CAS global que impida un operador externo
   entre GET y deploy. Ese riesgo no se oculta con un flag local.
7. GET posterior comprueba versión nueva/inventario de rutas exacto; Hosting hashes
   se registran como metadatos, no se comparan con bytes descomprimidos sin contrato.
   La versión anterior debe seguirFINALIZED con igual inventario/config API.
   Se conservan resúmenes before/after; falta de retención/postcheck falla la tarea
   y requiere intervención, no rollback implícito. Validación pública final de
   auth, PC/móvil, recursos/cache y cinco tabs sigue siendo indispensable.

El permiso GitHub `actions:read` se limita al job controlado para descargar artifacts
anteriores con el GITHUB_TOKEN existente. No se modifican permisos reales ahora,
no id-token:write ni nuevas credenciales/entornos. La cuenta de Firebase es la
misma de publicación ya configurada; no se usa otra más privilegiada para sortear
el403 histórico. Cambiar a otra cuenta, sitio o proyecto queda fuera de alcance.
Los dispatch manuales anteriores sin operation ahora preparan, no publican.

## Continuidad de publicaciones posteriores

Tras certificar/publicar visual, los pushes no LP continúan por la vía visual
readonly con LP congelado por huellas y el SGP actualizado desde main. Capturan
su versión anterior en cada run, no dependen para siempre del ID del primer LP.
Si se necesita recuperar una versión anterior diferente, revisar y fijar su ID en
rollback_version antes del dispatch específico. Ese cambio de política también
retiene publicación automática. No se deduce el destino del último workflow.
El gate no sustituye revisión de todo cambio de main ni protege contra un autor
con permiso para reescribir arbitrariamente workflow/política.

## Recuperación preparada, nunca ejecutada

**recover** necesita policy certificada y sourceSHA, razón, expected_live_version
actual y rollback_version igual al ID acreditado por política. Relee currentlive,
comprueba la versión destino retenidaFINALIZED y vuelve a comprobar live justo
antes del POST. Solo después, en esa ejecución autorizada futura, crea release
sobre **la misma versión inmutable** existente: no crea una versión reconstruida
ni sube archivos de Git. Postcheck exige que el ID destino quede activo.
Congelar otros publicadores externos también durante recuperación.

Esto es restauración exacta **solo si** la lectura y evidencia confirman esa
versión/retención/configuración. Actualmente IDs nulos: recuperación BLOQUEADA.
4b1e98e y su reconstrucción siguen siendo candidatos, jamás se seleccionan como
live o rollback por defecto. Si la versión fue eliminada y no existe ZIP exacto,
detener. Alternativa de reconstrucción funcional requiere aprobación separada,
no llamarla rollback exacto. No SQL, datos/roles/saldos por recuperar frontend.

## Pruebas locales nuevas y límites

- `python tests/lp01-publish/policy.py`:7 grupos PASS: adopción/pushes/ramas lógicas,
  política/huellas, modo bloqueado, YAML y entradas a acciones. Transporte REST
  **sintético** verifica solo algoritmoGET y rechazo de recuperación obsoleta;
  no certifica API real, cuenta, permisos, versión o rollback de Firebase.
- `python tests/lp01-publish/artifact.py`:4 grupos PASS: build real de legacy/visual,
  SDK y app/config intactos, ZIP/pin/source exactos, inventario incompleto rechazado,
  sin privados/backend. Node/Git se ejecutan localmente, no Firebase.
- `python tests/lp01-publish/browser.py`:PC1440/móvil390 PASS, arranqueapp y cero404
  JS/CSS, cuatro pestañas habituales, sin arranque/RPC LP ni errores. Auth/datos
  reales no certificados; red externa bloqueada. UI LP cinco tabs previamente
  aprobada reutilizada, no se repite su batería.
- Gate CLI real con evento local simulado: primera adopciónHOLD. Python AST/YAML,
  rutas de scripts y verify:releaseLAB380 PASS. Cero dispatch/Firebase/credenciales.

CI de basebb7d052 observado4/4PASS (41685329268,41685329285,41685329683,41685329355).
El job validate usa Python3.12/PyYAML6.0.2 y no recibe secretos; los PR ejecutan
solo ese job. CI nueva se consulta tras push; no se atribuye la anterior al nuevo código.
No se ejecuta batería general manual ni auditorías PDT/Export/apertura.

**Estado final:** procedimiento preparado para revisión, publicación/recuperación
LP BLOQUEADAS hasta lectura autorizada y certificación. Próxima acción: revisar el
workflow y autorizar, si procede, **solo inspect** con la misma cuenta existente;
no ejecutar publicación para obtener evidencia ni cambiar permisos para probar.
