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
