# Preparación de integración al SGP principal — revisión final

Base7faa136, PR183 Draft. No sitio independiente/canal temporal: propuestas
anteriores quedan sustituidas por este plan. Sin merge, publicación Firebase, SQL ni cambios
productivos. **Preparado para revisión; publicación bloqueada hasta verificar
versión activa/recuperación y aprobar el artefacto exacto.**

## Matriz funcional y visual

| Área | Evidencia válida | Resultado / clasificación |
|---|---|---|
| Programación | Código módulos/calendar/workspace intacto; regresión2PASS; cinco tabs PC/móvil | Navegación preservada. Datos y acciones reales requieren sesión/contratos actuales, no probados con cuentas productivas |
| Seguimiento | Capturas cinco tabs anteriores + artefacto SGP completo1440/390 | Contexto/estados/prioridades sintéticos explícitos. No mezcla datos LP reales |
| Ensamble/Empaque | Una instancia LP, etapas/títulos separados, detalles e informes; snapshots congelados | Consulta visualPASS. Avances/importación/cierre/reapertura deshabilitados; no backend LP |
| Ubicaciones | Contenedor/handler/tabla legacy intactos, captura5; prueba de navegación | No se sustituye fuente vigente. Datos y sesión reales no certificados por fixture |
| B10/B11/B13/B14 | Tarjetas/filtros/afectaciones/etapas comparadas | Menor densidad, UUID completos y agrupación distinta: mejoras visuales, no conceden permisos ni bloquean demo identificada |
| B12/B15 | Detalle y cierre versionado existente | Composición integrada/descargas parciales: diferencia documentada. Sin guardado en modo visual |
| B16 | NC agregadas | Sin lista de piezas PANEL: funcionalidad pendiente, no simularla. B17 no aprobado |
| Aislamiento |3unitarias nuevas; adaptador visual no obtiene cliente real ni transmite token | Bloquea toda RPC salvo lectura de una muestra local exacta, fuerza writes=false/CONSULTA |
| Auth/rutas/recursos | app.js/config/index completos preservados, red externa bloqueada en prueba | Sesión anfitriona usada solo como puerta visual; no autoriza backend. Autenticación real sigue pendiente |

No se crean pestañas duplicadas ni se reemplazan Programación/ubicaciones. No
trabajo nuevo en Vidrio/Dashboard/Tabla/Kanban. Las capturas principales anteriores
se conservan en tests/lp01-demo/evidence/tab1–5. Nuevas capturas en evidence/ usan
**el SGP completo**, sin la portada/bootstrap independiente demo.js.

## Qué se publicaría, únicamente tras autorización

**Artefacto preparado:** `/tmp/sgp-lp183-main-visual`,90 archivos frontend de la
rama revisada + snapshot sintético local y manifiesto SHA256. No el repositorio
entero ni `/tmp/sgp-lp183-preview` anterior. Preparación reproducible sin SQL:

`python scripts/prepare-lp-main-visual.py`

Conserva index/app/config de SGP y los módulos actuales. Única transformación de
bootstrap en el artefacto: LP monta visualLPBridge y muestra banner permanente;
no cambia el SGPPlannerBridge global. Programación/ubicaciones mantienen su
cliente/sesión originales. Fuente propuesta y fuente operativa no se mezclan.
El código tracked de bootstrap operativo del PR no es por sí solo este release:
**no usar despliegue normal del repo ni activar backend por publicar UI.**

Snapshot QA versionado (sin identidades reales), fecha01/11/2026 T1 PANELES_2,
role forzadoCONSULTA y writes=false. Cambiar fecha/línea devuelve aviso de muestra
no disponible. Sin token anfitrión devuelve acceso visual no disponible; nunca se
manda ese token al snapshot ni a RPC LP. Este gate cliente no reemplaza la
seguridad/autenticación SGP y no protege información sensible: la muestra es
pública y sintética. No hay SQL01–08, permisos nuevos, endpoint o identidad técnica.

Se corrigió durante preparación una omisión de dependencias services/ui/config/data:
el navegador ahora exige arranque real de app.js y cero404JS/CSS, además de capturas.
Selección positiva de assets: excluye private/tests/docs/supabase/server/scripts,
originales XLSX, entradas de ámbitos y cualquier archivo untracked salvo vendor
público generado explícitamente. app/config conservados byte a byte, sin imprimir
sus valores. El hosting actual usa public='.' y no excluye private/: **riesgo
bloqueante si se usa ese mecanismo sin corregir la selección de publicación**.
Esta entrega no modifica su configuración ni publica para comprobarlo.

