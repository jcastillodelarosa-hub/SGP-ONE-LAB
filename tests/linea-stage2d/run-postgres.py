"""PostgreSQL17 real sessions; captured real validation BODY on SYNTHETIC tables/data.
No productive Supabase connection. New unit IDs/proofs exist only in QA.
"""
import pathlib,json,runpy,uuid,threading,subprocess,sys,time
from concurrent.futures import ThreadPoolExecutor
R=pathlib.Path(__file__).resolve().parents[2];E=R/'tests/linea-stage2d/evidence'
if '--reuse-base' not in sys.argv:
 paths=list((R/'tests/linea-stage2c/evidence').glob('*'));old={p:p.read_bytes() for p in paths}
 try:
  c=runpy.run_path(str(R/'tests/linea-stage2c/run-postgres.py'))
  inherited=json.loads((R/'tests/linea-stage2c/evidence/postgres.json').read_text())
  b2=json.loads((R/'tests/linea-stage2c/evidence/regression-b2.json').read_text())
 finally:
  for p,data in old.items():p.write_bytes(data)
 for name,d in [('regression-c2',inherited),('regression-b2',b2)]: (E/(name+'.json')).write_text(json.dumps(d,indent=2)+'\n')
 template=inherited['database'];(E/'base.txt').write_text(template+'\n')
else:
 inherited=json.loads((E/'regression-c2.json').read_text());template=(E/'base.txt').read_text().strip()
