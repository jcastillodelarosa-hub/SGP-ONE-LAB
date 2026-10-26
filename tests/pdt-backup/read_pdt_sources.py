"""Fixed-case read-only catalog/predicate comparison. Never invoke operational RPCs."""
import json,os,pathlib,subprocess,tempfile,sys,zlib,base64
SQL="""BEGIN READ ONLY; SET LOCAL statement_timeout='20s';
WITH p AS (SELECT * FROM public.sgp_aluminio_pendientes WHERE id_pendiente='5e054eb1-4f79-4960-9add-73b782283939'::uuid AND reserva='8558585'),
candidates AS (
 SELECT a.id_pieza,a.id_carga,a.fila_origen,a.fabricacion,a.longitud,a.acabado,a.cantidad,a.sistema,a.key_produccion,a.produccion,a.codigo_sap,
 EXISTS(SELECT 1 FROM public.sgp_producciones pa JOIN public.sgp_producciones pp ON pa.id=pp.id WHERE pa.key_produccion=a.key_produccion AND pp.key_produccion=p.key_produccion AND pa.produccion=pp.produccion AND upper(btrim(pa.sistema))=upper(btrim(pp.sistema))) AS same_production_identity,
 EXISTS(SELECT 1 FROM public.sgp_produccion_reservas_v r WHERE r.key_produccion=a.key_produccion AND r.reserva=p.reserva AND (r.acabado_reserva IS NULL OR upper(btrim(r.acabado_reserva))=upper(btrim(a.acabado)))) AS panel_reservation_finish,
 a.key_produccion=p.key_produccion AS same_key,a.produccion=p.produccion AS same_name,
 EXISTS(SELECT 1 FROM public.sgp_producciones prod WHERE prod.key_produccion=a.key_produccion) AS production_join,
 EXISTS(SELECT 1 FROM public.sgp_producciones prod WHERE prod.key_produccion=a.key_produccion AND upper(btrim(a.sistema))=upper(btrim(prod.sistema))) AS system_match,
 (p.acabado_pendiente IS NULL OR upper(btrim(a.acabado))=upper(btrim(p.acabado_pendiente))) AS pending_finish,
 EXISTS(SELECT 1 FROM public.sgp_produccion_reservas_v r WHERE r.key_produccion=p.key_produccion AND r.reserva=p.reserva AND (r.acabado_reserva IS NULL OR upper(btrim(r.acabado_reserva))=upper(btrim(a.acabado)))) AS reservation_finish
 FROM public.sgp_aluminio a CROSS JOIN p WHERE a.activo='SI' AND a.tipo_pieza='PANEL' AND btrim(a.codigo_sap)=btrim(p.perfil)
 AND (a.key_produccion=p.key_produccion OR a.produccion=p.produccion OR substring(a.produccion from '^[[:space:]]*([0-9]+)')=substring(p.produccion from '^[[:space:]]*([0-9]+)'))
)
SELECT jsonb_build_object('pending',(SELECT jsonb_build_object('id',id_pendiente,'key',key_produccion,'production',produccion,'reserva',reserva,'perfil',perfil,'finish',acabado_pendiente,'contract',contrato_pdt,'cantidad',cantidad) FROM p),
 'production_context',(SELECT jsonb_agg(jsonb_build_object('key',prod.key_produccion,'id',prod.id,'line',prod.id_linea,'production',prod.produccion,'sistema',prod.sistema)) FROM public.sgp_producciones prod JOIN p ON prod.key_produccion=p.key_produccion),
 'functions',(SELECT jsonb_agg(jsonb_build_object('signature',f.oid::regprocedure::text,'definition',pg_get_functiondef(f.oid),'md5',md5(pg_get_functiondef(f.oid)))) FROM pg_proc f JOIN pg_namespace n ON n.oid=f.pronamespace WHERE n.nspname='public' AND f.proname IN ('sgp_aluminio_pendiente_piezas','sgp_pdt_fuentes_v2','sgp_aluminio_pendiente_validar_detalles_v1')),
 'picking_guard',(SELECT jsonb_build_object('md5',md5(pg_get_functiondef(oid)),'same_key_guard',position('key_produccion' IN prosrc)>0) FROM pg_proc WHERE oid='public.sgp_pdt_entrega_registrar_v2(text,uuid,uuid,integer,uuid)'::regprocedure),
 'candidates',(SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) FROM candidates c));
ROLLBACK;
"""
CATALOG_SQL="""BEGIN READ ONLY; SET LOCAL statement_timeout='20s';
SELECT jsonb_build_object('pending',true,'functions',(SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid),'md5',md5(pg_get_functiondef(p.oid)),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'args',pg_get_function_arguments(p.oid))) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND p.proname IN ('sgp_aluminio_pendiente_crear','sgp_clasificar_piezas_aluminio','sgp_mecanizado_perfiles_reserva')),
 'columns',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'column',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid))) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relname IN ('sgp_maestro_piezas','sgp_pdt_key_backup_20261025','sgp_aluminio_pendientes','sgp_mecanizado_novedades')));
ROLLBACK;"""
GUARDS_SQL="""BEGIN READ ONLY; SET LOCAL statement_timeout='20s';
SELECT jsonb_build_object('pending',true,'triggers',(SELECT jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid),'function',t.tgfoid::regprocedure::text,'function_definition',pg_get_functiondef(t.tgfoid),'md5',md5(pg_get_functiondef(t.tgfoid)),'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text)) FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid WHERE t.tgrelid='public.sgp_aluminio_pendientes'::regclass AND NOT t.tgisinternal),
 'references',(SELECT jsonb_agg(jsonb_build_object('relation',conrelid::regclass::text,'definition',pg_get_constraintdef(oid))) FROM pg_constraint WHERE confrelid='public.sgp_aluminio_pendientes'::regclass));
ROLLBACK;"""
COHORT_SQL="""BEGIN READ ONLY; SET LOCAL statement_timeout='20s';
WITH b AS (SELECT to_jsonb(x) data FROM public.sgp_pdt_key_backup_20261025 x),
 cohort AS (SELECT p.*,m.tipo_pieza AS master_tipo,m.destino_productivo AS master_destino,m.activo AS master_activo FROM b JOIN public.sgp_aluminio_pendientes p ON p.id_pendiente::text=b.data->>'id_pendiente' LEFT JOIN public.sgp_maestro_piezas m ON btrim(m.codigo_sap)=btrim(p.perfil))
SELECT jsonb_build_object('pending',true,'backup_count',(SELECT count(*) FROM b),'matched_count',(SELECT count(*) FROM cohort),
 'groups',(SELECT jsonb_agg(to_jsonb(g)) FROM (SELECT split_part(key_produccion,'|',2) line,validacion_estado,estado,estado_repo,master_tipo,master_destino,master_activo,count(*) n FROM cohort GROUP BY 1,2,3,4,5,6,7) g),
 'classifications',(SELECT jsonb_agg(to_jsonb(g)) FROM (SELECT tipo_pieza,destino_productivo,activo,count(*) n FROM public.sgp_maestro_piezas WHERE codigo_sap IN (SELECT perfil FROM cohort) GROUP BY 1,2,3)g),
 'dependent_counts',jsonb_build_object('detalles',(SELECT count(*) FROM public.sgp_aluminio_pendiente_detalles d JOIN cohort c USING(id_pendiente)), 'movimientos',(SELECT count(*) FROM public.sgp_aluminio_pendiente_movimientos d JOIN cohort c USING(id_pendiente)), 'cierres',(SELECT count(*) FROM public.sgp_pdt_cierres d JOIN cohort c USING(id_pendiente)), 'ncs',(SELECT count(*) FROM public.sgp_aluminio_pendiente_ncs d JOIN cohort c USING(id_pendiente))));
ROLLBACK;"""

