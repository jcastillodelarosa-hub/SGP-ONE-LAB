"""New controls only: scoped Reception, immutable originals, report trace and direct-write denial."""
import pathlib,json
context={'__file__':str(pathlib.Path(__file__).with_name('integration.py'))}
exec(pathlib.Path(__file__).with_name('integration.py').read_text().split("test('aceptar,")[0],context)
context['counter']=int(__import__('os').environ.get('AUDIT_CONTROL_COUNTER','600'))
fixture=context['fixture'];rpc=context['rpc'];sql=context['sql'];save=context['save'];change=context['change'];pending=context['pending']
results=[]
def check(name,fn):fn();results.append({'name':name,'ok':True});print('PASS',name,flush=True)
def scoped():
 f=fixture();snapshot=rpc('sgp_picking_auditoria_contexto','qa-recepcion',f['event']['id_entrega']);assert len(snapshot['fuentes'])==4
 ctx={'id_programacion':f['part'],'produccion':f['prod']}
 for name,args in [('sgp_pdt_registro_fuentes_v4',('PICKING',ctx)),('sgp_picking_piezas_panel',(f['part'],f['prod'])),('sgp_picking_piezas',(f['part'],f['prod']))]:
  rpc(name,'qa-recepcion',*args,ok=False)
 assert rpc('sgp_pdt_registro_fuentes_v4','qa-picking','PICKING',ctx)['ok']
 assert sql('select count(*) from sgp_picking_audit.contextos;')=='0'
 save(f);assert sql('select count(*) from sgp_picking_audit.contextos;')=='0'
check('Recepción obtiene fuentes solo mediante contexto de auditoría; rutas generales denegadas',scoped)
def privileges():
 for role in ['anon','authenticated']:
  assert sql(f"select has_schema_privilege('{role}','sgp_picking_audit','USAGE');")=='f'
  for privilege in ['INSERT','UPDATE','DELETE','TRUNCATE','MAINTAIN']:
   assert sql(f"select has_table_privilege('{role}','sgp_picking_auditoria_diferencias','{privilege}');")=='f'
 assert sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='sgp_picking_audit' and (not p.prosecdef or p.proconfig is distinct from ARRAY['search_path=\"\"']);")=='0'
 assert sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(p.proacl) a where (n.nspname='sgp_picking_audit' or p.proname in ('sgp_picking_auditoria_contexto','sgp_picking_auditoria_guardar')) and a.grantee=0;")=='0'
check('ACL y search_path cerrados; diferencias históricas sin DML directo de anon/authenticated',privileges)
def report():
 f=fixture(3);change(f,'MODIFICAR',1);change(f,'ELIMINAR',2)
 eid=f['event']['id_entrega'];original=sql(f"select jsonb_build_array(fecha_operativa,turno_entrega,fecha_entrega) from sgp_picking_entregas where id_entrega='{eid}';")
 save(f);report=rpc('sgp_picking_reporte_entregas_v1','qa-picking','2026-10-28','2026-10-28',None,None,500,0)
 row=next(x for x in report['rows'] if x['id_entrega']==eid)
 assert row['fecha_recepcion']=='2026-10-30' and row['turno_recepcion']=='TURNO 2'
 assert {d['accion'] for d in row['decisiones_auditoria']}=={'ACEPTAR','MODIFICAR','ELIMINAR'}
 assert len(row['faltantes'])==2 and sum(x['cantidad'] for x in row['faltantes'])==5
 assert original==sql(f"select jsonb_build_array(fecha_operativa,turno_entrega,fecha_entrega) from sgp_picking_entregas where id_entrega='{eid}';")
check('informe conserva originales y expone recepción y tres decisiones; anulado no cuenta',report)
pathlib.Path(__file__).with_name('closure-controls-results.json').write_text(json.dumps({'environment':'PostgreSQL 17.11, synthetic only','passed':len(results),'tests':results},indent=2)+'\n')
