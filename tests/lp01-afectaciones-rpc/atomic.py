from pathlib import Path
import importlib.util,json,uuid
from concurrent.futures import ThreadPoolExecutor
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).parent
spec=importlib.util.spec_from_file_location('lp_fixture_atomic',HERE/'postgres.py');lp=importlib.util.module_from_spec(spec);spec.loader.exec_module(lp)
lit=lp.lit
class ContractMethods(lp.Fixture):
 def read2(self,user='ll',stage='ENSAMBLE'):
  return json.loads(self.db.sql('SET ROLE anon;SELECT public.sgp_lp_afectaciones_consultar_v2('+','.join(map(lit,[user,self.key,stage]))+')'))
 def pieces(self,user='ll',stage='ENSAMBLE'):
  response=json.loads(self.db.sql('SET ROLE anon;SELECT public.sgp_pdt_registro_fuentes_v4('+','.join([lit(user),lit(stage),lit(json.dumps({'key_produccion':self.key,'produccion':'QA ORDER'}))+'::jsonb'])+')'))
  p=next(p for p in response['fuentes'] if p['id_pieza']=='P1' and p['reserva']=='R')
  return [{'id_pieza':p['id_pieza'],'key_produccion':p['key_produccion'],'reserva':p['reserva'],'reserva_principal':p['reserva_principal'],'perfil':p['codigo_sap'],'fabricacion':p['fabricacion'],'longitud':p['longitud'],'acabado':p['acabado'],'cantidad':2,'nc':'QA-NC','observacion':'QA pieza'}]
 def atomic_query(self,c,pieces,user='ll',stage='ENSAMBLE'):
  return 'SET ROLE anon;SELECT public.sgp_lp_afectaciones_aluminio_v1('+','.join([lit(user),lit(self.key),lit(stage),"'2026-11-01'",'1',lit(json.dumps(c))+'::jsonb',lit(json.dumps(pieces))+'::jsonb'])+')'
 def atomic(self,c,pieces,**kw):return json.loads(self.db.sql(self.atomic_query(c,pieces,**kw)))
 def legacy(self):return json.loads(self.db.sql('SET ROLE anon;SELECT public.sgp_lp_afectaciones_legado_v1(\'COORDINADOR\','+lit(self.key)+",'ENSAMBLE')"))
 def reconcile_query(self,snapshot,maps,uid=None,user='COORDINADOR'):
  return 'SET ROLE anon;SELECT public.sgp_lp_afectaciones_conciliar_v1('+','.join([lit(user),lit(self.key),"'ENSAMBLE'",lit(uid or str(uuid.uuid4())),lit(snapshot['fingerprint']),str(snapshot['revision']),lit(json.dumps(maps))+'::jsonb',lit('QA cotejo documentado')])+')'
def Fixture(reconciliation_sql=None):
 import current_chain
 x=current_chain.Fixture.__new__(current_chain.Fixture)
 try:
  x.__init__(reconciliation_sql=reconciliation_sql);return x
 except BaseException:
  if hasattr(x,'db'):x.close()
  raise