def main():
 if os.environ.get('GITHUB_ACTIONS')!='true':raise RuntimeError('Protected runner required')
 with tempfile.TemporaryDirectory(prefix='pdt-read-ca-') as d:
  ca=pathlib.Path(d)/'ca.crt';certs=pathlib.Path(__file__).with_name('certs')
  ca.write_bytes(pathlib.Path('/etc/ssl/certs/ca-certificates.crt').read_bytes()+b'\n'+(certs/'prod-ca-2021.crt').read_bytes()+b'\n'+(certs/'prod-ca-2025.crt').read_bytes())
  env=os.environ.copy();env['PGPASSWORD']=os.environ['SUPABASE_DB_PASSWORD']
  cmd=['docker','run','--rm','-i','--log-driver=none','--env','PGPASSWORD','--env','PGHOST=aws-0-us-east-2.pooler.supabase.com','--env','PGPORT=5432','--env','PGDATABASE=postgres','--env','PGUSER=postgres.ocvxbwzqxbrfndkvjmfx','--env','PGSSLMODE=verify-full','--env','PGSSLROOTCERT=/etc/pdt-ca.crt','--env','PGCONNECT_TIMEOUT=20','--env','PGOPTIONS=-c default_transaction_read_only=on','--mount','type=bind,source='+str(ca)+',target=/etc/pdt-ca.crt,readonly','postgres:17','psql','-X','-qAt','-v','ON_ERROR_STOP=1']
  r=subprocess.run(cmd,input=({'--identity-core':CATALOG_SQL,'--identity-guards':GUARDS_SQL,'--identity-cohort':COHORT_SQL}.get(sys.argv[1] if len(sys.argv)>1 else '',SQL)).encode(),env=env,capture_output=True,timeout=90)
  if r.returncode:raise RuntimeError('Read-only case comparison failed')
  data=json.loads(r.stdout)
  if not data['pending']:raise RuntimeError('Observed pending no longer matches; stop')
  payload=base64.b64encode(zlib.compress(json.dumps(data,ensure_ascii=False).encode())).decode()
  parts=[payload[i:i+1700] for i in range(0,len(payload),1700)]
  for index,chunk in enumerate(parts):
   print('::notice title=PDT identity part::'+json.dumps({'index':index,'parts':len(parts),'chunk':chunk},ensure_ascii=False).replace('%','%25'))
if __name__=='__main__':
 try:main()
 except Exception:print('::error title=PDT source predicates::Read-only comparison not verified; no writes');raise SystemExit(1)
