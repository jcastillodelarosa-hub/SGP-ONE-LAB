# Seguimiento global — candidato para revisión

Base main ab1d2d6. Implementación B08–B11 existente reutilizada; incremento probado
con datos sintéticos. No acredita instalación, publicación ni aceptación en planta.

## Comportamiento

- Seguimiento disponible solo para coordinador/administrador; consolidado VALIDAR
  únicamente para coordinador, con guardas en servidor antes/después del lock.
- Subpestañas Ensamble/Empaque; censo global por línea/etapa sin filtro de semana,
  incluida producción sin asignación. Identidad estable por key y etapa.
- Export determina saldo. Desconocido o cero con pendientes locales permanece
  visible como «Pendiente de conciliación», sin inventar disponibilidad.
- Selección y reconsulta de contexto real para operar; sin asignación no se crea
  programación ficticia. Se conserva navegación, tabla PC, tarjetas móviles y detalle.
- Consulta operativa de Ensamble/Empaque, permisos de etapa y guardas de cierre/
  arrastre conservados. No se habilita arrastre automático.

## Backend propuesto

[Paquete de instalación, permisos y recuperación](../sql-proposals/lp01-seguimiento/README.md).
Fachada con lista explícita de campos, sesión SGP y ámbito efectivo en servidor.
Instalador transaccional: modifica dos funciones y crea dos; nuevas funciones
sin acceso API. Revoca también service_role sobre la nueva fachada y mantiene
la comprobación estricta de ACL; no altera defaults ni permisos preexistentes.
EXECUTE anon se propone por separado, sujeto a aprobación específica.

## Evidencia sintética reutilizada

- API PostgreSQL17.11/PostgREST aislados: seis grupos PASS, instalación/fallo
  atómico, roles/sesiones/ámbitos, defaults, contención, eliminación y reinstalación.
- Cinco grupos SQL PASS, incluida revocación concurrente y lectura sin mutaciones.
- Diez recorridos PC1440/móvil390 PASS; tres pruebas unitarias de contrato global.
- Ocho fixtures de navegador adaptados PASS; evidencias históricas conservadas.
- Regresiones focalizadas, sintaxis, verify:release y diff comprobados en aislamiento.

Resultados en `tests/lp01-seguimiento-incremento/`. La evidencia previa mantiene
su alcance; CI del commit público se evalúa aparte. No se incluyen nuevos datos,
respaldos ni metadatos productivos. Los controles de publicación siguen en main
sin cambios; la rama nueva no es disparador de despliegue.

## Pendiente

Revisión del PR y CI, respaldo privado/preflight autorizado antes de instalar,
aprobaciones separadas de instalación, EXECUTE anon, fusión y publicación del
artefacto exacto. Rendimiento con volumen real y aceptación de planta pendientes.
El ajuste local anterior «Ensamble pendiente · cantidad» no fue recuperado ni
recreado. No hay otra decisión funcional indispensable en este incremento.
