# Certificación Hosting y recuperación — dictamen BLOQUEADO

2026-11-03, America/Bogota. Base64d91e2, mismo Draft183.
**No PUBLICADO. Cero acciones de Firebase, nuevos sitios/canales o cambios de permisos.**

## Identidad que realmente se pudo acreditar

| Campo | Estado / evidencia |
|---|---|
| Proyecto esperado `sgp-one-lab` | Configuración local `.firebaserc`; no equivale a consulta de proyecto activo |
| Sitio esperado `sgp-one-lab` | Candidato del plan; no acreditado mediante Hosting |
| Canal live | Canal que debe inspeccionarse; no leído en esta sesión |
| Release activa | **NO DISPONIBLE** |
| Versión activa | **NO DISPONIBLE** |
| Artefacto/recuperación exactos | **NO CERTIFICADOS** |

Revisión de mecanismos autorizados disponibles: herramientas conectadas no ofrecen
Firebase Hosting. Runtime observado running/current, sin secrets, variables de
identidad, outbound identities o capacidades configuradas; Firebase CLI y gcloud
no instalados, sin selector ADC ni manifiesto de identidad enlazados. No se leen
almacenes de tokens, claves, secretos de CI ni cuentas humanas. Instalar CLI no
resolvería la falta de una identidad autorizada, por lo que no se hace para intentar
acceso sin autorización. No se invocan APIs de Hosting anónimamente.

El HTTP403 anterior de release-info.json se conserva como evidencia histórica;
**no se volvió a solicitar ni se probó otro dominio, proxy, usuario o credencial**.
No puede determinarse aquí si aquel403 procede del origen o del transporte. No
se presenta como respuesta de la API de metadatos de Firebase.

Último despliegue exitoso observado, run41514147768 / commit4b1e98e, sigue siendo
solo candidato histórico. `main`, ese workflow y el frontend reconstruido no
acreditan versión activa. Nada de esta entrega aumenta ese estado de evidencia.

## Intervención autorizada necesaria, sin entregar secretos

Responsable Hosting con acceso de lectura **ya autorizado** debe obtener, desde
su consola/API oficial habitual, una exportación de metadatos de proyecto/sitio,
canal live y su release/version realmente referenciadas. No se propone conceder
roles, usar una credencial más privilegiada ni evitar restricciones de acceso.
Si tampoco dispone de lectura, detener esa consulta y resolverla por el proceso
autorizado del propietario, no mediante este encargo.

Evidencia mínima para continuar: fecha/hora de lectura, recurso proyecto/sitio,
canal live, release y version names completos, estado de versión, fecha de release,
configuración de Hosting (headers/rewrites/redirects), inventario paginado completo
de archivos y hashes/metadatos de codificación, vínculo inequívoco release→version.
Una captura de un workflow o una etiqueta no sustituye esa relación.

Mecanismo propuesto para ese responsable: GET de recursos oficiales equivalentes
a sites.get/list, channels.get(live), releases.list/get y versions.get/listFiles.
Verificar firmas y permisos de la API/CLI vigente antes de usarlos; esta lista es
un plan de lectura, no código autenticado ejecutado ni autorización de mutación.
No crear una release, clonar versión o activar canal para poder inspeccionarla.
Guardar exportaciones detalladas en custodia autorizada; no incluir tokens ni
identidades personales en Git/CI. La evidencia pública posterior debe limitarse
a IDs de recursos necesarios, huellas y conclusiones verificadas.

## Recuperabilidad exacta y alternativas

No se observó artefacto exacto asociado a una versión activa: faltan sus metadatos
y una fuente de bytes/configuración acreditada. La API de listado de archivos no
se asume equivalente a una descarga ZIP de la release. Tampoco se compara ciegamente
un hash de archivo comprimido de Hosting con bytes servidos descomprimidos.

Vías posibles, **condicionadas a evidencia**, sin ejecutarlas ahora:

1. **Artefacto original retenido:** recuperar inventario/bytes generados y config
   de esa versión, incluidos vendor y release-info; documentar algoritmo,
   codificación y hashes. Verificar manifiesto completo, ausencia de faltantes y
   vínculo a release/version activa antes de sellar ZIP. No sustituir recursos
   por builds de otra fecha.
2. **Versión inmutable retenida en Hosting:** si la lectura confirma su ID exacto,
   estado restaurable y configuración/archivos, preparar futura recuperación
   referenciando esa misma versión en una nueva release autorizada. Esto puede
   evitar reconstruir bytes desde Git. Es una mutación futura, no realizada ni
   declarada disponible por esta entrega; validar retención y método oficial.
