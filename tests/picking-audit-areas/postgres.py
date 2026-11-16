"""PostgreSQL 17 multiconnection test. Synthetic auth/PDT only, no production."""
import os,pathlib,uuid,time,threading
import psycopg
from psycopg.types.json import Jsonb
root=pathlib.Path(__file__).resolve().parents[2];url=os.environ['TEST_DATABASE_URL']
def conn():return psycopg.connect(url,autocommit=True)
def read(p):return (root/p).read_text()
a=conn();b=conn()
try:
 a.execute(read('tests/picking-audit-areas/fixture.sql'))
 a.execute(read('docs/sql-proposals/picking-audit/01-review.sql'))
 a.execute(read('docs/sql-proposals/picking-audit-areas/install-review.sql'))
 ent,prog=str(uuid.uuid4()),str(uuid.uuid4())
 a.execute("insert into sgp_mecanizado_programacion values(%s,'R47','SYS','A')",[prog])
 a.execute("insert into sgp_producciones values('QA|PANELES_2','QA','PANELES_2',5)")
 a.execute("insert into sgp_prioridades values('QA|PANELES_2','R47','PANELES_2')")
 a.execute("insert into sgp_picking_entregas(id_entrega,id_programacion,produccion,completa) values(%s,%s,'QA',true)",[ent,prog])
 def context(c):return c.execute('select sgp_picking_auditoria_areas_contexto(%s,%s)',['RECEPCION:test',ent]).fetchone()[0]
 version=context(a)['version'];req=str(uuid.uuid4())
 sql='select sgp_picking_auditoria_area_guardar(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)'
 def args(area,version,request):return ['RECEPCION:'+area,ent,version,request,'2026-11-16','TURNO 1',Jsonb([]),Jsonb([]),'synthetic concurrent test',area,'SIN_FALTANTES']
 a.execute('begin');first=a.execute(sql,args('VERTICALES',version,req)).fetchone()[0];assert first['finalizada'] is False
 started=threading.Event();done=threading.Event();result={}
 def competing():
  started.set()
  try:result['value']=b.execute(sql,args('ZOCALERO',version,str(uuid.uuid4()))).fetchone()[0]
  except Exception as e:result['error']=str(e)
  finally:done.set()
 t=threading.Thread(target=competing);t.start();started.wait(2);time.sleep(.3);assert not done.is_set(),'second connection must wait for delivery lock'
 a.execute('commit');t.join(10);assert done.is_set();assert 'CONFLICTO_RECARGAR' in result.get('error',''),result
 assert a.execute('select count(*) from sgp_picking_audit_areas.revisiones where id_entrega=%s',[ent]).fetchone()[0]==1
 final=b.execute(sql,args('ZOCALERO',context(b)['version'],str(uuid.uuid4()))).fetchone()[0];assert final['finalizada'] is True
 assert a.execute('select count(*) from sgp_picking_audit.eventos where id_entrega=%s',[ent]).fetchone()[0]==1
 replay=a.execute(sql,args('VERTICALES',version,req)).fetchone()[0];assert replay==first
 print('PASS PostgreSQL17: two connections serialize; stale snapshot rejected; refreshed second review closes once; replay stable')
finally:a.close();b.close()
