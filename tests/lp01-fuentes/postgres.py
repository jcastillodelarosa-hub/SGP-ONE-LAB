from database import SourcesDatabase,HERE
import json
if __name__=='__main__':
 db=SourcesDatabase()
 try:
  db.fixture();before=db.unchanged();sheet=db.rpc('sgp_consultar_ensamble',{'p_token':'LIDER','p_linea':'PANELES_2'})
  row=next(r for r in sheet['filas'] if r['key_produccion']==db.key)
  assert row['saldo_ensamble'] is None and row['saldo_empaque']==288
  assert row['pdt_por_validar'] and 'PDT 3 REF' in row['pendientes_mecanizado']
  # This proves the real legacy limitation: another key/line with the same name
  # appears in the summary. Never claim key-bound credit or new availability.
  assert before==db.unchanged()
  for token in ['invalid']:
   try:db.rpc('sgp_consultar_ensamble',{'p_token':token,'p_linea':'PANELES_2'});raise AssertionError('Denied session accepted')
   except RuntimeError as e:assert 'PERMISO_DENEGADO' in str(e)
  for stage in ['ENSAMBLE','EMPAQUE']:
   rows=db.snapshot(stage)['orders'];assert len(rows)==4 and all(r['ejecutado']==0 for r in rows)
  out={'status':'PASS','postgres':db.sql('SHOW server_version'),'checks':['Actual captured material RPC/session/reservation helpers execute against synthetic relations','NULL assembly/288 packing returned independently','Actual name-based PDT aggregation reproduced across distinct production keys; no release accredited','Invalid session denied; no modification of production, assignments, PDT, SALE, execution or audit'],'limits':['Synthetic reservation view is upstream fixture only, not verification of its managed definition','No productive business RPC invoked; legacy material read role matrix preserved, no permissions broadened']}
  (HERE/'evidence/postgres.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
 finally:db.close()
