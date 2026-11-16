# Candidata LAB v463: NCV, PDT y órdenes abiertas

IMPLEMENTADO EN RAMA. Base main v462 `9682daa` (incluye corrección SQL de auditoría PR276); no SQL aplicado ni Hosting publicado.
Integra NCV `b4aa5e1` + `62d1907`, PDT `8619eed` + `1b493bb` y deduplicación
`5f407e4`. Solo conflicto documental; ambas entradas conservadas. Auditoría activa,
configuración, escritores, roles, reservas y cantidades productivas sin modificar.

## Verificación
- Node: 1364 PASS, 10 omitidas, 0 fallos.
- DOM PDT: acceso, cancelación, refresco, guard de borrador/lectura, perfiles/NC y
  doble clic PASS sobre árbol combinado.
- NCV PGlite: coincidencia exacta, autorización sintética por orden/etapa,
  semanas cerradas, preservación de datos y rollback PASS.
- Vendor y release PASS. PC/móvil y sesión real no acreditados: Chromium local
  falla por socket EPERM. Estas pruebas no son aceptación productiva.
- Preflight LAB solo lectura 16/11: lector nuevo ausente; helper existente
  `sgp_lp_shared_order.authorize(text,text,text,boolean)` conserva autorización
  LEER por orden/etapa, hash `d658365a02ae350693966bf0875f6f66`.
- Deduplicación no añade filtro semanal, conserva partes cuantitativas y órdenes
  sin identidad verificable; no altera entregas guardadas.

## Riesgos y secuencia sin interferir con operación
1. Revalidar main y ausencia de otra publicación; PR/CI exactos, revisión de diff
   y secretos. Incrementar solo sello/cache-bust v462→v463; no cambiar política
   de despliegue ni pins para forzar paso. Push de rama no publica Hosting.
2. Acreditar por GET versión live v462 y retención de rollback/artefacto exacto.
   El snapshot SQL incluye definiciones/ACL de helpers y huellas de fuente y
   reportes justo antes de instalación. Cambios legítimos concurrentes en datos
   deben distinguirse de mutaciones de esta migración.
3. Tras autorización SQL, instalar solo nueva RPC de lectura en transacción.
   CREATE sin OR REPLACE falla si existe. No tocar tablas, escritor ni auditoría.
   Verificar ACL/search_path, denegación token inválido, alcance y preservación
   de definiciones. Código y procedimiento: sql-proposals/ncv-finalizada/.
4. Preparar artefacto exacto, sellar y publicar por flujo protegido con source SHA,
   run/ZIP y expected_live acreditados. No relajar guards ni activar recuperación
   OPT. El lector nuevo es compatible con v462; UI degrada a reporte sin verde
   si falta la RPC, pero ese caso NO constituye NCV completa.
5. Verificar versión/SHA Hosting y lectura real en Seguimiento+Ensamble: aviso
   verde NC12922461, afectación sigue pendiente físicamente; NC abierta conserva
   amarillo. Revalidar refresh, cambio de orden, cierres y reporte PDT. No crear
   PDT ni modificar recepciones reales solo para probar.
6. Si UI falla, contener/revertir Hosting a respaldo acreditado compatible con
   auditoría activa (v462, no versión anterior a ella). RPC aditiva puede quedarse
   sin consumidores; si hay fallo de autorización, retirar nueva RPC con rollback.
   Nunca restaurar tablas operativas ni revertir auditoría como parte de esta entrega.

Pendiente: CI exacta, evidencia de respaldo live reciente y aceptación visual/sesión.
No afirmar publicación o verificación productiva antes de esas evidencias.

PR276 integrado sin conflicto; hotfix SQL de auditoría ya activo se conserva y no se reaplica.