assert template.startswith('sgp_linea_b2_qa_') and template.removeprefix('sgp_linea_b2_qa_').isdigit()
db='sgp_linea_d2_qa_'+str(time.time_ns())
subprocess.run(['docker','exec','sgp-pdt-qa-91','createdb','-U','postgres','-T',template,db],check=True)
def run(q):return subprocess.run(['docker','exec','-i','sgp-pdt-qa-91','psql','-XqAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True)
def sql(q):
 r=run(q)
 if r.returncode:raise RuntimeError(r.stderr)
 return r.stdout.strip()
def lit(x):return "'"+str(x).replace("'","''")+"'"
def js(x):return lit(json.dumps(x))+'::jsonb'
def cmd(op,key=None,stage='ENSAMBLE',date='2026-10-27',shift=1,revision=0,**kw):
 x={'id':str(uuid.uuid4()),'op':op,'stage':stage,'date':date,'shift':shift,'revision':revision,**kw}
 if key:x['key']=key
 return x
def call(token,x):return 'SELECT public.sgp_linea_motor_b2('+lit(token)+','+js(x)+');'
def execute(x,token='COORDINADOR'):return json.loads(sql(call(token,x)))
u=lambda:str(uuid.uuid4())
sql('''CREATE TABLE public.sgp_mecanizado_programacion(id_programacion uuid PRIMARY KEY,reserva text,sistema text,estado text);
CREATE TABLE public.sgp_picking_entregas(id_entrega uuid PRIMARY KEY,id_programacion uuid,produccion text,completa boolean,estado text,usuario_validacion text,fecha_validacion timestamptz,observacion_validacion text);
CREATE TABLE public.sgp_aluminio(id_pieza text PRIMARY KEY,tipo_pieza text,activo text);
CREATE TABLE public.sgp_aluminio_pendientes(id_pendiente uuid PRIMARY KEY DEFAULT gen_random_uuid(),key_produccion text,reserva text,reserva_principal text,es_reserva_compartida boolean,acabado_pendiente text,produccion text,perfil text,cantidad numeric,longitud numeric,origen text,causa text,observacion text,estado text,usuario_reporte text,id_pieza text,marca text,fabricacion text,estado_repo text,ventanas_afectadas integer,auditado boolean,nc text);
CREATE TABLE public.sgp_picking_faltantes(id_faltante uuid PRIMARY KEY,id_entrega uuid,id_pieza text,produccion text,reserva_pendiente text,acabado_pendiente text,cantidad numeric,ventanas_afectadas integer,auditado boolean,usuario_auditoria text,fecha_auditoria timestamptz);
CREATE TABLE public.sgp_picking_auditoria_diferencias(id_diferencia uuid PRIMARY KEY DEFAULT gen_random_uuid(),id_entrega uuid,id_pieza text,perfil text,marca text,fabricacion text,longitud numeric,cantidad numeric,ventanas_afectadas int,observacion text,usuario_auditoria text,reserva_pendiente text,acabado_pendiente text);
CREATE TABLE public.qa_produccion_reservas(key_produccion text,produccion text,reserva text,reserva_principal text,es_reserva_compartida boolean,semana_produccion int,acabado_reserva text);
CREATE VIEW public.sgp_produccion_reservas_v AS SELECT * FROM public.qa_produccion_reservas;
CREATE TABLE public.sgp_aluminio_pendiente_detalles(id_detalle uuid PRIMARY KEY,id_pendiente uuid,id_pieza text);
CREATE TABLE public.sgp_pdt_fuentes(id_detalle uuid PRIMARY KEY,id_pieza text,id_carga text,fila_origen int,snapshot jsonb);
CREATE TABLE public.sgp_pdt_entrega_lineas(id_linea uuid PRIMARY KEY,id_entrega uuid,id_detalle uuid,id_pieza text,cantidad int,estado text);
''')
funcs=json.loads((R/'scripts/pdt-compatibility/evidence/PDT_FUNCIONES_REALES.json').read_text())['funciones']
for f in funcs:
 if f['firma'].startswith(('sgp_validar_sesion_rol(','sgp_picking_validar_recepcion(')):sql(f['definicion'])
authhash=sql("SELECT md5(pg_get_functiondef('public.sgp_validar_sesion_rol(text,text[])'::regprocedure))")
validationhash=sql("SELECT md5(pg_get_functiondef('public.sgp_picking_validar_recepcion(text,uuid,jsonb,jsonb,text)'::regprocedure))")
install=(R/'docs/sql-proposals/linea-etapa2d/01_unit_links_REVIEW.sql').read_text()
r=run(install.replace('COMMIT;','SELECT 1/0;COMMIT;'));assert r.returncode
assert sql("SELECT to_regnamespace('sgp_linea_d2') IS NULL")=='t'
sql(install)
# Router is QA-only. This is NOT a reader installed/certified for production.
sql("CREATE FUNCTION qa_c2.pdt_d2(k text) RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path='' AS $$BEGIN IF left(k,3)='D2-' THEN RETURN sgp_linea_d2.impacto(k);END IF;RETURN qa_c2.pdt(k);END$$;")
sql("UPDATE sgp_linea_c2.lectores SET firma='qa_c2.pdt_d2(text)',huella=md5(pg_get_functiondef('qa_c2.pdt_d2(text)'::regprocedure)),catalogo_huella=(SELECT md5(jsonb_build_object('owner',pg_get_userbyid(proowner),'acl',coalesce(proacl::text,'DEFAULT'),'definer',prosecdef,'config',proconfig)::text) FROM pg_proc WHERE oid='qa_c2.pdt_d2(text)'::regprocedure) WHERE componente='PDT'")
checks=['Captured real reception validation/authorization installed unchanged; new D2 install failure rolls back']
def lock(k):return f"SELECT revision FROM sgp_linea_b2.producciones WHERE key={lit(k)} FOR UPDATE;"
def source_change(k,q):return sql('BEGIN;'+lock(k)+f"SELECT sgp_linea_c2.notificar({lit(k)},'PDT');"+q+'COMMIT;')
def sync(k):
 r=json.loads(sql(f"SELECT sgp_linea_c2.reconciliar({lit(k)})"))
 if r.get('status')=='READY':r['available']=avail(k).get('available')
 return r
def avail(k):return json.loads(sql(f"SELECT sgp_linea_b2.disponible({lit(k)})"))
def seed(k,n=20):
 sql(f"INSERT INTO public.sgp_producciones VALUES({lit(k)});INSERT INTO sgp_linea_b2.producciones(key) VALUES({lit(k)});")
 identity={'production':k,'line':'PANELES_2','part':'PART-'+k,'reserves':['R-MAIN','R-SHARED']}
 base={'production':k,'revision':'1','generation':1,'complete':True,'sourceRef':'QA/'+k,'identity':identity}
 ex={**base,'applied':True,'assembled':n,'packed':0,'events':[],'loadId':'QA-load-'+k,'historyId':'QA-history-'+k};pd={**base,'items':[]};pe={**base,'grants':[{'user':user,'stage':stage,'sourceRef':'QA-scope','sourceVersion':'1'} for user in ['COORDINADOR','LIDER','CONSULTA'] for stage in ['ENSAMBLE','EMPAQUE']]}
 for component,data in [('EXPORT',ex),('PDT',pd),('PERMISOS',pe)]:sql(f"INSERT INTO qa_c2.fuentes VALUES({lit(k)},{lit(component)},{js(data)})")
 ex['assembled']=n;ex['identity']['part']='PART-'+k
 pe['identity']=ex['identity'];pd['identity']=ex['identity']
 for comp,data in [('EXPORT',ex),('PDT',pd),('PERMISOS',pe)]:sql(f"UPDATE qa_c2.fuentes SET data={js(data)} WHERE key={lit(k)} AND component={lit(comp)}")
 source_change(k,f"INSERT INTO sgp_linea_d2.cobertura VALUES({lit(k)},{js(ex['identity'])},1,'QA-PHYSICAL-SOURCE','{{}}');INSERT INTO sgp_linea_d2.unidades SELECT {lit(k)},'QA-U'||i,'R-SHARED',{lit('PART-'+k)},true,false,'QA-UNIT-REGISTER','1' FROM generate_series(1,{n}) i;")
 sql(f"INSERT INTO public.qa_produccion_reservas VALUES({lit(k)},{lit('PROD-'+k)},'R-SHARED','R-MAIN',true,44,'QA-FINISH')")
 return ex
def pending(k,n=3,diff=False):
 p,e,mp,f,piece=u(),u(),u(),u(),'QA-PIECE-'+u()
 sql(f"INSERT INTO sgp_aluminio VALUES({lit(piece)},'PANEL','SI');INSERT INTO sgp_mecanizado_programacion VALUES('{mp}','R-MAIN','QA-SYSTEM','PROCESADO');INSERT INTO sgp_picking_entregas(id_entrega,id_programacion,produccion,estado) VALUES('{e}','{mp}',{lit('PROD-'+k)},'PENDIENTE_VALIDACION');INSERT INTO sgp_picking_faltantes(id_faltante,id_entrega,id_pieza,produccion,reserva_pendiente,cantidad) VALUES('{f}','{e}',{lit(piece)},{lit('PROD-'+k)},'R-SHARED',7);INSERT INTO sgp_aluminio_pendientes(id_pendiente,key_produccion,reserva,reserva_principal,produccion,id_pieza,estado,origen) VALUES('{p}',{lit(k)},'R-SHARED','R-MAIN',{lit('PROD-'+k)},{lit(piece)},'PENDIENTE','PICKING');")
 differences=[{'id_pieza':piece,'perfil':'QA-DIFF','cantidad':1,'ventanas_afectadas':1,'reserva':'R-SHARED','acabado':'QA-FINISH'}] if diff else []
 sql("SELECT public.sgp_picking_validar_recepcion('COORDINADOR',"+lit(e)+'::uuid,'+js([{'id_faltante':f,'id_pieza':piece,'ventanas_afectadas':n}])+','+js(differences)+",'QA only')")
 source_change(k,f"UPDATE sgp_linea_d2.cobertura SET pendientes=array_append(pendientes,'{p}'::uuid),generation=generation+1 WHERE key={lit(k)};")
 return {'p':p,'e':e,'f':f,'piece':piece,'k':k}
def source(x):return json.loads(sql(f"SELECT sgp_linea_d2.fuente('{x['p']}','{x['e']}','{x['f']}')"))
def association(x,ids,stage='ENSAMBLE',revision=0,event=None,token='COORDINADOR'):
 return f"SELECT sgp_linea_d2.asociar({lit(token)},{lit(x['k'])},'{x['p']}','{x['e']}','{x['f']}',{lit(stage)},ARRAY["+','.join(lit(z) for z in ids)+f"]::text[],{revision},{lit(source(x)['hash'])},'{event or u()}','QA explicit physical selection');"
def assign(x,ids,**kw):return json.loads(sql(association(x,ids,**kw)))
seed('D2-FULL');assert sync('D2-FULL')['available']==20
checks.append('Complete order without PDT: 20 assembled, 0 packed => 20 available; no inferred impact')
seed('D2-PARTIAL');x=pending('D2-PARTIAL',3)
assert sql(f"SELECT ventanas_afectadas FROM sgp_picking_faltantes WHERE id_faltante='{x['f']}'")=='3'
assert sql(f"SELECT cantidad FROM sgp_picking_faltantes WHERE id_faltante='{x['f']}'")=='7'
assert sync('D2-PARTIAL')['status']=='SIN_CONCILIAR'
assert avail('D2-PARTIAL')['status']=='UNKNOWN'
source_change('D2-PARTIAL',"UPDATE sgp_linea_d2.unidades SET reserva='R-MAIN' WHERE key='D2-PARTIAL' AND id='QA-U1';")
assign(x,['QA-U1','QA-U2','QA-U3']);assert sync('D2-PARTIAL')['available']==17
checks.append('Actual captured validator persists integer3 beside 7 pieces; without explicit unit links blocked, with QA links20-3=17')
y=pending('D2-PARTIAL',2);assign(y,['QA-U2','QA-U3']);assert sync('D2-PARTIAL')['available']==17
z=pending('D2-PARTIAL',1);assign(z,['QA-U4'],stage='EMPAQUE');assert sync('D2-PARTIAL')['available']==17
checks.append('Overlapping PDT unit union counts once, EMPAQUE pending remains independent')
# Shared reservations cannot accept units from another production or part.
seed('D2-OTHER');w=pending('D2-OTHER',1)
r=run(association(w,['MISSING']));assert r.returncode and 'UNIDADES_NO_DEMOSTRADAS' in r.stderr
source_change('D2-OTHER',"UPDATE sgp_linea_d2.unidades SET parte='OTHER-PART' WHERE key='D2-OTHER' AND id='QA-U1';")
r=run(association(w,['QA-U1']));assert r.returncode and 'UNIDADES_NO_DEMOSTRADAS' in r.stderr
r=run(association(w,['QA-U2'],token='RECEPCION'));assert r.returncode and 'PERMISO_DENEGADO' in r.stderr
r=run(association(w,['QA-U2'],token='LIDER'));assert r.returncode and 'OPERACION_NO_AUTORIZADA' in r.stderr
checks.append('Shared reserve/production/part identity and actual role+server stage scope enforced, no fabricated units')
# NC state alone never releases a unit; source fingerprint changes invalidate.
source_change(x['k'],f"UPDATE sgp_aluminio_pendientes SET nc='QA-NC-CLOSED' WHERE id_pendiente='{x['p']}';")
assert sync(x['k'])['status']=='SIN_CONCILIAR'
assign(x,['QA-U1','QA-U2','QA-U3'],revision=1);assert sync(x['k'])['available']==17
checks.append('Closed NC is not physical replenishment; source change requires explicit reviewed re-link and keeps blocks')
# Complement line validation alone cannot release windows; needs explicit physical unit evidence.
det,line,delivery=u(),u(),u()
sql(f"INSERT INTO sgp_aluminio_pendiente_detalles VALUES('{det}','{x['p']}',{lit(x['piece'])});INSERT INTO sgp_pdt_fuentes VALUES('{det}',{lit(x['piece'])},'QA-load',1,'{{}}');INSERT INTO sgp_picking_entregas(id_entrega,id_programacion,produccion,estado) SELECT '{delivery}',id_programacion,produccion,'VALIDADA' FROM sgp_picking_entregas WHERE id_entrega='{x['e']}';INSERT INTO sgp_pdt_entrega_lineas VALUES('{line}','{delivery}','{det}',{lit(x['piece'])},7,'VALIDADA');")
assert sync(x['k'])['available']==17
h=sql(f"SELECT sgp_linea_d2.huella_liberacion('{x['p']}','{line}')");assert h
source_change(x['k'],f"INSERT INTO sgp_linea_d2.liberaciones VALUES({lit(x['k'])},'{x['p']}','QA-U1','{line}',{lit(h)},'QA-PHYSICALLY-OBSERVED-UNIT-CLEARANCE','1');")
assert sync(x['k'])['available']==18 # U2/U3 still blocked also by y
source_change(x['k'],f"UPDATE sgp_picking_entregas SET estado='AUDITADA_DIFERENCIA' WHERE id_entrega='{delivery}';")
assert sync(x['k'])['status']=='SIN_CONCILIAR'
source_change(x['k'],f"UPDATE sgp_picking_entregas SET estado='VALIDADA' WHERE id_entrega='{delivery}';")
assert sync(x['k'])['available']==18
checks.append('Complement VALIDADA + per-unit physical proof releases only explicit unit; AUDITADA_DIFERENCIA cannot credit or release')
# New differences lack automatic pending<->difference identity. No historical reconstruction.
seed('D2-DIFF');d=pending('D2-DIFF',2,True)
assert sql(f"SELECT estado FROM sgp_picking_entregas WHERE id_entrega='{d['e']}'")=='AUDITADA_DIFERENCIA'
assign(d,['QA-U1','QA-U2'])
assert sync('D2-DIFF')['status']=='SIN_CONCILIAR' # coverage sees the additional unmatched PDT
checks.append('Validation with differences creates aggregated PDT; uncovered new difference blocks, no guessed historical link')
# Real PG transactions for link CAS and retries.
seed('D2-RACE');t=pending('D2-RACE',2);event=u();q=association(t,['QA-U1','QA-U2'],event=event)
def races(queries):
 barrier=threading.Barrier(len(queries))
 def task(q):barrier.wait();return run("BEGIN;SET LOCAL lock_timeout='5s';"+q+"SELECT pg_sleep(.1);COMMIT;")
 with ThreadPoolExecutor(max_workers=len(queries)) as pool:return list(pool.map(task,queries))
rs=races([q,q]);assert all(r.returncode==0 for r in rs)
assert sql(f"SELECT count(*) FROM sgp_linea_d2.vinculos WHERE evento='{event}'")=='1'
rs=races([association(t,['QA-U2','QA-U3'],revision=1),association(t,['QA-U3','QA-U4'],revision=1)])
assert sum(r.returncode==0 for r in rs)==1
assert sync('D2-RACE')['available']==18
checks.append('REAL PG: concurrent identical UUID inserts one immutable link; distinct edits CAS rejects stale revision')
# New shift date avoids unrelated existing C2 rows after reader registry update.
for shift in [1,2]:
 execute(cmd('ABRIR',stage='EMPAQUE',date='2026-10-28',shift=shift))
 execute(cmd('SALE','D2-RACE',stage='EMPAQUE',date='2026-10-28',shift=shift,quantity=20,observation='QA D2 race'))
def packing(shift):return call('LIDER',cmd('EJECUTAR','D2-RACE',stage='EMPAQUE',date='2026-10-28',shift=shift,revision=1,quantity=12))
rs=races([packing(1),packing(2)]);assert sum(r.returncode==0 for r in rs)==1
assert avail('D2-RACE')['available']==6
checks.append('REAL PG: two shifts cannot double-consume 18 eligible units; already packed included in remaining6')
# Raw-source correction vs reader with cooperative production-first writer.
q=f"SELECT sgp_linea_c2.notificar('D2-RACE','PDT');UPDATE sgp_picking_faltantes SET ventanas_afectadas=1 WHERE id_faltante='{t['f']}';"
rs=races([q,"SELECT sgp_linea_c2.reconciliar('D2-RACE');"]);assert rs[0].returncode==0
assert sync('D2-RACE')['status']=='SIN_CONCILIAR'
checks.append('REAL PG: Picking source correction vs reconciliation invalidates previously mapped evidence')
for role in ['anon','authenticated']:
 assert run('SET ROLE '+role+';'+q).returncode
 assert run('SET ROLE '+role+";SELECT * FROM sgp_linea_d2.unidades").returncode
checks.append('Browser has no unit registry access, no source proof writes and no RLS bypass')
assert sql("SELECT md5(pg_get_functiondef('public.sgp_validar_sesion_rol(text,text[])'::regprocedure))")==authhash
assert sql("SELECT md5(pg_get_functiondef('public.sgp_picking_validar_recepcion(text,uuid,jsonb,jsonb,text)'::regprocedure))")==validationhash
assert run("UPDATE sgp_linea_d2.vinculos SET motivo='overwrite'").returncode
out={'status':'PASS','database':db,'postgres':inherited['postgres'],'checks':checks,'captured_function_hashes':{'validation':validationhash,'legacy_authorization':authhash},'real_source_status':'PENDING: no live Supabase access, no physical unit register or trusted coverage source certified','limits':['Captured function body executed against minimal compatible SYNTHETIC schema, not production clone','New difference to PDT FK unverified: that integration intentionally blocked','Complement physical source proof is synthetic; not proof of plant delivery','No legacy/Picking operative functions changed; no SQL applied productively']}
(E/'database.txt').write_text(db+'\n');(E/'postgres.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
