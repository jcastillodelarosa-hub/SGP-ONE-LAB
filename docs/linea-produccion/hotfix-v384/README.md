# LAB v384 · Seguimiento por orden sin asignación

Estado: IMPLEMENTADO EN RAMA, no publicado ni aplicado en Supabase.
Base main17b01155d1cdf0ad409e474c87976bc27cdd7563 (PR195/v383 fusionado).
Rama fix/seguimiento-unassigned-v384. No se incorpora la cadena aislada B14–B27.
La entrega urgente usa383→384; los números de las entregas futuras pendientes
requieren reconciliación antes de publicarlas, sin reescribir ahora esas ramas.

## Resultado

Acceso directo a pendientes/afectaciones/PDT desde Resumen y acciones del detalle;
Materiales incorpora el panel por orden y conserva Mecanizado/vidrio/fuentes.
Sin asignación, el usuario selecciona explícitamente fecha y turno de registro.
Se verifica por consulta que exista ABIERTO en esa línea/etapa/fecha/turno;
el servidor vuelve a comprobar sesión, rol, ámbito temporal y estado al guardar.
No se abre un turno ni se incorpora una orden. No se cambia SALE, Export ni permisos.
Se conservan borradores en Materiales/Afectaciones durante refresco silencioso.

SALE sigue ligado a asignación y turno en el contrato vigente: se explica la
limitación, sin mostrar cero ni crear asignaciones ficticias. Habilitar SALE por
orden sin asignación necesita un contrato específico y regla de posterior reparto;
esta entrega no lo implementa ni lo presenta como terminado.

## Todos los orígenes de aluminio

Propuesta13 extiende únicamente
public.sgp_lp_afectaciones_consultar_v2(text,text,text).
Añade aluminumPending con todas las filas de sgp_aluminio_pendientes cuya
key_produccion coincide exactamente. Conserva actor LP, etapa y mismos roles PDT
reales. Devuelve origen/contrato/ID/reserva/referencia/fabricación/longitud/acabado/NC,
piezas, estados y evidencia existente; null permanece desconocido.
No reclasifica, calcula ventanas, confirma recepción ni crea asociaciones.
pickingPending y el escritor de asociación permanecen intactos; el cliente no
ofrece contratos LEGACY como candidatos Picking. La lista unificada no repite
visualmente los Picking en otra lista cuando está disponible.

Sin propuesta13 instalada, el cliente conserva Picking y avisa que otros orígenes
no están disponibles en ese lector; nunca informa que no existen.

## Instalación coordinada pendiente

1. Capturar función actual, owner, ACL y configuración mediante lectura autorizada.
2. Contrastar baseline prosrc MD5 31a9538446f1cb9b59c46161a60d6861,
   owner postgres, SECURITY DEFINER, search_path vacío exacto, EXECUTE owner+anon
   sin grant option de anon ni otros grants. La propuesta rechaza divergencias.
3. Aplicar únicamente docs/sql-proposals/lp01-afectaciones/13_all_origins_read_REVIEW.sql
   tras coordinación expresa. CREATE OR REPLACE conserva ACL. No tablas, GRANT,
   flags ni escrituras de negocio. No aplicar después de propuesta12 pendiente:
   ambas modifican el mismo lector; requieren composición/revisión explícita.
4. Verificar huella resultante, ACL, lecturas agregadas y caso autorizado; no crear
   datos de prueba productivos. Recuperación: restaurar definición previa capturada
   bajo verificación de huella resultante, sin eliminar datos.
5. Actualizar controles Hosting/backend y política para SHA/PR final, CI propia,
   artefacto exacto y publicación coordinada por padre. No reutilizar pins PR195
   como evidencia de este hotfix ni deshabilitar HOLD.

## Evidencia aislada

- 491 pruebas Node y verify:release v384.
- tests/lp01-afectaciones-rpc/unassigned-app.py: aplicación real + PostgreSQL
  sintético PC1440/móvil390; pendiente original, NOVEDAD guardada sin asignación,
  turno no abierto rechazado, picker PDT, borrador20s y limpieza tras revocación.
  Escritor atómico sin NC, reintento sin duplicado; cero asignaciones creadas.
- tests/lp01-tracking-ui/browser.py: PC/móvil filtros/orden/foco, 3 ciclos20s sin
  repintado, sin consultas solapadas, limpieza por sesión/etapa/rol.
- tests/lp01-afectaciones-rpc/all-origins.py: reproducción sintética Onix
  1315640|PANELES_2, reserva8713011, ES-EL400-004,19piezas, PRODUCCION/LEGACY,
  BODEGA, ventanas=null, auditado=false,POR_VALIDAR. ID sintético diferente.
  El registro histórico se carga en fixture con triggers suspendidos solo durante
  esa carga: el escritor actual rechaza ese legado sin identidad nativa. No es
  una prueba de creación LEGACY mediante API ni una relajación del instalador.
  La API se prueba con todos los triggers restaurados. SQL y PC/móvil, scope,
  permisos, rollback, huella, ACL conservada y ausencia de asociaciones.
- Revisión independiente: preservados Materiales/vidrio, acabado/NC y guard ACL.

Evidencia sintética, no aceptación productiva. Ninguna operación productiva ejecutada.

Migración13 SHA256: 6e7d763a4867cc3a90ba795761a5b5e7b28acc3ef44a1d227c5f5d5a61394efd.
Nuevo prosrc MD5 probado: a74f14fefe3a3d91201423fdc3111d7a.
Resultado reproducible: tests/lp01-afectaciones-rpc/all-origins-result.json y
unassigned-app-result.json; capturas sintéticas en su carpeta evidence.
Documentación Supabase consultada: https://supabase.com/docs/guides/database/functions
(changelog.md no legible por herramienta web; no cambia firmas Supabase de cliente).

## Preflight productivo de lectura · 05/11/2026

Supabase BEGIN READ ONLY / ROLLBACK: lectorv2 conserva baselineMD5,
ownerpostgres, SECURITY DEFINER, search_path vacío exacto y ACL postgres+anon
sin grantoption. Las18 columnas requeridas están presentes con tipos compatibles.
Dependencias actor/lectorv1/validadorrol inventariadas en production-preflight.json;
sin nuevas concesiones, filas de negocio consultadas ni cambios productivos.
Workflow de aceptación incorpora ambos ensayos nuevos en PostgreSQL aislado;
Chromium usa binario local o el instalado por Playwright en CI.