Antes de aprobar: sellar ZIP/manifiesto con SHA256 y commit final; config de hosting
separada de preparación apuntando solo a ese directorio, mismo sitio principal,
sin rewrites/Functions/SQL; verificar no rutas privadas. No sitios ni canales nuevos.
Cache existente JS/CSS/HTML no-store conservada; fetch de muestra cache:no-store,
versiones de assets actualizadas en7faa136. Comprobar recarga fría/caliente, pestañas
abiertas y posible service worker anterior antes de publicar; no borrar datos de
usuarios. Rutas y carga real del sitio aún requieren prueba controlada autorizada.

El workflow firebase-hosting se dispara al push a main y publica live: **merge y
publicación no son pasos independientes en ese workflow**. No fusionar para
"probar". Cualquier futura publicación debe especificar commit/ZIP/config/sitio
y mecanismo revisado; no ejecutar workflow_dispatch ni alterar permisos ahora.

## Recuperación del frontend

Referencia observada: último despliegue exitoso en página acotada de GitHub,
[run41514147768](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/41514147768),
commit **4b1e98e37fdd9f615266c963088c8d1313b51266**. Esto no prueba que siga live.
Consulta pública release-info.json: HTTP403; no se reintenta ni se sortea.

`python scripts/prepare-lp-rollback.py` reconstruye frontend fuente local en
`/tmp/sgp-lp183-rollback-candidate`, con manifiesto y validación de dependencias /
script de vendor antes de copiar SDK. **No es copia de BD ni respaldo productivo**.
[Resultado](evidence/rollback.json). Es un candidato restaurable por fuente, no
certificación de bytes idénticos al despliegue anterior. Antes de publicar es
indispensable identificar release/version activa de Firebase y conservar el
artefacto exacto anterior (incluyendo vendor/release-info generados) y su SHA256.
No asumir que main, una etiqueta o el último run equivalen a producción.

Procedimiento posterior autorizado:

1. Responsable hosting registra release/version activa, sitio, commit y hashes;
   conserva artefacto anterior validado y manifiesto. Si no coincide con candidato,
   recuperar esa versión exacta; no reemplazarla por inferencia.
2. Ensayar restauración **local** de ese artefacto: index/app/config/SDK/rutas,
   autenticación, Programación/ubicaciones, menú PC/móvil; ningún SQL necesario.
3. Publicar únicamente release visual sellada, con autorización expresa y responsable
   de recuperación disponible. No backend LP ni migración en el mismo acto.
4. Si falla carga/auth, funciones existentes, mezcla de datos, cualquier llamada LP
   productiva o exposición privada: detener validación y restablecer release anterior
   mediante rollback de Hosting a versión identificada o publicar su artefacto exacto.
5. Validar hashes/release-info, recarga fría/caliente, login y permisos existentes,
   menú, Programación/ubicaciones, consola y red en PC/móvil. No revertir SQL, saldos,
   usuarios o datos para recuperar frontend; no limpiar históricos ni sesiones por inferencia.

## Evidencias, CI y bloqueos restantes

Base7faa136 **4/4 CI completada PASS**, incluida LP41676964425. No se reejecuta
batería general manual. Cambios nuevos justifican3unitarias de puente visual,
21regresiones tabs/Programación PASS y navegador nuevo PC/móvil del artefacto
completo; muestras de sesión son sintéticas. [Resultados](evidence/).
Los tests de operaciones backend previos se reutilizan, sin atribuirles conexión
productiva ni autenticación real del nuevo artefacto.

Bloqueos para aprobación de publicación: release activa/rollback exacto no
acreditados (HTTP403); revisión de selección de assets y mecanismo live específico;
aceptación funcional de diferencias; checks del nuevo HEAD por confirmar tras push.
Datos y cuentas reales no se requieren para preparar este modo visual, pero sí
para habilitar operación real en otro encargo. PDT/Export permanecen bloqueados
exclusivamente en fuente. No solicitar nueva aprobación de bocetos ya decididos.

**Siguiente acción:** revisión final de este artefacto/plan y obtener evidencia
acotada de versión activa/artefacto de recuperación mediante responsable hosting.
No se solicita todavía ejecución productiva con un rollback sin certificar.

Diff específico2127eff→7faa136 revisado: index2/2 líneas de versiones, navegación26/15, followup1/1(import), operación2/0(contexto). app.js sin cambio en esa integración. Diff acumulado contra base main sí contiene9/7 líneas app.js de entregas anteriores: no confundir preservación de esta entrega con equivalencia byte a byte al main/despliegue anterior. El manifiesto y revisión final deben cubrir ese acumulado.