def tests(x):
 db=x.db;checks=[];pieces=x.pieces();c=x.command('CREATE',5,user='ll',cause='NC_AL')
 assert db.run(x.atomic_query(c,pieces)).returncode
 db.sql('UPDATE sgp_lp_afectaciones.config SET writes=true,pdt_links=true,atomic_pdt=true,physical=true')
 assert 'REPORT_ALUMINUM' in x.read2()['capabilities'] and 'REPORT_ALUMINUM' not in x.read2('se')['capabilities']
 assert db.run(x.atomic_query(c,pieces,user='se')).returncode
 first=x.atomic(c,pieces);assert x.atomic(c,pieces)['duplicate'];rid=first['reportId']
 assert db.sql('SELECT count(*) FROM sgp_aluminio_pendientes')=='1'
 assert db.sql('SELECT cantidad FROM sgp_aluminio_pendientes')=='2' and x.read2()['reports'][0]['quantity']==5
 assert db.run(x.atomic_query(c,[{**pieces[0],'cantidad':3}])).returncode
 for bad in [{'longitud':101},{'fabricacion':'OTHER'},{'key_produccion':'QA|FRAMES_2'},{'nc':''}]:
  badcmd=x.command('CREATE',1,user='ll',cause='NC_AL');assert db.run(x.atomic_query(badcmd,[{**pieces[0],**bad}])).returncode
 assert db.sql('SELECT count(*) FROM sgp_aluminio_pendientes')=='1'
 checks.append('Native V4 source/identity/NC guards; same transaction PDT2 pieces + LP5 windows; replay one record; supervisor denied; malformed source rolls back')
 stale={**x.command('CREATE',1,user='ll',cause='NC_AL'),'revision':0};assert db.run(x.atomic_query(stale,pieces)).returncode
 assert db.sql('SELECT count(*) FROM sgp_aluminio_pendientes')=='1'
 # Final receipt failure must undo both complete native PDT ledger and LP event/report.
 db.sql("CREATE FUNCTION public.qa_fail_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'QA_RECEIPT_FAIL';END $$;CREATE TRIGGER qa_fail BEFORE INSERT ON sgp_lp_afectaciones.pdt_recibos FOR EACH ROW EXECUTE FUNCTION public.qa_fail_receipt()")
 assert db.run(x.atomic_query(x.command('CREATE',1,user='ll',cause='NC_AL'),pieces)).returncode
 assert db.sql('SELECT count(*) FROM sgp_aluminio_pendientes')=='1' and len(x.read2()['reports'])==1
 db.sql('DROP TRIGGER qa_fail ON sgp_lp_afectaciones.pdt_recibos;DROP FUNCTION public.qa_fail_receipt()')
 same=x.command('CREATE',1,user='ll',cause='NC_AL')
 with ThreadPoolExecutor(2) as pool:results=list(pool.map(lambda _:x.atomic(same,pieces),range(2)))
 assert sorted(r['duplicate'] for r in results)==[False,True] and db.sql('SELECT count(*) FROM sgp_aluminio_pendientes')=='2'
 races=[x.command('CREATE',1,user='ll',cause='NC_AL'),x.command('CREATE',1,user='ll',cause='NC_AL')]
 with ThreadPoolExecutor(2) as pool:outcomes=list(pool.map(lambda c:db.run(x.atomic_query(c,pieces)),races))
 assert sorted(r.returncode==0 for r in outcomes)==[False,True] and any('REVISION_DESACTUALIZADA' in r.stderr for r in outcomes)
 assert db.sql('SELECT count(*) FROM sgp_aluminio_pendientes')=='3'
 checks.append('Late LP/receipt failures roll back native PDT too; concurrent exact retry creates one PDT event and one LP report')
 # Actual original Picking writer and row, no fabricated source registry.
 native_context={'id_programacion':'00000000-0000-0000-0000-000000000001','produccion':'QA ORDER','completa':False,'fecha_entrega':'2026-11-01','turno':'TURNO 1'}
 picking=json.loads(db.sql('SET ROLE anon;SELECT public.sgp_pdt_registrar_v4('+','.join([lit('COORDINADOR'),lit('PICKING'),lit(json.dumps(native_context))+'::jsonb',lit(json.dumps([{**p,'nc':''} for p in pieces]))+'::jsonb',lit(str(uuid.uuid4()))])+')'))
 before=db.sql('SELECT count(*) FROM sgp_aluminio_pendientes');rows=x.read2()['pickingPending']['rows']
 assert rows[0]['nc'] in (None,'')
 assert len(rows)==1 and rows[0]['id']==picking['ids_pendientes'][0] and rows[0]['fabrication']=='E17' and rows[0]['length']==100 and rows[0]['origin']=='PICKING'
 assert x.read2('se')['pickingPending']=={'status':'UNAUTHORIZED','rows':[]}
 assert db.sql('SELECT count(*) FROM sgp_aluminio_pendientes')==before
 # Adopt the original pending into LP with an explicit window quantity, not another PDT write.
 pending_cmd=x.command('CREATE',5,user='ll',cause='NC_AL')
 adopt='SET ROLE anon;SELECT public.sgp_lp_afectaciones_desde_picking_v1('+','.join([lit('ll'),lit(x.key),lit('ENSAMBLE'),lit('2026-11-01'),'1',lit(json.dumps(pending_cmd))+'::jsonb',lit(picking['ids_pendientes'][0])])+')'
 adopted=json.loads(db.sql(adopt));assert json.loads(db.sql(adopt))['duplicate']
 assert db.sql('SELECT count(*) FROM sgp_aluminio_pendientes')==before
 checks.append('Native Picking pending visible by exact production with original ID/reference/fabrication/length/state; supervisor read unavailable; original optional NC stays blank on adoption; no duplicate/no availability credit')
 # Reconcile a current legacy occurrence against the same existing report, never clone.
 db.execute(db.cmd('AFECTAR',key=x.key,part=x.parts[0],affectations={'NC_AL':5},observation='QA legacy'), 'se')
 snapshot=x.legacy();assert len(snapshot['sources'])==1
 assert db.run(x.reconcile_query(snapshot,[])).returncode
 mappings=[{'sourceId':snapshot['sources'][0]['id'],'reportIds':[rid],'evidence':'QA mismo faltante verificado'}]
 assert db.run(x.reconcile_query(snapshot,mappings,user='QAADMIN')).returncode
 request=x.reconcile_query(snapshot,mappings);db.sql(request);assert json.loads(db.sql(request))['duplicate']
 assert len(x.read2()['reports'])==4 and 'VALIDATE' in x.read2('COORDINADOR')['capabilities']
 x.run(x.command('VALIDATE',5,user='COORDINADOR'),user='COORDINADOR');assert x.read2()['available']==283
 x.run(x.command('SOLVE',2,user='ll',reportId=rid),user='ll')
 assert db.run(x.query(x.command('CONFIRM',1,user='se',reportId=rid),user='se')).returncode
 assert db.run(x.query(x.command('CONFIRM',1,user='QAADMIN',reportId=rid),user='QAADMIN')).returncode
 x.run(x.command('CONFIRM',1,user='ll',reportId=rid),user='ll')
 assert x.read2()['reports'][0]['confirmed']==1
 x.run(x.command('CORRECT',6,user='ll',reportId=rid),user='ll');assert 'VALIDATE' not in x.read2('COORDINADOR')['capabilities']
 assert db.run(x.reconcile_query(snapshot,mappings)).returncode
 checks.append('Coordinator explicit legacy-to-report evidence; missing/stale/other-role reconciliation denied; no backfill; changed report quantity invalidates mapping; physical only leader/coordinator, not supervisor/admin')
 # Both process origins use the current PUBLIC wrapper, never the legacy function directly.
 emp=x.command('CREATE',3,user='ll',stage='EMPAQUE',cause='NC_AL')
 em=x.atomic(emp,x.pieces(stage='EMPAQUE'),stage='EMPAQUE')
 assert x.atomic(emp,x.pieces(stage='EMPAQUE'),stage='EMPAQUE')['duplicate']
 assert db.sql('SELECT origen FROM public.sgp_aluminio_pendientes WHERE id_pendiente='+lit(em['pdtIds'][0]))=='EMPAQUE'
 # Explicit historical cases preserve identity; absence of ledger never creates a replacement PDT.
 for contract,key in [('LEGACY',x.key),('V2',x.key),('LEGACY',None)]:
  source=str(uuid.uuid4());seed_sql='INSERT INTO public.sgp_aluminio_pendientes(id_pendiente,reserva,produccion,perfil,cantidad,longitud,origen,estado,id_pieza,fabricacion,key_produccion,contrato_pdt,usuario_reporte) SELECT '+lit(source)+',reserva,produccion,perfil,cantidad,longitud,origen,estado,id_pieza,fabricacion,'+('NULL' if key is None else lit(key))+','+lit(contract)+",usuario_reporte FROM public.sgp_aluminio_pendientes WHERE origen='PICKING' LIMIT 1"
  if key is None:
   invalid=db.run(seed_sql);assert invalid.returncode and 'PDT_CLAVE_NO_VERIFICADA' in invalid.stderr;continue
  db.sql(seed_sql)
  visible=any(r['id']==source for r in x.read2()['pickingPending']['rows']);assert visible==(key is not None)
  before=db.sql('SELECT count(*) FROM public.sgp_aluminio_pendientes')
  c=x.command('CREATE',1,user='ll',cause='NC_AL')
  denied=db.run('SET ROLE anon;SELECT public.sgp_lp_afectaciones_desde_picking_v1('+','.join([lit('ll'),lit(x.key),lit('ENSAMBLE'),lit('2026-11-01'),'1',lit(json.dumps(c))+'::jsonb',lit(source)])+')')
  assert denied.returncode and 'ORIGEN_PICKING_NO_ACREDITADO' in denied.stderr
  assert db.sql('SELECT count(*) FROM public.sgp_aluminio_pendientes')==before
 assert x.read2()['available'] is None
 checks.append('Current public wrapper preserves Empaque origin/replay; LEGACY and V2 without ledger visible only by exact key, adoption rejected without replacement or availability credit; new null-key historical-style insert rejected by native identity guard')
 return checks
if __name__=='__main__':
 x=Fixture()
 try:
  checks=tests(x);out={'status':'PASS','environment':'PostgreSQL17.11 --network none','checks':checks,'limits':['Synthetic rows only','Full captured native Picking/source/reserve view and partial wrapper; synthetic rows only','No production capability activation','Legacy mapping needs explicit evidence, never inferred']};(HERE/'atomic-result.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
 finally:x.close()
