# SGP_ONE — instrucciones de ejecución

## Regla principal
**Primero mostrar resultados, después perfeccionar.**
Necesidad funcional → implementación → demostración visible → correcciones → cierre.
Entregar el primer resultado funcional seguro cuanto antes. No iniciar auditorías
generales por defecto, refactorizaciones ajenas ni nuevas Skills innecesarias.
Reutilizar evidencia válida; repetir pruebas solo cuando el cambio pueda invalidarlas.
Resolver errores técnicos internos autónomamente dentro del alcance autorizado.
Informes breves: resultado, cómo probar, commit y bloqueos reales.

## Riesgo y autorización
- **CRÍTICO:** pérdida/corrupción de datos, vulnerabilidad grave, autorización
  incorrecta, regresión severa o función principal inoperable. Bloquea la operación afectada.
- **IMPORTANTE:** defecto funcional delimitado; corregir dentro del encargo.
- **MENOR:** mejora visual, optimización, refactor o defecto previo no bloqueante;
  registrar sin retrasar la demostración.
Una demostración aislada puede avanzar mientras producción siga bloqueada.
No presentar mocks, fixtures, CI verde o implementación en rama como verificación productiva.
Diagnóstico/auditoría son solo lectura. Las Skills no conceden permisos.
Aplicar SQL productivo, fusionar, desplegar, usar infraestructura externa/costosa o
publicar requieren autorización expresa y controles proporcionales al riesgo.

## Arquitectura y continuidad
Este repositorio es **SGP-ONE-LAB**: frontend web, Supabase backend principal y
Firebase Hosting operativo. **SGP_ONE_GOOGLE** es un proyecto separado de gateway;
**LAC-DASHBOARD** es otro producto. No intervenirlos desde este encargo.
Al iniciar una sesión leer `SGP_ONE_MASTER_CONTEXT.md`, el último hito pertinente de
`SGP_ONE_ESTADO_ACTUAL.md` y `SGP_ONE_CHECKPOINT.md`. Confirmar rama/HEAD/estado local
y PR pertinente antes de desarrollar para evitar duplicaciones. No repetir esa
recuperación completa en cada ajuste; verificar solo diferencias que invaliden evidencia.
Si la API no está disponible, registrar la limitación; no inventar estado de PR ni duplicarlos.
Historial y etiquetas de versión no prueban estado actual. Conservar cambios locales.

## Skills y reglas de negocio
Consultar únicamente las Skills relevantes en `.agents/skills/*/SKILL.md`:
orchestrator/continuity para alcance y continuidad; database-rpc/security-auth para
RPC y permisos; business-rules para contratos; testing-qa para pruebas proporcionales;
design-engineering para interfaz; audit solo cuando se solicite o exista riesgo concreto;
deployment para publicación autorizada; gateway solo en su frontera de integración.
Leer una Skill no demuestra activación nativa. Mantener nombres/responsabilidades.
Preservar reserva principal, PANEL, estados, identidad y cantidades originales,
trazabilidad y separación LEGACY/V2; no ampliar roles ni desactivar RLS como atajo.
No modificar Supabase/Firebase productivos por preparar una demo.

## Validación y entrega
Ejecutar pruebas que cubran el cambio y su riesgo; reutilizar las anteriores no
invalidadas. Para demos: recorrido real visible, aislamiento, errores y PC/móvil.
Consultar `package.json` para comandos reales; `npm test` y `npm run verify:release`
según el alcance. No repetir toda la batería SQL por cambios documentales.
Antes de commit/push autorizado: diff, secretos, `git diff --check` y disparadores
de workflows; nunca inferir que una rama evita despliegues sin revisar configuración.
Entregar estados separados: PROPUESTO / IMPLEMENTADO EN RAMA / FUSIONADO /
APLICADO EN SUPABASE / PUBLICADO / VERIFICADO. Guardar un checkpoint útil por entrega,
no un informe por corrección menor. Esta metodología orienta tareas futuras de
GOOGLE y LAC sin modificar sus repositorios ni ampliar autorizaciones.
