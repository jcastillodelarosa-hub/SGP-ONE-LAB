from pathlib import Path
import sys,json,uuid
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tests/lp01-operacion'))
from postgres import Database,lit
HERE=Path(__file__).parent
if __name__=='__main__':
 db=Database()
 try:
  db.sql('''CREATE SCHEMA sgp_pdt_manual;
CREATE TABLE public.sgp_pdt_cierres(id_pendiente uuid);
CREATE TABLE public.sgp_aluminio_pendiente_detalles(id_pendiente uuid,id_detalle uuid,cantidad_validada numeric);
CREATE TABLE public.sgp_aluminio_pendiente_movimientos(id_detalle uuid,tipo text,cantidad numeric);
CREATE TABLE public.sgp_picking_entregas(id_entrega uuid,estado text);
CREATE TABLE sgp_pdt_manual.entregas(id_detalle uuid,id_entrega uuid,estado text,asignado_en timestamptz,cantidad numeric);''')
  definition=next(x['definition'] for x in json.loads((HERE/'catalog-readonly.json').read_text())['definitions'] if x['signature']=='sgp_pdt_manual.cierre_acreditado(uuid)');db.sql(definition)
  p=str(uuid.uuid4());d=str(uuid.uuid4());e=str(uuid.uuid4());query='SELECT sgp_pdt_manual.cierre_acreditado('+lit(p)+')'
  db.sql('INSERT INTO public.sgp_pdt_cierres VALUES('+lit(p)+');INSERT INTO public.sgp_aluminio_pendiente_detalles VALUES('+lit(p)+','+lit(d)+',10);INSERT INTO public.sgp_aluminio_pendiente_movimientos VALUES('+lit(d)+",'AVANCE',10);INSERT INTO public.sgp_picking_entregas VALUES("+lit(e)+",'VALIDADA');INSERT INTO sgp_pdt_manual.entregas VALUES("+lit(d)+','+lit(e)+",'VALIDADA',now(),6)")
  assert db.sql(query)=='f'
  db.sql('UPDATE sgp_pdt_manual.entregas SET cantidad=10 WHERE id_detalle='+lit(d));assert db.sql(query)=='t'
  db.sql("UPDATE sgp_pdt_manual.entregas SET estado='ANULADA' WHERE id_detalle="+lit(d));assert db.sql(query)=='f'
  out={'status':'PASS','cases':['Real captured coverage rejects partial 6/10 material delivery','Real captured coverage accepts assigned/validated 10/10 pieces; not proof of LP windows','Real captured coverage rejects annulled material delivery'],'scope':'PG17.11 synthetic dependency tables and exact captured manual coverage function; no productive cases or source events certified'}
  (HERE/'evidence/postgres.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
 finally:db.close()
