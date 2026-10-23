# SGP_ONE — Verificación del Centro de Diseño (PR #57)

Estado: **pendiente de ejecución en navegador autenticado**. Este documento no equivale a una prueba superada.

## Alcance
Archivos: `index.html`, `design-center.js`, `design-center.css`, `favicon-sgp.svg`.
Sin modificaciones de Supabase, permisos, producción, recepción, picking ni Firebase.

## Pruebas de escritorio
- [ ] Iniciar sesión con usuario que tenga acceso a Configuración.
- [ ] Abrir Configuración > Centro de Diseño sin perder otras pestañas.
- [ ] Comprobar que las opciones de Usuarios, Roles y Alertas conservan su funcionamiento.
- [ ] Seleccionar tema azul corporativo y menú contraíble; guardar y recargar.
- [ ] Confirmar persistencia local y ausencia de cambios para otro navegador.
- [ ] Cambiar icono de Programación; verificar que la navegación conserva su acción y accesibilidad.
- [ ] Restaurar preferencias y comprobar el resultado tras recarga.
- [ ] Exportar JSON y validar su estructura sin datos sensibles.
- [ ] Verificar que el favicon SGP se muestra y no hay errores en consola.
- [ ] Probar con cuenta sin acceso a Configuración: no debe aparecer acceso adicional.

## Pruebas móviles
- [ ] Abrir/cerrar menú lateral por toque, sin depender de hover.
- [ ] Cambiar pestañas y opciones sin desbordamiento horizontal.
- [ ] Confirmar botones, campos y tarjetas legibles a 360px y 390px.
- [ ] Comprobar foco, lectura de iconos y preferencia de movimiento reducido.

## Regresiones críticas
- [ ] Login/logout.
- [ ] Mecanizado > Recepción: filtro por semana, búsqueda y auditoría con rol autorizado.
- [ ] Programación y arrastre de pendientes entre turnos.
- [ ] Picking exclusivamente PANEL y reservas múltiples/compartidas.
- [ ] Ensamble/Empaque: estados y observaciones.
- [ ] Informes y carga semanal.

## Criterios de liberación
1. Validación en PC y móvil con evidencia.
2. Sin regresiones ni errores de consola.
3. Confirmación del alcance por responsable.
4. Solo después, autorización expresa para fusionar PR y desplegar.
