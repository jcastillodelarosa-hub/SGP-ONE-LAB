# Disponible: fallo persistente después de sesión acotada

## Evidencia productiva nueva (06/11/2026, solo lectura)

Ventana de logs desde 11:12:30 UTC, observada aproximadamente 12:00 UTC:
69 llamadas HTTP a consultar Disponible, todas 200, media 1143 ms, máximo1561 ms;
649 a afectaciones v2, todas200, media614 ms, máximo2710 ms. No llamadas HTTP a
definir Disponible en el resultado agregado. PostgreSQL no devolvió 57014 en
la ventana; solo los dos rechazos sin sesión del postcheck de11:12.
Esto no acredita que el formulario renderice correctamente cada respuesta.

A las11:59:16: definiciones0, definitions_enabled=true. Consulta posterior:
consolidados0, conciliaciones0, definiciones0. Sin identificadores de personas,
tokens ni filas individuales consultados para este diagnóstico.

## Guardado: contrato bloqueado, no pérdida después de un éxito

`fuentes()` requiere un consolidado con revisión/saldo vigentes, conciliación y
cobertura de fuentes. Sin consolidado devuelve available=null. El formulario
`lp01-order-sale-cell.js` impide enviar: «Disponibilidad pendiente de validar».
El servidor también rechaza SALE_ORDER_AVAILABILITY_PENDING si se evita esa
validación. Por ello el guardado no llega al endpoint en el caso observado;
no existe evidencia de escritura exitosa que después desaparezca.

El campo se presenta editable antes de explicar este requisito. El flujo actual
requiere coordinador: conciliar historial y validar consolidación mediante los
contratos existentes, y después refrescar Disponible. No se autoriza rellenar
consolidados automáticamente ni tomar null como0 ni saltar guardas para guardar.
Si el requisito funcional es Disponible manual independiente de conciliación,
coordinación debe confirmar ese cambio de contrato; no es una corrección neutra.
El mensaje exacto y orden/etapa del usuario se solicitaron para correlación.

## Latencia residual y parche independiente

La sesión optimizada no cubría el FOREACH por ENSAMBLE/EMPAQUE dentro de
`public.sgp_lp_afectaciones_consultar_v1`. Allí sigue materializándose
`permisos_en_periodo()` dos veces por orden. Disponible llama a ese lector a
través de fuentes. Seguimiento además lee todas las órdenes con tres workers y
repite el enriquecimiento cada20s; 649 lecturas en unos6min acreditan la carga.

05 reemplaza solo el predicado de permisos por su equivalente acotado cuando
perfil_roles está activo; conserva puede_operar, la rama temporal heredada,
locks, contrato, disponibilidad/consolidación y ACL privada. El cuerpo instalado
capturado es22276d883423e5f3dcc32d335f61ee5f; nuevo2d414bbf24bb3167af71e50a92f536c9.
06 revierte solo ese cuerpo con guardas. Sin GRANT, RLS, flags ni DML.
No cambia las reglas que bloquean Disponible sin validar.

Estado: SQL05 APLICADO en Supabase como lp_affectations_scoped_read_v397,
postcheck12:04:32 UTC: huella nueva, postgres/DEFINER/search_path vacío/ACL
privada intactos. SQL06 preparado, no ejecutado. 30 comparaciones del lector
completo en PostgreSQL17.11 aislado PASS; camino perfil evita materialización
global, rama heredada conservada y rollback restaura huella original.
Evidencia en affectations-scoped-production-evidence.json. Sin datos operativos
de prueba. Latencia posterior aún pendiente de sesión real;
no se publica frontend ni se duplica el trabajo de UI del otro responsable.
La optimización de consultas visibles/coalescencia en lp01-operation.js debe
coordinarse con su dueño y no mezclar snapshots/cachés entre sesiones.
