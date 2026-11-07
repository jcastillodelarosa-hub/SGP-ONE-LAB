# Incorporar Otras: piloto Ensamble PANELES_2

IMPLEMENTADO EN PAQUETE LOCAL / PROBADO EN AISLAMIENTO / DESACTIVADO POR DEFECTO.
NO APLICADO EN SUPABASE, NO PUBLICADO, NO AUTORIZACIÓN ACTIVADA.

## Contrato de comando

Se utiliza la fachada existente `sgp_lp_operacion_comando(p_token,p_cmd)`:

- op: INCORPORAR.
- id: UUID de petición conservado en todos los reintentos.
- stage: ENSAMBLE; line: PANELES_2.
- date y shift: período explícito que ya existe ABIERTO.
- key: key_produccion canónica.
- revision: revisión actual del turno (CAS).
- turn_revision: opcional por compatibilidad de transporte; si se envía debe coincidir exactamente con revision.
- quantity: entero JSON positivo explícito, máximo INT32 y saldo disponible.
- observation: motivo obligatorio de hasta2000 caracteres.

No admite part, prioridad, actor, rol, capacity ni campos de otras operaciones.
La prioridad se añade al final de la programación de la línea/turno sin reordenar
las asignaciones existentes. La respuesta incluye contract LP-INCORPORAR-ENSAMBLE-1,
key, part (UUID generado por servidor), quantity, priority, orderRevision0 y
turnRevision nueva. Es un alta real de raíz de programación, no un UUID ficticio
para repartir ejecución entre raíces antiguas.

La misma transacción crea la asignación PROGRAMADA y la orden LP del turno,
conserva SALE=null y ejecutado0, aumenta una sola revisión y registra auditoría
INCORPORAR con usuario/rol real, motivo, petición, antes y respuesta. No abre turno,
modifica cantidades originales, escribe Export ni asignaciones ajenas.

## Condiciones de seguridad y negocio

- Nueva columna privada `sgp_lp_operacion.config.incorporar_ensamble` booleana,
  NOT NULL DEFAULT false. El instalador NO contiene activación.
- Solo LIDER LINEA y SUPERVISOR ENSAMBLE, con perfil de roles habilitado, sesión
  válida, cuenta activa e intersección actual de accesos rol/usuario a Ensamble.
  No se añaden usuarios, roles, ámbitos, entradas de accesos, credenciales ni GRANT.
- `puede_operar` añade únicamente ese caso estrecho y gated; sus otras decisiones y
  `operaciones_rol` permanecen intactas. No concede ABRIR, SALE, VALIDAR o Empaque.
- Requiere escrituras generales admitidas y bloquea la fila de configuración;
  contención de la bandera espera operaciones admitidas, igual que el motor actual.
- Reloj/horarios/ámbitos existentes, mutex por petición y línea/etapa, lock del turno
  y producción. Reautoriza después de esperas; la auditoría vuelve a comprobar.
- Turno ausente, CERRADO, EN_REVISION o con sucesor: rechaza, no corrige ni crea.
- Producción activaSI, Export presente e inicializado, saldo entero no negativo.
  La lista Otras debe estar sin iniciar: saldo_ensamble igual a cantidad original
  positiva y sin asignación vigente/fila LP en este turno. Las abiertas se trabajan
  desde Abiertas, no se duplican con este comando.
- quantity<=saldo y suma de todas las asignaciones no canceladas+nueva<=saldo,
  preservando el límite conservador del programador vigente. Planes de otros
  períodos siguen contando; no se liberan ni trasladan por inferencia.
- Programación externa no usa el mutex LP: se toma lock SHARE ROW EXCLUSIVE NOWAIT
  de la tabla de asignaciones tras el lock de producción. Si hay actividad
  incompatible, retorna PROGRAMACION_EN_ACTUALIZACION_RECONSULTAR, sin efectos.
  No espera con orden de locks invertido ni altera los escritores previos.
- Repetir id/payload devuelve la misma respuesta. Reutilizar id con otra cantidad,
  autor o propósito se rechaza. Una segunda incorporación de key ya presente falla.

## Recibo y límites de permisos

`sgp_lp_operacion_resultado` hoy excluye ambos supervisores en su guard inicial.
El parche permite SUPERVISOR ENSAMBLE exclusivamente para su propio recibo
INCORPORAR de ENSAMBLE/PANELES_2, bajo sesión/ámbito vigentes. No habilita leer
recibos ajenos ni otras operaciones. Líder conserva su ruta de recibo existente.
Los recibos sobreviven a apagar la bandera y no reactivan escrituras.

