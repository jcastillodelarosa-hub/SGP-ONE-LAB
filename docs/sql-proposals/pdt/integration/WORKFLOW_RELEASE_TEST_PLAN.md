# PDT unificado — plan de pruebas del workflow #146

Estado: pruebas de revisión estática; **NO** autorización para ejecutar `publish`.

## Matriz de aceptación

| ID | Prueba | Criterio |
| --- | --- | --- |
| W01 | Workflow manual desde rama autorizada | `preflight` no escribe en Supabase ni Firebase; rama distinta rechazada |
| W02 | SHA y SQL | Se rechaza un candidato que no desciende de `f830dd4` o modifica cualquiera de los siete SQL fijados |
| W03 | Secret de conexión | Sin conexión configurada, falla sin escribir |
| W04 | Respaldo | Se exige respaldo privado **reciente**, identificador de objeto, hash, restauración comprobada y correspondencia con producción; un workflow genérico exitoso no basta |
| W05 | Pruebas previas | `npm ci`, `build:vendor`, `verify:release` y `npm test` deben finalizar **antes** de la primera escritura |
| W06 | Preflight SQL productivo | Huellas de funciones, RLS, permisos, columnas y dependencias coinciden; discrepancia detiene todo |
| W07 | Instalación | Las siete fases SQL se aplican en orden, con `ON_ERROR_STOP`; no activar si falla una |
| W08 | Corte | Registrar UTC del instante efectivo de activación y `Jcastillo`; no aceptar hora anterior arbitraria |
| W09 | Firebase | Publicar artefacto exacto validado y registrar revisión/version; no confundir merge con despliegue |
| W10 | Postpublicación | Login por roles, creación, validación, avance, Picking y cierre; históricos solo en auditoría |
| W11 | Fallos y reversión | Antes del corte, reversión segura; después del corte, bloquear rollback automático y activar reparación controlada |
| W12 | Concurrencia | Dos ejecuciones productivas no deben solaparse; permisos mínimos y aprobación de entorno |
| W13 | PC y móvil | Verificar visualización y flujo en ambas superficies; no marcar VERIFICADO antes |

## Resultado de revisión del workflow en 2026-10-29

- **W01:** estructura manual y condición de rama presentes; ejecución real NO PROBADA.
- **W02:** verificación de ancestro y archivos SQL presente; ejecución real NO PROBADA.
- **W03:** rechazo de secret ausente presente; ejecución real NO PROBADA.
- **W04:** **FALLA DE DISEÑO**: solo se consulta conclusión del workflow; no se cotejan objeto, hash, restauración ni vigencia.
- **W05:** **FALLA DE DISEÑO**: pruebas Node se ejecutan después de instalar SQL y activar corte.
- **W06:** **INCOMPLETA**: solo consulta `now()`; no comprueba huellas ni contratos productivos.
- **W07:** secuencia y `ON_ERROR_STOP` presentes; ejecución real NO PROBADA.
- **W08:** **FALLA DE DISEÑO**: UTC proporcionado antes de publicar puede ser anterior al corte real.
- **W09:** acción Firebase live presente; ejecución real NO PROBADA.
- **W10/W13:** **PENDIENTES**: no hay prueba real de login, roles, PC/móvil ni flujo operativo.
- **W11:** rollback poscorte está bloqueado por el SQL; falta procedimiento coordinado de reparación frontend/backend.
- **W12:** exclusión mutua presente; protección del entorno NO COMPROBADA.

## Bloqueos de liberación

No ejecutar `publish` hasta corregir W04, W05, W06, W08, W11 y verificar la configuración del entorno. La prueba aislada GO del PR #145 **no sustituye** estos controles de publicación.

No se modificaron datos ni se ejecutaron workflows productivos al preparar este plan.
