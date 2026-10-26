# SGP SmartTable Library v1.2 (candidata)
Biblioteca genérica de **solo lectura**, sin dependencias ni acceso propio a Supabase. Rama de integración: `feature/smarttable-library-v1`. **No activada en la aplicación**.

## Uso
```html
<script type="module" src="./src/ui/smarttable/smarttable-element.mjs"></script>
<sgp-smarttable id="tabla"></sgp-smarttable>
<script type="module">
const table=document.querySelector('#tabla');
table.preferenceKey='mi-modulo-v1';
table.rows=registrosYaAutorizados; // array de objetos planos
// Opcional: configurar columnas explícitamente para nombres, tipos y privacidad
table.columns=[
 {id:'produccion',label:'Producción'},
 {id:'cantidad',label:'Cantidad',type:'number'}
];
</script>
```

**Importante:** si no se definen columnas, el componente infiere las claves del primer registro. **No usar inferencia con datos sensibles o columnas que deban ocultarse**: especificar una allowlist explícita, ya filtrada por permisos del módulo.

## Contrato
- `rows`: array de registros previamente autorizados; no realiza consultas ni escrituras.
- `columns`: columnas con `id`, `label`, `type` y `visible`; deben coincidir con claves reales.
- `preferenceKey`: preferencias locales por vista y navegador; no guarda anotaciones operativas.
- Filtros de valores, búsqueda, orden multinivel, paginación y exportación CSV.
- Sin sincronización automática de cambios operativos; el módulo anfitrión debe reasignar `rows` al actualizar.
- No convertir orden visual en prioridad de producción ni estado funcional.

## Integración gradual
1. Auditar origen de datos, permisos, acciones y campos reales de cada tabla.
2. Montar SmartTable en un contenedor nuevo junto a la tabla clásica, inicialmente oculto.
3. Activar solo para usuarios de prueba; comparar filas, cantidades, estados y filtros.
4. Probar en PC, móvil, roles permitidos y denegados, y grandes volúmenes.
5. Fusionar/publicar únicamente tras aprobación y evidencias.

## Límites
No incluye aún Kanban, timeline, notas flotantes, virtualización ni drag-and-drop del prototipo. No está verificado en navegador ni planta. No altera SGP_ONE_GOOGLE, Supabase, Firebase ni `main`.

## v1.2
Page sizes: 10, 25, 50, 100. Hidden columns are not searchable, sortable, filterable, or exportable. Saved preferences are validated against the current column configuration. This is not an authorization boundary: the host module must pass authorized records and columns only.

Run: `node --test src/ui/smarttable/smarttable-core.test.mjs`. CI workflow is `.github/workflows/smarttable-library-tests.yml`.