La lectura `operaciones_rol` no anuncia INCORPORAR; no debe inferirse disponibilidad
solo por el rol. El delta secuencial `03_discovery_REVIEW.sql` añade a consultar:

`incorporation:{contract:'LP-INCORPORAR-1',enabled,canIncorporate,stage:'ENSAMBLE',line:'PANELES_2'}`.

Se instala después de catálogo LP-HOJA-1 y comando INCORPORAR. Exige flagfalse.
`enabled` requiere bandera, escrituras y perfil activos, y contexto del piloto.
`canIncorporate` requiere además autorización individual real, turno ABIERTO y
ningún sucesor. Flagfalse o contrato ausente mantienen deshabilitado el botón.
El servidor vuelve a validar todas las condiciones al escribir; metadata no es
permiso durable y CAS rechaza una respuesta anterior a un cambio concurrente.
El catálogo entregado permanece intacto: este delta fija su hash candidato
`2e4eeacbfc331f2c6dcde32ee96701d7` y produce `3d5184e53fd8aafe7cc2f1829ecc5a81`.
`04_restore_discovery_REVIEW.sql` revierte solamente este descubrimiento.

## Archivos y recuperación

- `01_incorporar_REVIEW.sql`: preflight + columna false + tres cuerpos reemplazados.
- `02_restore_REVIEW.sql`: exige bandera false, drena config y restaura cuerpos
  exactos. Conserva columna false, asignaciones, órdenes y auditoría; no borra datos.
- `03_discovery_REVIEW.sql`: delta de lectura posterior a catálogo+comando, también contenido.
- `04_restore_discovery_REVIEW.sql`: vuelve al catálogo anterior sin quitarlo.
- `manifest.json`: hashes de fuentes/candidatos y SHA256 de archivos.
- `command-fragment.sql`: bloque legible para revisión, no instalador por sí solo.

Se verifican pins del comando/guard/recibo, sesión, autorización temporal,
confirmación de auditoría y matriz de roles vigente. Se preservan propietario,
ACL, SECURITY y search_path. Perímetro nuevo PUBLIC se rechaza. Una diferencia
contra los pins requiere revisión, no reintento ni sobrescritura automática.

Esta recuperación deja la capacidad desactivada y conserva el historial. Si ya
hubo incorporaciones productivas, no pretende deshacerlas; siguen siendo raíces
legítimas del plan con su contexto/auditoría. Revisar continuidad antes de corregir
hacia adelante. No hay script de borrado.

## Pruebas y límite pendiente

Desde la raíz del repositorio:
`npm install --prefix tests/lp01-incorporar --ignore-scripts`
`node tests/lp01-incorporar/pglite.mjs`

Siete grupos PASS en PostgreSQL18.6/PGlite0.5.15, datos y usuarios sintéticos.
Instala cuerpos reales capturados y triggers reales de autorización/auditoría,
no stubs de permisos. Solo en esa base en memoria se habilita la bandera para
los casos positivos. Cubre defaultfalse, atomicidad/reversión, roles/etapas/línea,
revocación/expiración, cantidad/motivo/saldo/estado/CAS, alta raíz+fila LP, reintento,
recibos, descubrimiento fail-closed, conservación de Export/asignaciones y regresión NOTA.
Evidencia: `tests/lp01-incorporar/results.json`.

**Antes de activar:** certificar en PostgreSQL17 de varias sesiones la concurrencia
contra programar/mover y Export, la espera/revocación de configuración y dos altas
con CAS. El harness WASM disponible usa una conexión; NO acredita concurrencia real.
Recuperación recomendada: contener bandera, restaurar descubrimiento04 y cuerpos02.
La propuesta implementa los locks pero no se declara preparada para activar hasta
esa comprobación. No se repitió auditoría general ni pruebas ajenas.

## Decisión y autorización restantes

Para ENSAMBLE/PANELES_2, esta ruta estrecha no necesita decidir el modelo de Empaque:
usa una raíz nueva legítima del plan de Ensamble, con cantidad explícita limitada
por las reglas anteriores. Empaque sigue excluido.

Instalación y especialmente activación requieren confirmación específica. Activar
la bandera permitiría a los usuarios existentes con rol LIDER LINEA o SUPERVISOR
ENSAMBLE y acceso vigente incorporar órdenes de Otras en turnos abiertos del piloto.
No se asume esa confirmación de una autorización general de publicación.
No desplegar un botón que prometa incorporación mientras el servidor no la habilite.
