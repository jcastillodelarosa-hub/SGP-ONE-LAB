"""Synthetic importer/SQL08 parity and Encargo3 functional flow. No production connection."""
from pathlib import Path
import sys,json,subprocess,datetime,hashlib
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tests/lp01-operacion'))
from postgres import Database,lit
HERE=Path(__file__).parent
NODE="""import {prepareScopeImport} from './src/server/lp01-scope-import.js';import {fixture} from './tests/lp01-ambitos-import/fixtures.mjs';let s='';for await(const x of process.stdin)s+=x;const q=JSON.parse(s);const f=fixture();f.asOf=q.asOf;f.catalog.accounts[0].id='COORDINADOR';f.catalog.accounts[1].id='LIDER';for(const a of f.proposed.assignments){a.user=a.duty==='PRIMARY'?'COORDINADOR':'LIDER';a.validFrom=q.start;a.validUntil=q.end;if(q.revoked&&a.duty==='BACKUP')a.revokedAt=q.asOf;if(q.missing&&a.duty==='BACKUP')a.duty='OPERATOR';}f.reference=structuredClone(f.proposed);f.periods.records=f.periods.records.map(p=>({...p,...q.period}));console.log(JSON.stringify(prepareScopeImport(f)));"""
def propose(db,start,end,revoked=False,missing=False):
 asof=db.sql('SELECT to_char(clock_timestamp() AT TIME ZONE \'UTC\',\'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"\')')
 period=json.loads(db.sql("SELECT sgp_lp_operacion.periodo('2026-11-01',2)"))
 data={'asOf':asof,'start':start,'end':end,'period':period,'revoked':revoked,'missing':missing}
 r=subprocess.run(['node','--input-type=module','-e',NODE],cwd=ROOT,input=json.dumps(data),text=True,capture_output=True,check=True)
 return json.loads(r.stdout)
