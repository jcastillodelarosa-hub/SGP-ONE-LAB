---
name: design-engineering
description: Guide SGP_ONE UI/UX decisions using original SGP standards and selected principles inspired by Emil Kowalski's public design engineering skills.
---

# SGP Design Engineering — guía documental

## Origen y alcance
Guía ORIGINAL adaptada para SGP_ONE, **inspirada** en las skills públicas de Emil Kowalski (https://github.com/emilkowalski/skills); **no es una copia ni una instalación oficial** de sus skills. Referencias de consulta: `emil-design-eng`, `animate`, `review-animations`, `mobile-native`, `prototype`, `break-ui`. Consultar fuentes originales y sus licencias antes de reutilizar texto o código. Esta skill no concede autorización para editar, instalar dependencias, desplegar o alterar bases de datos.

## Cuándo consultar
Cuando se soliciten cambios de diseño, tablas dinámicas, transiciones, navegación lateral, modales, experiencia táctil, Ensamble, Empaque, Programación, Picking o vistas responsivas. Para tareas solo de datos o backend, no forzar rediseño.

## Preflight obligatorio
1. Leer `SGP_ONE_MASTER_CONTEXT.md`, `SGP_ONE_ESTADO_ACTUAL.md`, `SGP_ONE_CHECKPOINT.md`, `.agents/skills/orchestrator/SKILL.md` y `.agents/skills/continuity/SKILL.md` desde main.
2. Revisar código CSS/HTML/JS actual y PR abiertos/fusionados; confirmar necesidades no resueltas y dependencias con autenticación, roles, RPC y estados.
3. Distinguir **propuesta**, **prototipo independiente**, **cambio autorizado**, **fusionado**, **desplegado** y **verificado**. No editar la aplicación sin autorización explícita.


## Norma global obligatoria — Design System v1
Antes de diseñar o cambiar cualquier interfaz de SGP_ONE, leer `SGP_ONE_DESIGN_SYSTEM.md` desde GitHub `main` y aplicar sus tokens, componentes, flujo de aprobación y pruebas. Es una norma de apariencia GLOBAL, no por módulo; el Centro de Diseño de Configuración está propuesto, NO implementado. Si la norma y el código vigente discrepan, auditar y reportar antes de intervenir. Reutilizar componentes existentes; no introducir estilos paralelos ni modificar estados de negocio, permisos o persistencia por una decisión estética. Los valores visuales del documento son baseline sujeto a validación, no evidencia de despliegue.

## Principios aplicados a SGP
- **Claridad primero:** prioridades, reservas, partes, producciones, estados y cantidades visibles y legibles. No ocultar información operacional crítica tras animaciones.
- **Azul SGP:** respetar paleta azul existente, contrastes accesibles, jerarquía clara, botones consistentes y estados semánticos ya definidos. No sustituir colores de negocio arbitrariamente.
- **Movimiento con propósito:** animar solo transiciones que expliquen navegación, expansión, reordenación o confirmación; preferir transform/opacity y duraciones breves, sin efectos que ralenticen el trabajo. Respetar `prefers-reduced-motion`.
- **Móvil real:** navegación y scroll táctil, safe areas, objetivos táctiles cómodos, evitar hover obligatorio, modales desplazables, teclado visible, formularios utilizables y pruebas en dispositivo físico.
- **Tablas de Ensamble/Empaque:** ordenar con niveles y dirección explícita; filtros combinables; prioridades reordenables con alternativa accesible; columnas y encabezados alineados; comentarios y estados de Mecanizado/Ensamble/Empaque sin perder trazabilidad. En móvil, tarjetas o tabla desplazable según tarea, nunca truncar silenciosamente datos críticos.
- **Rendimiento:** minimizar re-renderizados y animaciones costosas; virtualización solo tras medir y sin romper selección, scroll o accesibilidad. No añadir bibliotecas sin evaluar tamaño, mantenimiento, permisos corporativos y compatibilidad.
- **Pruebas de estrés visual:** nombres largos, muchas órdenes, cantidades grandes, vacíos, errores de red, múltiples sistemas, reservas compartidas, permisos diferentes, zoom, pantallas pequeñas y scroll dentro de modales.

## Flujo recomendado
1. Auditar la vista actual y proponer objetivos medibles.
2. Preparar bocetos o prototipo aislado si hay cambios grandes, sin afectar producción.
3. Comparar alternativas en PC y móvil; pedir aprobación del diseño antes de cambiar flujos sensibles.
4. Implementar solo tras autorización, en el alcance indicado, con pruebas de regresión y accesibilidad.
5. Registrar evidencia en Continuity y checkpoint; no equiparar CI verde con despliegue o aceptación real.

## Referencias externas (no incorporadas como dependencias)
- https://github.com/emilkowalski/skills
- https://www.skills.sh/emilkowalski/skills/animate
- https://www.skills.sh/emilkowalski/skills/mobile-native

## Salida requerida
Diagnóstico actual, decisiones visuales, archivos afectados (si los hay), compatibilidad móvil, riesgos de regresión, pruebas realizadas/no realizadas, estado documental y siguiente paso.
