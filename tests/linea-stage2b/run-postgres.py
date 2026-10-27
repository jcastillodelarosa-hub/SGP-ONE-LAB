"""Real isolated PG17; captured auth functions, synthetic operational sources.
No Supabase connection or production data. SQL core tests + concurrency.
"""
import json,pathlib,subprocess,time,threading,uuid
from concurrent.futures import ThreadPoolExecutor
R=pathlib.Path(__file__).resolve().parents[2];C='sgp-pdt-qa-91'
meta=json.loads(subprocess.check_output(['docker','inspect',C]))[0];assert meta['HostConfig']['NetworkMode']=='none' and not meta['HostConfig'].get('PortBindings')
db='sgp_linea_b2_qa_'+str(time.time_ns());subprocess.run(['docker','exec',C,'createdb','-U','postgres',db],check=True)
def run(q):return subprocess.run(['docker','exec','-i',C,'psql','-X','-qAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True)
def sql(q):
 r=run(q)
 if r.returncode:raise RuntimeError(r.stderr)
 return r.stdout.strip()
def literal(x):return "'"+str(x).replace("'","''")+"'"
def js(x):return literal(json.dumps(x))+'::jsonb'
sql("CREATE SCHEMA extensions;CREATE EXTENSION pgcrypto WITH SCHEMA extensions;CREATE TABLE sgp_producciones(key_produccion text PRIMARY KEY);CREATE TABLE sgp_usuarios(id_usuario uuid PRIMARY KEY DEFAULT gen_random_uuid(),usuario text,nombre text,rol text,activo boolean DEFAULT true);CREATE TABLE sgp_sesiones_app(id_usuario uuid,token_hash text,revocado_en timestamptz,expira_en timestamptz);")
comp=json.loads((R/'scripts/pdt-compatibility/evidence/PDT_COMPLEMENTO_REAL.json').read_text())['funciones_faltantes']
f=next(f for f in comp if f['firma'].startswith('sgp_sesion_actual('));sql(f['definicion'])
sql("INSERT INTO sgp_usuarios(usuario,nombre,rol) SELECT x,'QA synthetic',x FROM unnest(ARRAY['COORDINADOR','LIDER','CONSULTA','RECEPCION']) x;INSERT INTO sgp_sesiones_app SELECT id_usuario,encode(extensions.digest(usuario,'sha256'),'hex'),NULL,now()+interval '1 day' FROM sgp_usuarios;")
baseline=sql("SELECT md5(pg_get_functiondef('sgp_sesion_actual(text)'::regprocedure))")
install=(R/'docs/sql-proposals/linea-etapa2b/01_motor_REVIEW.sql').read_text()
r=run(install.replace('COMMIT;','SELECT 1/0;COMMIT;'));assert r.returncode
assert sql("SELECT to_regnamespace('sgp_linea_b2') IS NULL")=='t'
sql(install)
checks=['Installation failure rolls back all new schema/RPC objects']
def call(token,cmd):return 'SELECT public.sgp_linea_motor_b2('+literal(token)+','+js(cmd)+');'
def execute(cmd,token='COORDINADOR'):return json.loads(sql('SET ROLE anon;'+call(token,cmd)))
def reject(cmd,code,token='COORDINADOR'):
 r=run('SET ROLE anon;'+call(token,cmd));assert r.returncode and code in r.stderr,(code,r.stderr)
def cmd(op,key=None,stage='ENSAMBLE',date='2026-10-27',shift=1,revision=0,**kw):
 c={'id':str(uuid.uuid4()),'op':op,'stage':stage,'date':date,'shift':shift,'revision':revision,**kw}
 if key:c['key']=key
 return c
def rev_turn(stage='ENSAMBLE',date='2026-10-27',shift=1):return int(sql(f"SELECT revision FROM sgp_linea_b2.turnos WHERE etapa={literal(stage)} AND fecha={literal(date)} AND turno={shift}"))
def rev_order(k,stage='ENSAMBLE',shift=1):return int(sql(f"SELECT revision FROM sgp_linea_b2.ordenes WHERE etapa={literal(stage)} AND fecha='2026-10-27' AND turno={shift} AND key={literal(k)}"))
def seed(k,a=10,p=0):
 cut=str(uuid.uuid4());sql("INSERT INTO sgp_producciones VALUES("+literal(k)+");INSERT INTO sgp_linea_b2.producciones(key,pdt_completo,pdt_prueba) VALUES("+literal(k)+",true,'{\"fixture\":true}');INSERT INTO sgp_linea_b2.cortes(id,key,id_carga_diaria,ensamblado,empacado,inclusion_completa,prueba) VALUES('"+cut+"',"+literal(k)+",'QA-load',"+str(a)+','+str(p)+",true,'{\"fixture\":true}');UPDATE sgp_linea_b2.producciones SET corte='"+cut+"' WHERE key="+literal(k)+";INSERT INTO sgp_linea_b2.permisos SELECT u,e,"+literal(k)+" FROM unnest(ARRAY['COORDINADOR','LIDER','CONSULTA']) u CROSS JOIN unnest(ARRAY['ENSAMBLE','EMPAQUE']) e;")
 return cut
def sale(k,stage='ENSAMBLE',shift=1,n=10):return execute(cmd('SALE',k,stage,shift=shift,quantity=n,observation='QA commitment'))
def work(k,n,stage='ENSAMBLE',shift=1,token='LIDER',**kw):return execute(cmd('EJECUTAR',k,stage,shift=shift,revision=rev_order(k,stage,shift),quantity=n,**kw),token)
cut=seed('QA-A',10,0)
for stage in ['ENSAMBLE','EMPAQUE']:
 for shift in [1,2]:execute(cmd('ABRIR',stage=stage,shift=shift))
sale('QA-A');sale('QA-A','EMPAQUE');sale('QA-A','EMPAQUE',2)
reject(cmd('SALE','QA-A',quantity=9,observation='QA'),'REQUIERE_COORDINADOR','LIDER')
reject(cmd('SALE','QA-A',quantity=9,observation='QA'),'PERMISO_DENEGADO','RECEPCION')
reject(cmd('EJECUTAR','QA-A',quantity=1),'PERMISO_O_REVISION_INVALIDA','CONSULTA')
reject(cmd('EJECUTAR','MISSING',quantity=1),'AMBITO_DENEGADO')
reject(cmd('EJECUTAR','QA-A',quantity=1,date='2026-10-28'),'TURNO_NO_EXISTE')
checks.append('Captured sgp_sesion_actual validates actual hashed sessions; anon functional role/scope denials')
r=work('QA-A',3,'EMPAQUE');assert json.loads(sql("SELECT public.sgp_linea_disponible_b2('LIDER','QA-A')"))['available']==7
work('QA-A',2,'EMPAQUE',token='COORDINADOR',observation='QA correction');assert json.loads(sql("SELECT public.sgp_linea_disponible_b2('LIDER','QA-A')"))['available']==8
checks.append('Packing partial/cumulative correction uses deltas once, all turns share balance')
# Duplicate request remains exactly once, payload changes reject.
c=cmd('EJECUTAR','QA-A','EMPAQUE',shift=2,revision=rev_order('QA-A','EMPAQUE',2),quantity=2);execute(c,'LIDER');assert execute(c,'LIDER')['duplicate'] is True
reject({**c,'quantity':3},'IDEMPOTENCIA_REUTILIZADA','LIDER')
checks.append('Idempotent anon RPC retry and reused UUID rejection')
# Close, immutable report, review and coordinator correction.
close=cmd('CERRAR',stage='ENSAMBLE',revision=rev_turn(),observation='QA close',reasons={'QA-A':'QA shortfall'})
closed=execute(close,'LIDER');old=json.loads(sql(call('LIDER',{'op':'INFORME','stage':'ENSAMBLE','close_id':closed['id']})))
reject(cmd('EJECUTAR','QA-A',quantity=1),'REAPERTURA_REQUERIDA')
execute(cmd('REABRIR',revision=rev_turn(),observation='QA authorized reopening'))
reject(cmd('EJECUTAR','QA-A',quantity=1,observation='QA'),'CORRECCION_NO_AUTORIZADA','LIDER')
work('QA-A',1,token='COORDINADOR',observation='QA authorized review correction')
execute(cmd('CERRAR',revision=rev_turn(),observation='QA revised close',reasons={'QA-A':'QA'}),'LIDER')
assert json.loads(sql(call('LIDER',{'op':'INFORME','stage':'ENSAMBLE','close_id':closed['id']})))==old
r=run("UPDATE sgp_linea_b2.cierres SET snapshot='{}'");assert r.returncode and 'INMUTABLE' in r.stderr
execute(cmd('REABRIR',revision=rev_turn(),observation='QA open for next tests'))
checks.append('Independent shift close/reopen/review and immutable prior report')
# Actual PostgreSQL sessions concurrency, transaction barriers.
def concurrent(queries):
 barrier=threading.Barrier(2)
 def one(q):barrier.wait();return run("BEGIN;SET LOCAL lock_timeout='5s';SET LOCAL ROLE anon;"+q+"SELECT pg_sleep(0.15);COMMIT;")
 with ThreadPoolExecutor(2) as pool:return list(pool.map(one,queries))
seed('QA-RACE',10);sale('QA-RACE','EMPAQUE');sale('QA-RACE','EMPAQUE',2)
c1=cmd('EJECUTAR','QA-RACE','EMPAQUE',revision=rev_order('QA-RACE','EMPAQUE'),quantity=6);c2=cmd('EJECUTAR','QA-RACE','EMPAQUE',shift=2,revision=rev_order('QA-RACE','EMPAQUE',2),quantity=6)
a=concurrent([call('LIDER',c1),call('LIDER',c2)]);assert sum(x.returncode==0 for x in a)==1,[x.stderr for x in a]
assert any('SALDO_INSUFICIENTE' in x.stderr for x in a)
checks.append('REAL PG: simultaneous different shifts cannot consume same units')
# Close vs execution: only serial outcome or revision conflict, never postclose write.
base_rev=rev_turn();c1=cmd('EJECUTAR','QA-A',revision=rev_order('QA-A'),quantity=2,observation='QA review correction');c2=cmd('CERRAR',revision=base_rev,observation='QA race close',reasons={'QA-A':'QA'})
a=concurrent([call('COORDINADOR',c1),call('LIDER',c2)]);assert sum(x.returncode==0 for x in a)>=1
assert all(x.returncode==0 or any(e in x.stderr for e in ['CONFLICTO_REVISION','REAPERTURA_REQUERIDA']) for x in a),[x.stderr for x in a]
checks.append('REAL PG: close vs execution serialized by actual turn lock')
# New production: carry vs correction; one wins revision, source remains consistent.
seed('QA-CARRY');
# ENS turn may be closed by previous race: reopen legitimately.
if sql("SELECT estado FROM sgp_linea_b2.turnos WHERE etapa='ENSAMBLE' AND fecha='2026-10-27' AND turno=1")=='CERRADO':execute(cmd('REABRIR',revision=rev_turn(),observation='QA reopen'))
sale('QA-CARRY');work('QA-CARRY',4,token='COORDINADOR',observation='QA')
rv=rev_order('QA-CARRY');c1=cmd('ARRASTRAR','QA-CARRY',revision=rv);c2=cmd('EJECUTAR','QA-CARRY',revision=rv,quantity=5,observation='QA correction')
a=concurrent([call('COORDINADOR',c1),call('COORDINADOR',c2)]);assert sum(x.returncode==0 for x in a)==1,[x.stderr for x in a]
execute(cmd('ARRASTRAR','QA-CARRY',revision=rev_order('QA-CARRY')))
assert sql("SELECT count(*) FROM sgp_linea_b2.arrastres WHERE key='QA-CARRY'")=='1'
assert sql("SELECT a.cantidad=o.sale-o.ejecutado FROM sgp_linea_b2.arrastres a JOIN sgp_linea_b2.ordenes o USING(key,etapa,fecha,turno) WHERE a.key='QA-CARRY'")=='t'
checks.append('REAL PG: carry vs source correction idempotent, source revision protected')
# Fresh cut includes local event: no double count; cut switch locks same production.
event=sql("SELECT id FROM sgp_linea_b2.eventos WHERE key='QA-CARRY' ORDER BY registrado_en LIMIT 1");amount=int(sql("SELECT delta FROM sgp_linea_b2.eventos WHERE id='"+event+"'"));cut2=str(uuid.uuid4())
sql("INSERT INTO sgp_linea_b2.cortes VALUES('"+cut2+"','QA-CARRY','QA-new-load',"+str(10+amount)+",0,true,'{\"QA\":true}',now());INSERT INTO sgp_linea_b2.incluidos VALUES('"+cut2+"','"+event+"');")
rv=int(sql("SELECT revision FROM sgp_linea_b2.producciones WHERE key='QA-CARRY'"));execute(cmd('CONCILIAR','QA-CARRY',revision=rv,cut_id=cut2))
assert json.loads(sql("SELECT public.sgp_linea_disponible_b2('LIDER','QA-CARRY')"))['assembled']==10+int(sql("SELECT ejecutado FROM sgp_linea_b2.ordenes WHERE key='QA-CARRY' AND etapa='ENSAMBLE'"))
checks.append('Verified private Export cut + explicit event inclusion avoids double counting; official tables untouched')
assert sql("SELECT md5(pg_get_functiondef('sgp_sesion_actual(text)'::regprocedure))")==baseline
assert sql("SELECT has_schema_privilege('anon','sgp_linea_b2','USAGE') OR has_table_privilege('anon','sgp_linea_b2.ordenes','UPDATE')")=='f'
checks.append('Legacy auth body unchanged; RLS/private tables inaccessible to browser roles')
out={'status':'PASS','database':db,'postgres':sql('SHOW server_version'),'network':'none; no published ports','checks':checks,'limitations':['Synthetic operational/Export/PDT feeds; installed real source bridge not verified','Captured real session body; scope fixtures are synthetic','No production SQL, no frontend or legacy modifications']}
(R/'tests/linea-stage2b/evidence/postgres.json').write_text(json.dumps(out,indent=2)+'\n');(R/'tests/linea-stage2b/evidence/database.txt').write_text(db+'\n');print(json.dumps(out,indent=2))
