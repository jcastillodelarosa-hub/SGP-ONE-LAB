"""Fixed-case read-only catalog/predicate comparison. Never invoke operational RPCs."""
import json,os,pathlib,subprocess,tempfile
SQL="""BEGIN READ ONLY; SET LOCAL statement_timeout='20s';
WITH p AS (SELECT * FROM public.sgp_aluminio_pendientes WHERE id_pendiente='5e054eb1-4f79-4960-9add-73b782283939'::uuid AND reserva='8558585'),
candidates AS (
 SELECT a.id_pieza,a.id_carga,a.fila_origen,a.fabricacion,a.longitud,a.acabado,a.cantidad,a.sistema,a.key_produccion,a.produccion,a.codigo_sap,
 a.key_produccion=p.key_produccion AS same_key,a.produccion=p.produccion AS same_name,
 EXISTS(SELECT 1 FROM public.sgp_producciones prod WHERE prod.key_produccion=a.key_produccion) AS production_join,
 EXISTS(SELECT 1 FROM public.sgp_producciones prod WHERE prod.key_produccion=a.key_produccion AND upper(btrim(a.sistema))=upper(btrim(prod.sistema))) AS system_match,
 (p.acabado_pendiente IS NULL OR upper(btrim(a.acabado))=upper(btrim(p.acabado_pendiente))) AS pending_finish,
 EXISTS(SELECT 1 FROM public.sgp_produccion_reservas_v r WHERE r.key_produccion=p.key_produccion AND r.reserva=p.reserva AND (r.acabado_reserva IS NULL OR upper(btrim(r.acabado_reserva))=upper(btrim(a.acabado)))) AS reservation_finish
 FROM public.sgp_aluminio a CROSS JOIN p WHERE a.activo='SI' AND a.tipo_pieza='PANEL' AND btrim(a.codigo_sap)=btrim(p.perfil)
 AND (a.key_produccion=p.key_produccion OR a.produccion=p.produccion OR substring(a.produccion from '^[[:space:]]*([0-9]+)')=substring(p.produccion from '^[[:space:]]*([0-9]+)'))
)
SELECT jsonb_build_object('pending',(SELECT jsonb_build_object('id',id_pendiente,'key',key_produccion,'production',produccion,'reserva',reserva,'perfil',perfil,'finish',acabado_pendiente,'contract',contrato_pdt,'cantidad',cantidad) FROM p),
 'production_context',(SELECT jsonb_agg(jsonb_build_object('key',prod.key_produccion,'sistema',prod.sistema)) FROM public.sgp_producciones prod JOIN p ON prod.key_produccion=p.key_produccion),
 'functions',(SELECT jsonb_agg(jsonb_build_object('signature',f.oid::regprocedure::text,'definition',pg_get_functiondef(f.oid),'md5',md5(pg_get_functiondef(f.oid)))) FROM pg_proc f JOIN pg_namespace n ON n.oid=f.pronamespace WHERE n.nspname='public' AND f.proname IN ('sgp_aluminio_pendiente_piezas','sgp_pdt_fuentes_v2','sgp_aluminio_pendiente_validar_detalles_v1')),
 'candidates',(SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) FROM candidates c));
ROLLBACK;
"""
def main():
 if os.environ.get('GITHUB_ACTIONS')!='true':raise RuntimeError('Protected runner required')
 with tempfile.TemporaryDirectory(prefix='pdt-read-ca-') as d:
  ca=pathlib.Path(d)/'ca.crt';certs=pathlib.Path(__file__).with_name('certs')
  ca.write_bytes(pathlib.Path('/etc/ssl/certs/ca-certificates.crt').read_bytes()+b'\n'+(certs/'prod-ca-2021.crt').read_bytes()+b'\n'+(certs/'prod-ca-2025.crt').read_bytes())
  env=os.environ.copy();env['PGPASSWORD']=os.environ['SUPABASE_DB_PASSWORD']
  cmd=['docker','run','--rm','-i','--log-driver=none','--env','PGPASSWORD','--env','PGHOST=aws-0-us-east-2.pooler.supabase.com','--env','PGPORT=5432','--env','PGDATABASE=postgres','--env','PGUSER=postgres.ocvxbwzqxbrfndkvjmfx','--env','PGSSLMODE=verify-full','--env','PGSSLROOTCERT=/etc/pdt-ca.crt','--env','PGCONNECT_TIMEOUT=20','--env','PGOPTIONS=-c default_transaction_read_only=on','--mount','type=bind,source='+str(ca)+',target=/etc/pdt-ca.crt,readonly','postgres:17','psql','-X','-qAt','-v','ON_ERROR_STOP=1']
  r=subprocess.run(cmd,input=SQL.encode(),env=env,capture_output=True,timeout=90)
  if r.returncode:raise RuntimeError('Read-only case comparison failed')
  data=json.loads(r.stdout)
  if not data['pending']:raise RuntimeError('Observed pending no longer matches; stop')
  print('::notice title=PDT source predicates::'+json.dumps(data,ensure_ascii=False).replace('%','%25'))
if __name__=='__main__':
 try:main()
 except Exception:print('::error title=PDT source predicates::Read-only comparison not verified; no writes');raise SystemExit(1)
