# Contraste productivo de solo lectura — 05/11/2026

Resultado: **HOLD de instalación/activación**. La base y los permisos nativos LP
coinciden con las pruebas, pero el adaptador PDT debe actualizar su entorno de
pruebas y precondiciones para la envoltura vigente de Mecanizado parcial. No se
sustituyeron pins, no se cambiaron roles, no se ejecutaron funciones de negocio.

## Método y evidencia

Proyecto Supabase `ocvxbwzqxbrfndkvjmfx` (SGP-ONE-LAB). Consultas vía Supabase
execute_sql, cada una con `BEGIN READ ONLY`, timeout15s y `ROLLBACK`. Solo catálogo,
definiciones de funciones sin secretos y agregados de integridad; sin órdenes,
usuarios, tokens ni identificadores de pendientes individuales. Consultas independientes,
no un snapshot único sostenido: revalidar antes de activar. Observación final
`2026-11-05 02:01:22.534773+00`, `transaction_read_only=on`.

Evidencia reproducible: `tests/lp01-afectaciones-rpc/production-readonly/`:
`functions`, `acl`, `integrity`, `controls`, `wrappers`, `legacy`, `sources`, `snapshot`
(JSON y consulta SQL). `fixture-comparison.json` compara cuerpos con PostgreSQL17.11
sintético reconstruido desde el candidato. Las definiciones recuperadas no se ejecutaron
en producción ni se incorporaron como reemplazos de funciones instaladas.

## Contratos

13 de las16 funciones seleccionadas coinciden por cuerpo MD5 con la fixture.
Coinciden las8 dependencias LP revisadas: sesion, contener_ambitos, verificar_temporal,
operaciones_rol, admitir, saldo, puede_operar, permisos_en_periodo. Coinciden también
sesión pública, validador PDT, actor PDT, wrapper de fuentes e interior registrar.
MD5 se usa como guardia de compatibilidad existente, no como firma criptográfica.

| Dependencia | Producción | Fixture / efecto |
|---|---|---|
| operaciones_rol | `69274f528a2fed8001da535856649036` | Coincide |
| registrar interno PDT | `2c9da616eb830fd6db20973e9bec4155` | Coincide |
| public.sgp_pdt_registrar_v4 | `c161750f1cec8f48896b9b2462c86d53` | Esperaba `8c501e21c8a6986f584ec96a3da955e6`: SQL03 falla cerrado |
| sgp_mecanizado_parcial.registro_legacy | `8c501e21c8a6986f584ec96a3da955e6` | Conserva cuerpo anterior exactamente |
| fuentes interno PDT | `7cca133124fdb1fc47360994dc102ad3` | Fixture `db84ac4f4baa2694028d84f93b4136ef`, requiere actualizar prueba |
| picking_piezas_panel | `3d01198c65962e659b219e946b5440ac` | Fixture simplificada documentada: no certificaba esta dependencia |

La envoltura actual añade rama PICKING parcial. Para origen distinto de PICKING,
deriva a registro_legacy. Las fuentes vigentes restringen partes y usan identidad
canónica; el listado Picking también tiene rama parcial y multireserva. Esto apoya
compatibilidad de la intención Ensamble/Empaque, pero **no sustituye prueba ejecutable**
con toda la cadena instalada. No restaurar wrapper antiguo ni evitarlo llamando directo
al legacy para pasar un pin. Capturar y probar dependencias transitivas necesarias,
incluyendo origenes_internal_v3 y es_parte, antes de aceptar nueva huella.

Todos los objetos seleccionados son de postgres. Wrapper PDT mantiene SECURITY DEFINER
con search_path vacío; los helpers LP tienen privilegios API revocados. La sesión
pública conserva search_path public y semántica now() ya documentada; sin cambios aquí.

## Permisos efectivos

- anon/authenticated no tienen USAGE ni CREATE en esquemas privados LP, PDT multiorigen
  y PDT manual. Tampoco SELECT/INSERT/UPDATE/DELETE en las tres tablas multiorigen.
  Su RLS desactivada **no implica exposición directa** con estas ACL; se cierra la
  sospecha de acceso directo derivada solo del indicador RLS anterior.
