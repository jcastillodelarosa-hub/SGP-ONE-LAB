# Definición de SALE por orden · preparación local

Estado 2026-11-05: backend INSTALADO Y HABILITADO por el coordinador, sin datos
de prueba; frontend IMPLEMENTADO LOCALMENTE y aún sin PR/publicación. Ver
[estado operativo](../../linea-produccion/ESTADO_OPERATIVO_ACTUAL.md) para hashes,
postcheck y versiones de migración. Uso entre turnos pendiente.

## Alcance y límite funcional

La última definición se guarda por producción y etapa, con cantidad entera,
revisión, usuario, fecha del servidor, motivo, evidencia de fuentes e historial
inmutable. No requiere asignación ni fabrica turnos. Reutiliza el actor/alcance
nativo, saldo Export y consolidación acreditada; desconocido no equivale a cero.
No convierte piezas PDT en ventanas ni suma causas solapadas.

El SALE existente en `sgp_lp_operacion.ordenes` conserva su API, revisión,
auditoría, avisos e inicialización de Empaque. La nueva definición NO se copia a
ese contrato, NO se consume, reinicia ni reparte entre turnos. Toda respuesta
incluye `operational:false` y `temporalPolicy:UNRESOLVED`. La regla de evolución
entre turnos sigue pendiente del usuario; no se inventa.

## Manifiesto propuesto

`01_definition_REVIEW.sql`, SHA256
`4e7a70c5b495a52b2c88f4a418fdecf7eed7f1a26af004fc19608c35059573b1`.

- Crea esquema privado `sgp_lp_sale_orden` y tablas `config`, `definiciones`,
  `eventos`, con RLS, sin políticas públicas. Configuración inicial apagada.
- Funciones privadas `inmutable()`, `sesion_viva(text,text)` y `fuentes(text,text,text)`; trigger rechaza
  UPDATE/DELETE del historial.
- API de lectura `public.sgp_lp_sale_orden_consultar_v1(text,text,text)`.
- API de escritura `public.sgp_lp_sale_orden_definir_v1(text,text,text,jsonb)`.
- Ambas SECURITY DEFINER, propietario postgres y search_path vacío. Instalación
  revoca EXECUTE a PUBLIC, anon, authenticated y service_role; no concede permisos.
- Lector verifica sesión/orden/etapa; escritor además coordinador/admin y permiso
  nativo SALE. Bloqueos y revalidación de actor tras esperas. UUID de comando,
  CAS, huella vigente de disponibilidad y escritura atómica con auditoría.
- No DROP, TRUNCATE ni UPDATE/DELETE de registros existentes. No altera funciones
  compartidas, Export, PDT, asignaciones, turnos ni contratos operativos.

La instalación y habilitación de estas dos firmas nuevas para **anon** y del
flag `definitions_enabled` recibieron autorización específica de Johan; el
coordinador ejecuta el cambio por conector, no este worktree. no queda cubierta por
las seis funciones de afectaciones autorizadas anteriormente. Ningún acceso a
tablas privadas ni nuevos roles. No se ha generado ni ejecutado ENABLE productivo.

## Evidencia local

- `tests/lp01-order-sale/result.json`: PostgreSQL nativo; default cerrado,
  disponibilidad desconocida rechazada, sin asignación, etapas separadas, roles,
  CAS concurrente, reintento exacto, revocación, rollback si falla auditoría,
  historial inmutable y Export intacto. Revocación concurrente: la escritura ya
  admitida termina antes de la revocación; cualquier reintento posterior se deniega.
  Cambio de rol confirmado se rechaza por el actor nativo y además se revalida
  explícitamente antes de retornar un recibo. Una escritura que esperaba mientras
  expiraba la sesión pudo completarse con el helper histórico (`now()`); la
  nueva guarda privada comprueba `clock_timestamp()` después de la espera y la
  regresión ahora verifica que se rechaza sin escribir.
- `tests/lp01-order-sale/browser.py`: celda aislada con RPC contra PostgreSQL real,
  PC1440/móvil390, guardar/recargar/historial, pérdida de respuesta después de
  commit y reintento del mismo UUID sin duplicado. SALE operativo se crea antes
  mediante API nativa en ambas etapas; filas y auditoría permanecen idénticas.
- `tests/lp01-order-sale.test.mjs`: validación de ámbito, sesión, contrato,
  capacidades, recibo y resultado incierto de transporte.
- `tests/lp01-order-sale/tracking-browser.py`: aplicación completa con
  Seguimiento y API nativa en PC1440/móvil390; la opción de SALE se habilita
  solo mediante respuesta HTTP local de prueba. Orden con y sin asignación,
  refrescos de 20 s, foco/selección, filtro, panel, recarga, respuesta perdida
  y revocación pasan; SALE y auditoría operativa existentes idénticos.
- 506 pruebas Node y verify:release pasan. Esto no acredita producción.

## Pendiente antes de integrar

1. La celda y el transporte se conectan a la fila real mediante
   `orderSaleEnabled`, encendido únicamente en esta rama candidata del frontend.
   El contrato se activará solo después de instalar y habilitar las RPC; el
   ensayo local usa PostgreSQL aislado y verifica tabla completa, foco, selección,
   edición, filtro, panel y comando incierto durante refrescos. La activación
   normal depende de publicar el frontend después de los PR anteriores.
2. Resolver regla temporal para uso operativo. Separar la mera definición de su
   aplicación; no mostrar esta implementación como SALE operativo terminado.
3. Ejecutar/contrastar preflight productivo autorizado. El archivo de lectura
   `00_preflight_READONLY.sql` consulta huellas, ACL, propietarios, RLS y columnas
   de la cadena LP; no se ha ejecutado en producción. La instalación guarda dos
   dependencias directas; falta contrastar metadata vigente de toda la cadena. No reparar permisos productivos para igualar fixtures.
4. Autorizar e instalar gradualmente, con comprobación postinstalación y permisos
   mínimos; coordinar recuperación que apague flag/revoque estas dos APIs sin
   borrar definiciones ni historial. No preparar rollback destructivo.
5. Preparación local `fix/seguimiento-sale-prep` sobre main e182f537 de
   Recepción v388. La versión definitiva se asignará tras PR199/B10. Excluye el borrador antiguo sin guardar y el lector
   de abiertas. No publicar antes de cerrar los pendientes anteriores.

## Entrega visual independiente

PR198 integrado/publicado por el coordinador: main
`2ed9f8e9d485bde1c66b0a14632dc0c908b0d0fb`, Hosting
`sites/sgp-one-lab/versions/2eb92f1e5438ff75`. Run42041671863, job127294013772
SUCCESS, observado2026-11-05T14:06:54.262506+00:00. 104 archivos aplicación exactos
y dos plataforma intactos; badgeLABv387 y SHA comprobados por coordinador14:08UTC.
ZIPsha25681956af67a8475b141e66eb22fca4ab35f596b01f0a3428d9bfa6c33774bb1a7,
inventariob72e0322a2476e60c65b922db0409e5d87e72809d6a9041f52bdad3a70d53519.
Aceptación humana con sesión real pendiente. Sin SQL ni permisos nuevos.
Chips/semanas/detalle sin editor SALE; no repetir integración/publicación.
No depende de esta propuesta ni del lector de abiertas v386.
