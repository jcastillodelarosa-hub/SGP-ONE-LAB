"""Build and verify exact review package in isolated synthetic PostgreSQL only."""
from pathlib import Path
import sys,json,hashlib
root=Path(__file__).resolve().parents[2];sys.path.insert(0,str(root/'tests/lp01-afectaciones-rpc'));import atomic as f
out=root/'docs/sql-proposals/lp01-order-details';x=f.Fixture()
try:
 db=x.db
 deps=['sgp_lp_afectaciones.actor(text,text,text,text,date,integer)','sgp_lp_operacion.admitir()','sgp_lp_operacion.puede_operar(text,text,text)','public.sgp_lp_afectaciones_comando_v1(text,text,text,date,integer,jsonb)']
 def catalog(sigs):
  return json.loads(db.sql("SELECT jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'definition_md5',md5(pg_get_functiondef(p.oid)),'body_md5',md5(p.prosrc),'owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,'config',p.proconfig,'acl',p.proacl::text) ORDER BY p.oid::regprocedure::text) FROM pg_proc p WHERE p.oid=ANY(ARRAY["+','.join('to_regprocedure('+f.lit(s)+')' for s in sigs)+'])'))
 dependencies=catalog(deps)
 for row in dependencies:
  if '.' not in row['signature'].split('(')[0]:row['signature']='public.'+row['signature']
 for file in ['01_definition_REVIEW.sql','02_glass_nc_REVIEW.sql']:db.sql((out/file).read_text())
 sigs=['public.sgp_lp_order_details_read_v1(text,text,text)','public.sgp_lp_order_note_save_v1(text,text,text,jsonb)','public.sgp_lp_glass_nc_read_v1(text,text,text)','public.sgp_lp_glass_nc_report_v1(text,text,text,date,integer,jsonb,text)','sgp_lp_order_details.authorize(text,text,text,text)','sgp_lp_order_details.immutable()']
 functions=catalog(sigs)
 for row in functions:
  if '.' not in row['signature'].split('(')[0]:row['signature']='public.'+row['signature']
 manifest={'scope':'Synthetic PostgreSQL17.11 expected definitions; compare targeted production preflight before installation, not production evidence','dependencies':dependencies,'functions':functions}
 (out/'activation-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 def checks(rows):
  text=''
  for r in rows:
   sig=r['signature'];text+=" IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure("+f.lit(sig)+") AND md5(pg_get_functiondef(p.oid))="+f.lit(r['definition_md5'])+" AND pg_get_userbyid(p.proowner)="+f.lit(r['owner'])+") THEN RAISE EXCEPTION 'DEFINITION_OR_OWNER_DRIFT: %',"+f.lit(sig)+";END IF;\n"
  return text
 pre="-- REVIEW ONLY: targeted read-only preflight; no grants or flag changes.\nBEGIN READ ONLY;\nSET LOCAL search_path='';\nDO $$ BEGIN\n IF current_user<>'postgres' OR to_regnamespace('sgp_lp_order_details') IS NOT NULL THEN RAISE EXCEPTION 'INSTALL_STATE_CONFLICT';END IF;\n"+checks(dependencies)+" IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sgp_producciones' AND column_name='porc_vidrio' AND data_type='numeric') THEN RAISE EXCEPTION 'EXPORT_PERCENTAGE_COLUMN_MISSING';END IF;\nEND $$;\nSELECT escrituras FROM sgp_lp_operacion.config WHERE id;\nSELECT writes FROM sgp_lp_afectaciones.config WHERE id;\nROLLBACK;\n"
 (out/'00_preflight_READONLY.sql').write_text(pre)
 public=sigs[:4]
 activation="-- REVIEW ONLY: separate explicit approval required. Run only after both definition scripts.\nBEGIN;\nSET LOCAL search_path='';SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';\nDO $$ BEGIN\n IF current_user<>'postgres' THEN RAISE EXCEPTION 'OWNER_REQUIRED';END IF;\n"+checks(functions)+" IF (SELECT writes FROM sgp_lp_order_details.config WHERE id) IS DISTINCT FROM false THEN RAISE EXCEPTION 'ACTIVATION_STATE_CONFLICT';END IF;\n"
 for sig in sigs:
  activation+=" IF EXISTS(SELECT 1 FROM aclexplode((SELECT proacl FROM pg_proc WHERE oid=to_regprocedure("+f.lit(sig)+"))) a WHERE a.grantee<>(SELECT oid FROM pg_roles WHERE rolname='postgres')) THEN RAISE EXCEPTION 'UNEXPECTED_API_ACL';END IF;\n"
 activation+='END $$;\nGRANT EXECUTE ON FUNCTION '+','.join(public)+' TO anon;\nUPDATE sgp_lp_order_details.config SET writes=true WHERE id;\nCOMMIT;\n'
 (out/'03_activate_REVIEW.sql').write_text(activation)
 containment="-- REVIEW ONLY: non-destructive containment of this increment only.\nBEGIN;\nSET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';\nUPDATE sgp_lp_order_details.config SET writes=false WHERE id;\nREVOKE EXECUTE ON FUNCTION "+','.join(public)+" FROM anon;\nCOMMIT;\n-- History, notes, references, existing flags and permissions remain unchanged.\n"
 (out/'04_contain_REVIEW.sql').write_text(containment)
 # Verify the package in this existing synthetic fixture, including exact catalog assertions.
 db.sql(activation);assert db.sql('SELECT writes FROM sgp_lp_order_details.config WHERE id')=='t'
 for sig in public:assert db.sql('SELECT has_function_privilege(\'anon\','+f.lit(sig)+",'EXECUTE')")=='t'
 db.sql(containment);assert db.sql('SELECT writes FROM sgp_lp_order_details.config WHERE id')=='f'
 for sig in public:assert db.sql('SELECT has_function_privilege(\'anon\','+f.lit(sig)+",'EXECUTE')")=='f'
 (out/'package-sha256.json').write_text(json.dumps({p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(out.glob('*REVIEW.sql'))}|{'00_preflight_READONLY.sql':hashlib.sha256((out/'00_preflight_READONLY.sql').read_bytes()).hexdigest()},indent=2)+'\n')
 print('PASS synthetic package: exact definitions/owner guards, anon grants, local activation and non-destructive containment; no productive calls')
finally:x.close()
