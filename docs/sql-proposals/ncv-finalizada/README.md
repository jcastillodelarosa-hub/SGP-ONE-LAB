# NCV finalizada: estado informativo, no recepción física

## Evidencia y causa (16 noviembre 2026)
Las dos capturas de Johan muestran NC12922461 y «Estado fuente: Sin dato confirmado».
Lectura real confirma CERRADA, activa, producción1127189 - BAYWALK75 LADOGA AVE,
sistema ES-SGD2020, semana maestro46. Reporte compartido1317837|PANELES_2:
quantity1, solved0, confirmed0, nc_link null. No se modificó ese reporte.
El lector compartido solo hidrata fuente cuando existe vínculo; el lector de avisos
filtra ABIERTA. Además, sgp_consultar_nc_vidrio omite semanas totalmente cerradas.

## Cambio
- Transporte, resumen y detalle compartidos entre Seguimiento y Ensamble; Empaque
  conserva su filtro de reportes de origen. No dos cachés de estado independientes.
- Conserva candidatos activos y sus metadatos sin cambios.
- Añade lector de estado de NC ya referenciadas en reportes compartidos/legacy,
  sin depender de semanas abiertas. Autorización por orden/etapa mediante `sgp_lp_shared_order.authorize`, la misma
  que ya usan Seguimiento y la hoja Ensamble. No acceso global para líderes.
  Solo referencias guardadas de la orden y coincidencia exacta de producción/sistema.
- Aviso verde «NCV finalizada · número» en compacta y detalle, por coincidencia
  exacta de referencia, producción y sistema. Duplicados/ambigüedad no dan verde.
- El verde informa CERRADA/FINALIZADA en fuente activa. No confirma material,
  no resuelve afectación, no cambia cantidades ni fabrica vínculo verificado.
- Refresh/sesión/rol/alcance invalidan evidencia. Si el lector nuevo falta,
  se conservan los reportes sin aviso verde nuevo; no presentar esa situación
  como solución general.

## Referencia visual
Se conserva geometría de chips observada en capturas, con tokens SGP existentes
#dcfce7/#166534, borde verde y texto explícito (color no es la única señal).
Sin rediseño de tabla/formulario. Verde solicitado por Johan, amarillo activo intacto.

## Estado de entrega
IMPLEMENTADO EN RAMA, NO APLICADO, NO PUBLICADO. Versión sin incrementar para
integración central posterior a auditoría/OPT. No desplegar en paralelo.

## Instalación y recuperación
`install.sql` crea una función nueva en transacción, sin reemplazar funciones
existentes ni modificar tablas. Antes de aplicar comprobar nombre ausente,
respaldar definiciones/ACL pertinentes y hashes de fuentes/reportes; no sobrescribir
si el nombre ya existe. `rollback.sql` restaura ausencia de la única función nueva.
No ejecutar rollback con frontend dependiente sin revertir/contener lectura.
Las tablas y lector original no se alteran. No usar token real en artefactos.
Postcheck: función, ACL, search_path, token inválido denegado, hashes intactos;
comparar consulta relacional exacta contra NC12922461; aceptación real con sesión
requiere abrir Seguimiento, compacta y detalle, Actualizar datos, luego cambio de
orden y cierre/reapertura. No marcar recepción física ni editar la NC para probar.

## Pruebas
Node general + casos exactos/ambiguos/reapertura/sesión denegada y detalle: PASS.
SQL PGlite (autenticación sintética):
`PGLITE_MODULE=/ruta/a/pglite/dist/index.js node tests/ncv-finalizada/sql.mjs`
Incluye cierre semana sin abiertas, alcance de referencias/orden/sistema/etapa,
líder asignado autorizado y otro líder/orden/etapa/null inválidos rechazados,
preservación de filas y retirada del lector. Autorizador de SQL sintético; producción
reutiliza sin cambios el helper instalado.
`npm run build:vendor && npm run build:opt-vendor && npm run verify:release`: PASS.
Chromium local no ejecutable por socket EPERM; PC/móvil y sesión alojada no probadas.
