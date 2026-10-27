# Etapa2B.1 — contratos y límite de evidencia
Base PR121 2164227ae23fefc923ad81fcef74da47ba549ba0, dependiente de117 b923b249.
Rama feat/linea-stage2b-postgres-adapter. Sin frontend ni producción.

Se reutilizan hallazgos del propietario: seis RPC SECURITY DEFINER; cinco EXECUTE
anon/authenticated; arrastrar sin esos grants. Export historial contiene id_carga_diaria,
identidad/saldos/fecha y lotes_carga identifica cargas. Eso no acredita inclusión
movimiento->corte ni equivalencia pieza->unidad. No repetir esas consultas.
Código versionado llama sgp_previsualizar_export_diario/sgp_aplicar_export_diario;
sus cuerpos instalados y columnas exactas de cortes no están disponibles en esta
sesión. No deducir ejecución incluida por fecha, igualdad numérica o saldo.

Diseño aislado: feed privado normalizado de cortes/evidencia, sin API que acepte
cantidades oficiales o flags de navegador; falta vincularlo al catálogo real antes
de producción. PDT sin impacto cuantitativo probado sigue UNKNOWN.
Próximo paso en esta ejecución: schema/RPC aisladas, adaptador al resolvedor121,
pruebas de seguridad y sesiones reales PG17, checkpoint final y PR único sobre121.

## Checkpoint 2B.2 — implementación aislada recuperable

SQL nuevo en docs/sql-proposals/linea-etapa2b/01_motor_REVIEW.sql; esquema privado,
RPC nuevas, RLS y ledger inmutable. Sin ALTER de tablas o funciones legacy.
Adaptador src/server/linea-postgres-repository.js reutiliza createPackingResolver
sin tocar121. Driver PG se inyecta; driver psql de tests no es para producción.

Primer pase PG real PASS: 10 comprobaciones motor + 5 adaptador, incluyendo scopes,
correcciones/cierre/reapertura, idempotencia y tres carreras SQL. Auth usa cuerpo
sgp_sesion_actual capturado, no autorización simulada por flags del navegador.
Tablas de fuentes/cortes/PDT normalizadas son fixtures privadas; bridge productivo
pendiente. Nunca habilitar empaque con esa falta de evidencia.
Pendiente en 2B.3: carrera de cambio de corte/conciliación, PDT por unidad/etapa,
corrección Ensamble concurrente, rollback versionado, pruebas Node y documento final.

## Checkpoint 2B.3 — cierre aislado

16 comprobaciones PostgreSQL17 PASS y cinco del adaptador con sesiones reales.
Rollback instalación, reversión vacía, rechazo con datos y contención verificados.
Detalles de fuentes, contratos, carreras, riesgos y límites en README.md.
No se declara bridge productivo ni compatibilidad completa de RPC no disponibles.
Siguiente paso: revisión del Draft dependiente121. Sin siguiente etapa automática.