- public.sgp_aluminio_pendientes y sgp_picking_entregas: grants DML presentes, RLS activa,
  cero políticas. Roles API no son superusuarios ni BYPASSRLS: acceso directo a filas
  denegado por RLS. No se probó DML ni se alteró configuración de Data API.
- Wrappers públicos PDT registro/fuentes conceden EXECUTE a anon/authenticated,
  no PUBLIC; helpers privados denegados. picking_piezas_panel conserva EXECUTE PUBLIC
  preexistente; su cuerpo delega autorización según rama. No se amplió ni revocó aquí.
- Perfil nativo LP habilitado; flags LP writes/BI habilitados. Son estado previo,
  **no habilitan las futuras afectaciones**. Esquema nuevo no instalado.

No se simularon sesiones de usuarios reales. Roles de aplicación se acreditan por
contratos/hashes y pruebas sintéticas, no por impersonación de cuentas productivas.

## Picking real: agregados

| Contrato | Total | Sin key | Sin detalle nativo | Vínculo nativo completo | Detalle manual |
|---|---:|---:|---:|---:|---:|
| LEGACY | 77 | 16 | 77 | 0 | 0 |
| V2 | 59 | 0 | 18 | 41 | 13 |

- 136 registros en total;120 tienen key exacta existente y son candidatos a lectura
  por orden, sujetos a permisos. Los16 sin key no aparecerán en una consulta por key;
  no inferir identidad mediante texto de producción.
- 41 cumplen detalle→evento PICKING→entrega nativos; son candidatos al adaptador,
  no certificación de disponibilidad física ni autorización de escritura.
- 13 V2 manuales y5 V2 restantes sin detalle nativo necesitan ruta/evidencia distinta.
  Cero fuentes con detalle nativo y manual simultáneos. Los77 LEGACY no satisfacen
  el adaptador nativo; no convertirlos ni duplicarlos.
- Cero keys no nulas huérfanas, orígenes nativos discordantes, fabricación faltante,
  longitud nula/no positiva o cantidad de piezas nula/no positiva en estos agregados.
- Join de ledger conserva136 filas frente a136 originales. Cero IDs duplicados en
  detalles/eventos. Esto prueba que **esa unión no multiplica filas**, no demuestra
  ausencia de reportes semánticamente repetidos con IDs diferentes ni ventanas únicas.

## Siguiente activación, coordinada

1. Actualizar fixture con wrapper/fuentes y dependencias transitivas actuales;
   probar ramas Ensamble/Empaque y no regresión Picking parcial/multireserva. Conservar
   original source IDs, piezas separadas de ventanas, UUID/rollback y roles.
2. Revisar independientemente diferencias y fijar pins de TODA la cadena relevante
   por compatibilidad demostrada; regenerar manifest SHA256. SQL03 actual no instalar.
3. Definir alcance inicial: lectura de120 candidatos por key; asociación solo de41
   nativos acreditados. Esos conteos no son selección operativa persistente; revalidar
   al usar cada fuente. LEGACY/manual y16 sin key quedan sin asociación automática.
   Resolver aplicación entre etapas antes de prometer consolidado completo.
4. CI SHA exacto y backup/recuperación; reconsultar hashes, ACL y flags inmediatamente
   antes de instalar. Revisar nuevas firmas API y grants de forma explícita con el
   coordinador; no ampliar acceso persistente por autorización general.
5. Instalación01→05 contenida, sin grants ni flags nuevos activos; pre/postchecks.
   Luego coordinar activación mínima de lectura y después escritura probada, según
   plan ACTIVACION_REVISION.md. Nunca abrir turnos ni usar datos reales como pruebas.
6. Publicación solo por coordinador con los gates existentes y v382. Evidencia actual
   NO autoriza a afirmar que v382 ya esté instalada, publicada o validada en uso real.