def sql_guard(db,line,stage):return db.run("SELECT sgp_lp_operacion.verificar_temporal('COORDINADOR',"+','.join([lit(stage),lit(line),"'2026-11-01'",'2','NULL',"'CERRAR'"])+');').returncode==0
if __name__=='__main__':
 db=Database();checks=[]
 try:
  parts={};keys={'PANELES_2':'QA-0|PANELES_2','FRAMES_2':'QA-1|FRAMES_2'}
  for line,key in keys.items():
   parts[key]=db.seed(key,parts=(90,90,90,18));db.sql('UPDATE public.sgp_producciones SET id_linea='+lit(line)+' WHERE key_produccion='+lit(key))
  baseline=db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY key_produccion) FROM public.sgp_producciones p')
  plan=db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.sgp_linea_plan_asignaciones p')
  db.sql("CREATE ROLE service_role;");db.sql((ROOT/'docs/sql-proposals/lp01-operacion/06_powerbi_xlsx_REVIEW.sql').read_text())
  db.sql('UPDATE sgp_lp_operacion.config SET escrituras=false WHERE id');db.sql((ROOT/'docs/sql-proposals/lp01-operacion/08_ambitos_temporales_REVIEW.sql').read_text())
  start='2026-01-01T00:00:00Z';end='2030-01-01T00:00:00Z'
  cases=[('whole_period',start,end,False,False,True),('nocturnal_partial_start','2026-11-02T00:00:00-05:00',end,False,False,False),('expired',start,'2026-11-01T18:00:00-05:00',False,False,False),('revoked_backup',start,end,True,False,False),('missing_backup',start,end,False,True,False)]
  # Scope rows below are manually initialized synthetic fixtures, never importer output applied.
  for name,a,b,revoked,missing,expected in cases:
   db.sql("UPDATE sgp_lp_operacion.permisos SET valid_from="+lit(a)+",valid_until="+lit(b)+",duty=CASE usuario WHEN 'COORDINADOR' THEN 'PRIMARY' WHEN 'LIDER' THEN "+lit('OPERATOR' if missing else 'BACKUP')+" ELSE 'READ' END,revoked_at=CASE WHEN usuario='LIDER' AND "+str(revoked).lower()+" THEN clock_timestamp() ELSE NULL END")
   r=propose(db,a,b,revoked,missing);assert r['apply'] is False
   for c in r['coverage']:assert c['primaryCovered'] and c['backupCovered'] if expected else not(c['primaryCovered'] and c['backupCovered'])
   for line in keys:
    for stage in ['ENSAMBLE','EMPAQUE']:assert sql_guard(db,line,stage)==expected,(name,line,stage)
  checks.append('Five importer coverage cases match actual SQL08 private guard across four line/stage scopes; periods obtained from existing PostgreSQL periodo function')
  # Complete Encargo3 operations under unchanged SQL08 and real sessions.
  db.sql("UPDATE sgp_lp_operacion.permisos SET valid_from='2026-01-01T00:00:00Z',valid_until='2030-01-01T00:00:00Z',revoked_at=NULL,duty=CASE usuario WHEN 'COORDINADOR' THEN 'PRIMARY' WHEN 'LIDER' THEN 'BACKUP' ELSE 'READ' END;UPDATE sgp_lp_operacion.config SET escrituras=true,formato_bi_aprobado=true WHERE id")
  for line,key in keys.items():
   for stage in ['ENSAMBLE','EMPAQUE']:
    ctx={'stage':stage,'line':line};p=parts[key]
    db.execute(db.cmd('ABRIR',**ctx));rows=db.snapshot(stage,line=line)['orders'];assert [x['programada'] for x in rows]==[90,90,90,18]
    if stage=='EMPAQUE':assert all(x['sale'] is None and x['sale_estado']=='REPARTO_COORDINADOR_REQUERIDO' for x in rows)
    for root,n in zip(p,[90,90,90,18]):db.execute(db.cmd('SALE',key=key,part=root,quantity=n,observation='QA reparto explícito coordinador',**ctx))
    for n in [80,90]:db.execute(db.cmd('EJECUTAR',key=key,part=p[0],quantity=n,observation='QA último acumulado',**ctx),'LIDER')
    db.execute(db.cmd('AFECTAR',key=key,part=p[1],affectations={'NC_AL':2,'NC_V':2},observation='QA afectaciones superpuestas',**ctx),'LIDER')
    db.execute(db.cmd('VALIDAR',key=key,part=p[1],affectations={'NC_AL':2,'NC_V':2},consolidated=2,observation='QA consolidado explícito',**ctx))
    db.execute(db.cmd('NOTA',key=key,part=p[1],observation='QA novedad trazable',**ctx),'LIDER')
    snap=db.snapshot(stage,line=line);rows=snap['orders'];assert sum(x['ejecutado'] for x in rows)==90
    assert rows[1]['consolidado']==2 and all(x['ejecutado']==0 for x in rows[1:]);assert len(snap['history'])>=10
    content='etapa;fecha;turno;key_produccion;parte;cantidad\n'+'\n'.join(';'.join(map(str,[stage,'2026-11-01',1,x['key'],x['parte'],x['ejecutado']])) for x in rows)
    f=db.execute(db.cmd('IMPORTAR_BI',filename='qa-functional.csv',content=content,**ctx),'LIDER')
    db.execute(db.cmd('CERRAR',file_id=f['fileId'],observation='QA pendientes conservados',reasons={key+'/'+x['parte']:'QA restante' for x in rows},**ctx),'LIDER')
    db.reject(db.cmd('REABRIR',observation='QA',**ctx),'REQUIERE_COORDINADOR','LIDER')
    db.execute(db.cmd('ABRIR',shift=2,**ctx));carry=db.snapshot(stage,shift=2,line=line)['orders']
    assert [x['prioridad'] for x in carry]==[2,3,4];assert len(carry)==3 and {x['parte'] for x in carry}==set(p[1:]);assert all(x['antiguedad_fecha']=='2026-11-01' and x['antiguedad_turno']==1 and x['ejecutado']==0 for x in carry)
    assert next(x for x in carry if x['parte']==p[1])['consolidado']==2
    assert db.sql("SELECT sum(ejecutado) FROM sgp_lp_operacion.ordenes WHERE key="+lit(key)+' AND etapa='+lit(stage))=='90'
  checks.append('Real Encargo3 flow on four scopes: 288=90+90+90+18, explicit coordinator SALE, latest80->90=90, overlapping affectations consolidated2, notes/audit and real closure with QA CSV')
  checks.append('P1 completion leaves P2-P4 open with198 programmed remaining; next Sunday night carries exactly three original roots, age and affectations, zero duplicated advances')
  assert baseline==db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY key_produccion) FROM public.sgp_producciones p')
  assert plan==db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.sgp_linea_plan_asignaciones p')
  checks.append('Original Export balances and LP assignments/priorities/dates/quantities unchanged; Ensamble and Empaque execution and closure independent')
  out={'status':'PASS','postgres':db.sql('SHOW server_version'),'synthetic':True,'checks':checks,'limitations':['Importer only computes apply=false; test harness sets synthetic scope fixtures independently','Five temporal cases test existing SQL08 guard without stubs; real RPC functional flow uses captured session function','QA CSV is closure input only, not new PowerBI validation','No product data, SQL, users, scopes, grants or RLS changed; no frontend changes']}
  (HERE/'evidence/postgres.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
 finally:db.close()
