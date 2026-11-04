# Corrección Seguimiento B08–B11

Base de rama35bb6ad (sucesor disponible). PR183 está fusionado; esta corrección
se prepara en su misma rama, sin crear PR, fusionar, publicar o tocar Supabase.

Referencias realmente examinadas: guía HTML original adjunta, SHA256d5905b56…,
imágenes embebidas B08–B11 y DOCX de alcance del01/11. B08/B09 fueron revisados
posteriormente; B10/B11 aceptados con ajustes: prevalecen sus precisiones y DOCX.
No está disponible el PDF completo SGP_DISENO_MAESTRO(1).pdf ni el chat19. Se
solicitó el PDF; no se afirma haberlo leído. La guía contiene sus cuatro páginas
de Seguimiento y permite implementar esos elementos observables. Lo que dependa
de contenido no recuperado del PDF queda pendiente, sin reinterpretarlo.

| Elemento original | Estado anterior / diferencia | Corrección delimitada |
|---|---|---|
| B08/B11 tabla de órdenes | Tarjetas genéricas; filtros ocultos | Tabla PC, tarjetas móviles, filtros propios de Seguimiento |
| B08 abiertas antiguas | Compartía bucket SALE del líder | Orden consultivo por abiertas/semana base y año Export; semanas conocidas primero; antigüedad LP entre filas sin metadatos |
| Dos saldos Export | Solo saldo de la etapa en resumen | Columnas separadas, sin descontar SALE/avance ni sumar filas repetidas por producción |
| SALE / ejecutado | Valores presentes pero sin columnas | Cuatro cantidades explícitas; Empaque usa sus etiquetas/estado propios |
| B10 afectaciones | Detalle expandido redirigía a Operación | Chips aplicables con ventanas; detalle consultivo; consolidado registrado sin sumar categorías |
| B09 panel de orden | Navegación directa al formulario operativo | Panel lateral PC / diálogo móvil, pestañas Resumen/Materiales/Novedades/Historial |
| B11 Ensamble completo | Texto secundario | Indicador solo Export válido/saldo0; desconocido permanece sin confirmar; sin estado Mecanizado |
| Contexto al volver | Selección consultiva inexistente | Filtros, selección, pestaña y scroll en memoria del mismo ámbito/sesión |
| Revisar SALE | Solo en formulario operativo | Navegación al formulario existente, solo coordinador con contrato/permiso; no guarda desde Seguimiento |
| Solicitar verificación | Sin RPC de envío acreditada | Acción deshabilitada explícitamente; no se simula envío |

Contrato reutilizado: sgp_lp_operacion_consultar y sus órdenes/afectaciones/history/
materialContext autorizados. No se amplía el ámbito ni se llaman consultas globales
para rellenar huecos. La vista cubre órdenes incorporadas al turno consultado;
no acredita por sí sola un censo global de abiertas de toda la línea. Semana base
y año usan campos oficiales existentes; no se deduce una semana original ausente.
Los resúmenes PDT históricos no acreditan liberación física/ventanas ni SALE.
Vidrio navega por el controlador existente; ubicación no se convierte en NC V.

Referencia visual fijada: azul SGP, tabla compacta y detalle lateral B08/B11;
afectaciones B10 con sus colores semánticos; detalle de materiales B09. Se conserva
la cabecera/pestañas horizontales actuales: no se incorpora el menú lateral del
mockup histórico. No se modifica Operación, guardado, cierres, Power BI, Export,
Programación ni sus prioridades; solo se añade una rama de presentación consultiva.

## Verificación y diferencias pendientes

28/28 pruebas dirigidas y cuatro recorridos Chromium PC1440/móvil390 PASS,
PostgreSQL17.11 aislado con identidades y datos sintéticos. No se repitió la
batería integral previa. [Evidencias y capturas antes/después](../../tests/lp01-tracking/README.md).
Se comprobaron filtros, detalle, solapamientos, retorno/scroll y tarjetas LP-02
originales. Export, asignaciones y auditoría no cambiaron durante la navegación.
Las funciones de guardado, cierre, Power BI, informes y vidrio del controlador
permanecen byte-idénticas a la base; las dependencias directas pasan. Programación,
calendario, navegación horizontal, contratos SQL y estilos globales no se modifican.

La tabla, panel y colores se contrastaron con las páginas originales observadas.
Se mantiene una fila por raíz/asignación canónica LP en lugar de inventar un
agrupamiento por reserva como en los ejemplos históricos. El saldo de producción
puede repetirse por asignación y está expresamente marcado como no sumable.
No se habilitan formulario SALE ni observaciones nuevos dentro del panel: las
acciones llevan al formulario autorizado existente. No hay envío ficticio de
verificación. Estas diferencias están delimitadas por los contratos vigentes.

La vista de Empaque conserva saldo propio, filtro de saldo cero, ejecución
empacada, estado de Ensamble y aviso de empaque parcial; no incluye estado de
Mecanizado. El detalle móvil ocupa el viewport y sus controles no quedan tapados
por el menú general. Faltan el PDF maestro/chat19 y aceptación autenticada real;
no se afirma equivalencia integral con referencias que no pudieron recuperarse.
