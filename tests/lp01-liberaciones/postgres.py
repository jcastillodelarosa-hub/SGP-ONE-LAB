from pathlib import Path
import sys,json,uuid,threading
from concurrent.futures import ThreadPoolExecutor
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tests/lp01-operacion'))
from postgres import Database,lit
OUT=Path(__file__).parent/'evidence'
def uid():return str(uuid.uuid4())
def run(db):
 key='QA-PDT|PANELES_2';parts=db.seed(key,parts=(90,90,90,18));db.execute(db.cmd('ABRIR'))
 for p in parts:db.execute(db.cmd('SALE',key=key,part=p,quantity=0,observation='QA pendiente de materiales'))
 before=db.sql('SELECT jsonb_agg(to_jsonb(x)) FROM public.sgp_producciones x')
 db.sql((ROOT/'docs/sql-proposals/lp01-operacion/07_pdt_asociacion_REVIEW.sql').read_text())
 def targets(part,n):return [{'root':part,'date':'2026-11-01','shift':1,'quantity':n}]
 def call(req,t,e=None,token='COORDINADOR',stage='ENSAMBLE'):
  return 'SELECT sgp_lp_operacion.pdt_asociar('+','.join([lit(token),lit(req),lit(key),lit(stage),lit(json.dumps(t))+'::jsonb','NULL' if e is None else lit(e),lit('QA consolidación inequívoca de ventanas')])+');'
 def receipt(e,before_n,after_n,prev=None,stage='ENSAMBLE'):
  db.sql('INSERT INTO sgp_lp_operacion.pdt_evidencias VALUES('+','.join([lit(e),lit(key),lit(stage),lit('V4'),lit(uid()),'1',lit(uid()),'1',lit(uid()),lit('PRODUCTION_STAGE_UNION'),str(before_n),str(after_n),'NULL' if prev is None else lit(prev),"now()-interval '1 minute'",lit('QA trusted emitter fixture')])+')')
 req=uid();t=targets(parts[0],4)+targets(parts[1],3)
 assert json.loads(db.sql(call(req,t)))['status']=='PENDIENTE_COORDINADOR'
 assert db.sql('SELECT count(*) FROM sgp_lp_operacion.liberaciones')=='0'
 e=uid();receipt(e,15,8)
 assert db.run("INSERT INTO sgp_lp_operacion.pdt_evidencias SELECT gen_random_uuid(),key,etapa,'V2',gen_random_uuid(),version,entrega,entrega_version,historial,alcance,antes,despues,anterior,acreditado_en,emisor FROM sgp_lp_operacion.pdt_evidencias WHERE id="+lit(e)).returncode
 assert json.loads(db.sql(call(req,t,e)))['allocated']==7
 assert json.loads(db.sql(call(req,t,e)))['duplicate']
 assert db.run(call(req,targets(parts[0],5),e)).returncode
 assert db.run(call(uid(),targets(parts[2],1),e)).returncode
 ids=json.loads(db.sql("SELECT jsonb_object_agg(a.raiz,a.liberacion) FROM sgp_lp_operacion.pdt_asociaciones a"))
 wrong=db.cmd('LIBERAR',key=key,part=parts[2],release_id=ids[parts[0]],observation='QA wrong root')
 db.reject(wrong,'LIBERACION_SIN_ASOCIACION_VIGENTE')
 assert next(r for r in db.snapshot()['orders'] if r['parte']==parts[2])['sale']==0
 c=db.cmd('LIBERAR',key=key,part=parts[0],release_id=ids[parts[0]],observation='QA entrega acreditada')
 gate=threading.Barrier(2)
 def one(_):gate.wait();return db.run('SET ROLE anon;'+db.call('COORDINADOR',c))
 with ThreadPoolExecutor(2) as pool:results=list(pool.map(one,range(2)))
 assert all(r.returncode==0 for r in results)
 assert next(r for r in db.snapshot()['orders'] if r['parte']==parts[0])['sale']==4
 assert db.sql('SELECT count(*) FROM sgp_lp_operacion.auditoria WHERE id='+lit(c['id']))=='1'
 e2=uid();receipt(e2,15,8,e)
 assert db.run(call(uid(),targets(parts[2],1),e2)).returncode # repeated overlap, same before/after
 annul='SELECT sgp_lp_operacion.pdt_anular(\'COORDINADOR\','+lit(req)+",'QA anulación posterior');"
 assert json.loads(db.sql(annul))['status']=='REQUIERE_CONCILIACION'
 db.reject(db.cmd('LIBERAR',key=key,part=parts[1],release_id=ids[parts[1]],observation='QA revoked'),'LIBERACION_SIN_ASOCIACION_VIGENTE')
 assert next(r for r in db.snapshot()['orders'] if r['parte']==parts[0])['sale']==4
 db.execute(db.cmd('ABRIR',stage='EMPAQUE'))
 for p in parts:db.execute(db.cmd('SALE',stage='EMPAQUE',key=key,part=p,quantity=0,observation='QA pendiente'))
 ep=uid();receipt(ep,8,6,stage='EMPAQUE');rp=uid()
 assert json.loads(db.sql(call(rp,targets(parts[0],2),ep,stage='EMPAQUE')))['allocated']==2
 assert db.run(call(uid(),targets(parts[0],1),token='LIDER')).returncode
 assert db.run(call(uid(),[{**targets(parts[0],1)[0],'shift':2}])).returncode
 assert before==db.sql('SELECT jsonb_agg(to_jsonb(x)) FROM public.sgp_producciones x')
 assert db.run('SET ROLE anon;'+call(uid(),targets(parts[0],1))).returncode
 assert db.run("UPDATE sgp_lp_operacion.pdt_evidencias SET antes=100 WHERE id="+lit(e)).returncode
 out={'status':'PASS','checks':['Missing physical receipt leaves pending with zero credit','Canonical root distribution 4+3 <= net 15-8; exact retry, changed payload and reused event protected','Wrong-root LIBERAR rolls back SALE and consumption','Real concurrent identical consumption commits once','Repeated overlapping union rejected by predecessor/before continuity','Annulment after consumption freezes pending credits without reducing SALE; reconciliation required','Packing has independent receipt chain; non-coordinator and unopened destination denied', 'Private emitter/evidence immutable, no direct browser access; Export unchanged'],'limits':['Trusted physical receipt is synthetic; no live PDT emitter or delivery coverage certified','No UI or public RPC/grants added; private association preparation only; coordinator service wiring pending'],'postgres':db.sql('SHOW server_version')}
 (OUT/'postgres.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
if __name__=='__main__':
 db=Database()
 try:run(db)
 finally:db.close()
