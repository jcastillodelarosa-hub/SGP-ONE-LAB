# SGP_ONE — DESIGN SYSTEM v1
Fecha de aprobación documental: 2026-10-22
Estado: NORMA DOCUMENTAL APROBADA; IMPLEMENTACIÓN VISUAL PENDIENTE
Repositorio: jcastillodelarosa-hub/SGP-ONE-LAB | Rama: main

## 1. Decisión y alcance
SGP_ONE está en construcción. Toda interfaz nueva o modificada deberá alinearse a un único lenguaje visual global, independientemente del chat o desarrollador que la implemente. El Centro de Diseño previsto en Configuración administrará únicamente la apariencia GLOBAL; no se permitirán temas visuales distintos por módulo. Esta norma no implica que el Centro de Diseño ya exista ni que los componentes estén implementados.

## 2. Autoridad y continuidad
Antes de intervenir UI, consultar en main: SGP_ONE_CHECKPOINT.md, SGP_ONE_MASTER_CONTEXT.md, SGP_ONE_ESTADO_ACTUAL.md, este documento, .agents/skills/orchestrator/SKILL.md, .agents/skills/continuity/SKILL.md y .agents/skills/design-engineering/SKILL.md; después inspeccionar el código real y PR relevantes. Si código y documentos discrepan, informar y reconciliar antes de modificar. No reutilizar versiones históricas como versión publicada.

## 3. Tokens visuales objetivo (propuestos, sujetos a validación en prototipo)
- Fuente oficial objetivo: Inter; fallback system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif. Verificar carga y disponibilidad en red corporativa antes de integrarla.
- Azul primario: #103B73; azul de acción: #1264C8; tinta: #0B2442; superficie azul suave: #EAF2FB; fondo: #F7F9FC.
- Texto operativo: 14 px como referencia; títulos de módulo 24–28 px; encabezados de tabla 12–13 px. Confirmar legibilidad y zoom en pruebas.
- Controles: botones 40–44 px, campos 42–44 px, objetivos táctiles adecuados. Radios de controles 8 px y tarjetas 12–16 px como referencia.
- Transiciones: 120–220 ms solo para navegación, expansión, reordenación y confirmaciones; respetar prefers-reduced-motion.
- Los colores de estado funcional no se derivan de la paleta decorativa y no se modifican por temas.

Estos valores constituyen baseline de diseño para prototipos y componentes futuros; no certifican contraste, accesibilidad ni adopción en producción.

## 4. Contrato de componentes globales
Usar patrones y tokens compartidos para: encabezados y navegación; botones primario/secundario/destructivo; inputs/selectores y validaciones; tablas (encabezados alineados, densidad, orden multinivel, filtros combinables, estados vacíos); tarjetas e indicadores; diálogos (cierre visible, scroll interno, acciones accesibles); notificaciones; etiquetas de estado y comentarios. No añadir estilos aislados por módulo si existe un componente global reutilizable. Excepciones justificadas y documentadas, sin romper identidad global.

## 5. Centro de Diseño en Configuración (POR IMPLEMENTAR)
Permitir vista previa, ajuste y restauración de apariencia global: paleta aprobada, tipografía y escala, densidad de tablas, tamaños y radios de controles, movimiento, modales y navegación. Separar configuración corporativa administrada por rol autorizado de preferencias personales permitidas. Definir persistencia y permisos después de auditar esquema/autenticación; no crear tablas/RPC ni alterar Supabase sin autorización explícita. Ningún ajuste de apariencia puede cambiar reglas de negocio, estados ni permisos.

## 6. Reglas funcionales inalterables
Mantener CORTE → MECANIZADO → PROCESADO y estados de Picking, trazabilidad por producción/orden/sistema, pendientes del turno, reservas múltiples frente a compartidas, reserva principal (primera reserva en reserva_al propietaria de unidades), Picking exclusivo de PANEL, NC/novedades/reservas solución, validación de recepción y autorización por rol. La reconstrucción es VISUAL; cambios funcionales requieren aprobación independiente.

## 7. Flujo obligatorio para cualquier chat
1. Recuperar documentación y HEAD real de main; comprobar PR abiertos/fusionados.
2. Auditar módulo, componentes existentes, dependencias, roles y riesgos.
3. Proponer reutilización de tokens/componentes oficiales y variante PC/móvil.
4. Preparar prototipo aislado cuando el cambio sea amplio y solicitar aprobación.
5. Implementar exclusivamente alcance autorizado; evitar CSS paralelo y duplicaciones.
6. Ejecutar pruebas de regresión, accesibilidad, rendimiento, scroll y roles.
7. Reportar PROPUESTO / IMPLEMENTADO / FUSIONADO / PUBLICADO / VERIFICADO con evidencia separada.
8. Actualizar checkpoint en hitos solo con autorización documental.

## 8. Migración gradual
Orden recomendado: fundamentos globales y Centro de Diseño; Portada; Ensamble y Empaque; Programación; Producción y Picking; Recepción y Pendientes; Informes y restantes. Cada migración deberá preservar operación y permitir reversión. No realizar despliegues ni cambios en SGP_ONE_GOOGLE por esta norma.

## 9. Criterios mínimos de aceptación
Consistencia entre módulos, controles con foco visible, navegación teclado/táctil, PC y móvil, modales desplazables, estados semánticos preservados, tablas sin desalineación, textos largos, datos vacíos, errores de red, permisos, zoom y preferencia de movimiento reducido. La publicación no sustituye la prueba funcional.

## 10. Estado
Documento normativo versionado. No implementa CSS/JS, Centro de Diseño, cambios de base de datos ni despliegue. Próximo paso: prototipo independiente del Centro de Diseño y catálogo de componentes para aprobación visual.
