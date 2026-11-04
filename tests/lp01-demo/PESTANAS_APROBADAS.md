**Plan vigente:** [Preparación al SGP principal](../lp01-integration/REVISION_FINAL.md). No se autoriza crear sitios o canales; propuestas anteriores siguientes son antecedente.

# Integración horizontal aprobada — PR183

Base2127eff. Cinco pestañas visibles, en este orden:
LP-01 · Programación / Seguimiento / LP-02 · Ensamble / LP-02 · Empaque /
Reporte de ubicaciones. Se reutiliza la cabecera, menú y estilos SGP actuales;
no se crea menú lateral ni portada nuevos. El menú lateral visible es el original.

Un único controlador LP y una sola instancia de lista/detalle se comparten entre
etapas. Ensamble/Empaque fijan contexto y título; Seguimiento conserva filtros.
Operación del turno y Cierres del turno son acciones internas, no pestañas extra;
permiten cerrar/consultar incluso turnos vacíos. La demo solo consulta snapshots,
jamás confirma escrituras. Los IDs internos de operación/informes se conservan
ocultos para evitar duplicar componentes y contratos.

Programación conserva sus scripts readonly/operations/workspace y contenedor.
Ubicaciones conserva su contenedor, handler legacy y controles de tabla; no cambia
app.js, consultas, saldos, SQL ni permisos. Las hojas históricas Ensamble/Empaque
no se duplican como pestañas visibles. En la demo Programación recibe asignaciones
sintéticas y el explorador vacío explícito; ubicaciones no simula una fuente real.
Las pruebas verifican navegación/contenedores, no certifican datos de planta.

PC1440/móvil390: orden exacto de cinco tabs, acceso desde menúSGP, navegación por
teclado, ambos contextos, búsqueda, expansión, detalles e informes, sin overflow,
sin errores ni tráfico externo. [Capturas tab1–5 por tamaño](evidence/).
Regresiones:19 navegación,2 Programación,6 Operación,7 Seguimiento PASS.
SIN ACTIVIDAD PC/móvil→SQL real aislado PASS con nuevos accesos internos: cierre,
reintento, reapertura y versiones, sin alterar fuentes. Los harness de apertura y
XLSX se adaptan a los accesos visibles; su batería completa queda en CI existente.

Se conservan decisiones individuales B01–B27, incluidos B10/B11 con ajustes y
B17 sin aprobación. Pendientes visuales: densidad menor, UUID completos, detalle
integrado y NC agregadas sin listado de piezasB16; sin afirmar equivalencia exacta.
No se habilitan Tabla/Kanban, Dashboard ni reglas nuevas de Vidrio.

## Publicación controlada pendiente

La propuesta anterior de portada/sitio independiente no es el producto a integrar:
la revisión actual es esta estructura horizontal de SGP. No se ha publicado nada.
Para revisión remota, autorizar específicamente un canal temporal aislado que
sirva el paquete sintético, nunca el canal live ni un reemplazo del SGP actual.
URL exacta pendiente de creación/autorización; no existe enlace activo nuevo.
No usar el workflow histórico de otra rama ni compartir credenciales/backend.

Antes de publicar en el SGP vigente: revisión funcional de capturas y diferencias,
revisión del diff, checks CI y aprobación explícita del destino/artefacto/rollback.
La demo estática no reemplaza el runtime SGP: excluye app.js/config y no debe
subirse sobre el sitio actual. La operación productiva requiere además ámbitos,
SQL/host y fuentes acreditados, con autorizaciones separadas; esta entrega no los
habilita. Recuperación visual: retirar canal temporal; una eventual reversión
productiva requerirá su plan autorizado. No tocar SQL ni datos por revertir UI.