3. **Solo Git disponible:** candidato local4b1e98e con SDK/dependencias coincidentes
   puede servir como reconstrucción funcional, pero **no rollback exacto**.
   Requiere validación local, comparación explícita de diferencias y aceptación
   funcional separada como nueva release de recuperación. No etiquetarlo como
   versión anterior certificada. Si la recuperación exacta es requisito, seguir
   BLOQUEADO hasta disponer de1o2.

## Publicación explícita preparada localmente

`python scripts/prepare-lp-hosting-plan.py ZIP SHA256 DIRECTORIO_NUEVO`

Solo biblioteca estándar, sin red, subprocess, SDK ni login. Verifica pin externo
SHA256 del ZIP sellado, inventario/hash de cada archivo, modo visual y protecciones
de bootstrap/RPC/XLSX. Rechaza duplicados, traversal, symlinks, dotfiles, servidores,
JSON ajeno, archivos fuera de manifiesto, límites y destino existente. No usa el
repo como raíz pública ni incorpora private, tests, SQL, originales o snapshots
reales. Validación contra ZIP preparado en64d91e2:90 archivos comprobados.

Resultado local `/tmp/sgp-lp183-explicit-publish-review`:

- `public/`: **únicamente** frontend visual sellado validado.
- `firebase.review.json`: sitio candidato y public=`public`, headers no-store,
  sin rewrites/funciones/backend, sin sitios/canales nuevos.
- `plan.json`: proyecto/sitio **no verificados**, IDs live nulos, rollback_exact=false,
  deploy_command=null, estado BLOQUEADO y acciones de red0.

El plan contiene una lista informativa del comando CLI de publicación futura para
revisión, **jamás ejecutada**. La config no es autorización ni acredita que el sitio
candidato sea el correcto. Reemitir plan únicamente tras verificar metadatos y
sellar aprobación del artefacto/sitio/recuperación. No sobrescribe un plan anterior.

Riesgo public='.' del workflow actual controlado por raíz positiva separada.
No modificar ni ejecutar el workflow automático de main: merge/pushmain dispara
publicación live. Propuesta futura: operador autorizado publica desde este
directorio/config explícitos en el mismo sitio acreditado, sin fusionar como
mecanismo de publicación y sin usar workflows históricos ajenos. Antes de ese
acto: reconciliar contenido con main, validar recursos/config/cache, confirmar
credencial habitual autorizada y obtener autorización expresa de publicación.

## Recuperación y comprobaciones posteriores propuestas

Antes de eventual despliegue: registrar release/version actualmente live, demostrar
vía1o2 restaurable o aceptar explícitamente alternativa3; custodiar inventario,
config y hashes; responsable de recuperación disponible. No proceder si falla
lectura, retención o correspondencia. No SQL ni respaldos de BD por frontend.

Tras eventual publicación autorizada: comprobar release/version nueva y origen,
manifest/hashes, headers/config/cache (fría/caliente), JS/CSS sin404, arranque app,
sesión/login/logout y permisos actuales, cinco tabs PC/móvil/teclado, Programación
y ubicaciones, banner sintético y rechazo de toda operación LP. Revisar consola/red:
ninguna llamada LP productiva ni exposición de rutas privadas. No probar escrituras
productivas para demostrar aislamiento.

Rollback si falla carga/auth/funciones actuales, mezcla de datos, llamada LP real,
rutas privadas o identidad de release: detener validación y restaurar la versión
previamente acreditada por el mecanismo aprobado. Confirmar identidad/hash/headers,
login y funciones anteriores PC/móvil y notificar estado. Si solo hay reconstrucción
Git, no ejecutar un "rollback" supuesto; aplicar la alternativa aceptada con su
propia aprobación. No revertir usuarios, SQL, datos ni saldos al recuperar frontend.

## Pruebas y continuidad

CI64d91e2 observado **4/4 completada PASS**: Tests41679963965,
sintaxis41679963986, diseño41679963978, LP41679964020. Se reutilizan capturas,
unitarias y regresiones anteriores. Solo nuevas pruebas offline:
`python tests/lp01-hosting/offline.py`, **6 grupos PASS**;
[evidencia](evidence/offline.json). No prueba API/autenticación/versiones Hosting.
El archivo ZIP de entrada debe existir localmente con su hash sellado; si no,
recuperarlo por canal autorizado o reconstruir/revisar/sellar una nueva propuesta,
no alterar el pin para hacer pasar una entrada distinta.

**Dictamen: BLOQUEADO en certificación Hosting y rollback exacto.** Preparación
local de publicación y pruebas terminadas. Próxima acción: responsable Hosting
aporta la lectura acreditada y vía de recuperación disponible, sin secretos.
No se solicita autorización de despliegue mientras esos campos sigan sin evidencia.
