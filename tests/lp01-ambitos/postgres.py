from pathlib import Path
import sys,json
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tests/lp01-operacion'))
from postgres import Database,lit
HERE=Path(__file__).parent
if __name__=='__main__':
 db=Database()
 try:
  keys={'PANELES_2':'QA-P|PANELES_2','FRAMES_2':'QA-F|FRAMES_2'};parts={}
  for line,key in keys.items():
   parts[key]=db.seed(key,parts=(20,))[0];db.sql('UPDATE public.sgp_producciones SET id_linea='+lit(line)+' WHERE key_produccion='+lit(key))
  for line,key in keys.items():
   for stage in ['ENSAMBLE','EMPAQUE']:
    ctx={'stage':stage,'line':line};part=parts[key]
    db.execute(db.cmd('ABRIR',**ctx));db.execute(db.cmd('SALE',key=key,part=part,quantity=20,observation='QA aprobación',**ctx))
    assert len(db.snapshot(stage,line=line,token='LIDER')['orders'])==1
    assert len(db.snapshot(stage,line=line,token='CONSULTA')['orders'])==1
    for op,extra in [('EJECUTAR',{'quantity':1}),('NOTA',{}),('AFECTAR',{'affectations':{'NC_AL':0,'NC_V':0,'TECNO':0,'NOVEDAD':0}})]:
     c=db.cmd(op,key=key,part=part,observation='QA operador autorizado',**ctx,**extra);db.execute(c,'LIDER');db.reject({**c,'id':str(__import__('uuid').uuid4())},'ESCRITURA_NO_HABILITADA','CONSULTA')
    db.reject(db.cmd('SALE',key=key,part=part,quantity=10,observation='QA',**ctx),'REQUIERE_COORDINADOR','LIDER')
    db.reject(db.cmd('VALIDAR',key=key,part=part,affectations={},consolidated=0,observation='QA',**ctx),'REQUIERE_COORDINADOR','LIDER')
    db.reject(db.cmd('EJECUTAR',key=key,part=part,quantity=2,observation='QA',**ctx),'SESION_NO_AUTORIZADA','RECEPCION')
    db.reject(db.cmd('EJECUTAR',key=key,part=part,quantity=2,observation='QA',**{**ctx,'shift':2}),'TURNO_NO_EXISTE','LIDER')
    db.execute(db.cmd('VALIDAR',key=key,part=part,affectations={'NC_AL':0,'NC_V':0,'TECNO':0,'NOVEDAD':0},consolidated=0,observation='QA consolidación',**ctx))
    rows=db.snapshot(stage,line=line)['orders'];content='etapa;fecha;turno;key_produccion;parte;cantidad\n'+'\n'.join(';'.join(map(str,[stage,'2026-11-01',1,r['key'],r['parte'],r['ejecutado']])) for r in rows)
    db.sql('UPDATE sgp_lp_operacion.config SET formato_bi_aprobado=true WHERE id')
    f=db.execute(db.cmd('IMPORTAR_BI',filename='qa.csv',content=content,**ctx),'LIDER')
    db.execute(db.cmd('CERRAR',file_id=f['fileId'],observation='QA cierre',reasons={key+'/'+part:'QA pendiente'},**ctx),'LIDER')
    db.reject(db.cmd('REABRIR',observation='QA',**ctx),'REQUIERE_COORDINADOR','LIDER')
    db.execute(db.cmd('REABRIR',observation='QA revisión autorizada',**ctx))
    db.reject(db.cmd('NOTA',key=key,part=part,observation='QA',**ctx),'CORRECCION_REQUIERE_COORDINADOR','LIDER')
  key=keys['PANELES_2'];part=parts[key]
  db.seed('QA-X|PANELES_2',parts=(1,));db.execute(db.cmd('ABRIR'))
  db.sql("INSERT INTO public.sgp_usuarios(usuario,nombre,rol) VALUES('QA-CLOSER','QA synthetic','COORDINADOR');INSERT INTO public.sgp_sesiones_app SELECT id_usuario,encode(extensions.digest(usuario,'sha256'),'hex'),NULL,now()+interval '1 day' FROM public.sgp_usuarios WHERE usuario='QA-CLOSER';INSERT INTO sgp_lp_operacion.permisos VALUES('QA-CLOSER','ENSAMBLE','QA-P|PANELES_2')")
  assert len(db.snapshot(token='QA-CLOSER')['orders'])==1
  db.reject(db.cmd('CERRAR',observation='QA partial scope'),'TURNO_FUERA_DE_AMBITO','QA-CLOSER')
  db.reject(db.cmd('EJECUTAR',key=key,part=part,line='FRAMES_2',quantity=2,observation='QA'),'AMBITO_DENEGADO','LIDER')
  db.sql("DELETE FROM sgp_lp_operacion.permisos WHERE usuario='LIDER' AND etapa='EMPAQUE' AND key="+lit(key))
  db.reject(db.cmd('NOTA',stage='EMPAQUE',key=key,part=part,observation='QA'),'AMBITO_DENEGADO','LIDER')
  assert db.snapshot('ENSAMBLE',token='LIDER')['orders']
  fk=keys['FRAMES_2'];fp=parts[fk];ctx={'stage':'ENSAMBLE','line':'FRAMES_2'}
  rows=db.snapshot('ENSAMBLE',line='FRAMES_2')['orders'];content='etapa;fecha;turno;key_produccion;parte;cantidad\n'+'\n'.join(';'.join(map(str,['ENSAMBLE','2026-11-01',1,r['key'],r['parte'],r['ejecutado']])) for r in rows)
  f=db.execute(db.cmd('IMPORTAR_BI',filename='qa-next.csv',content=content,**ctx))
  db.execute(db.cmd('CERRAR',file_id=f['fileId'],observation='QA cierre de revisión',reasons={fk+'/'+fp:'QA pendiente'},**ctx))
  db.execute(db.cmd('ABRIR',shift=2,**ctx))
  db.execute(db.cmd('SALE',shift=2,key=fk,part=fp,quantity=19,observation='QA siguiente turno',**ctx))
  db.execute(db.cmd('EJECUTAR',shift=2,key=fk,part=fp,quantity=1,observation='QA avance autorizado',**ctx),'LIDER')
  db.reject(db.cmd('NOTA',key=fk,part=fp,observation='QA turno anterior',**ctx),'REAPERTURA_REQUERIDA','LIDER')
  db.sql("UPDATE public.sgp_usuarios SET activo=false WHERE usuario='LIDER'")
  db.reject(db.cmd('NOTA',key=key,part=part,observation='QA'),'SESION_NO_AUTORIZADA','LIDER')
  try:db.snapshot(token='LIDER');raise AssertionError('Inactive account read accepted')
  except RuntimeError as e:assert 'SESION_NO_AUTORIZADA' in str(e)
  out={'status':'PASS','checks':['Four line/stage combinations exercise actual server read/advance/note/affectation/close permissions','Consultation read-only; leader cannot SALE, validate or reopen; reception rejected','Coordinator-only correction in review; legitimate leader close uses actual QA CSV closure engine','Unopened turn, wrong line and revoked stage denied; other stage independent','Partial-scope coordinator sees only own production and cannot close the whole turn', 'Manual next configured shift preserves scope; closed prior turn rejects stale actions', 'Inactive account rejected for both read and write'],'limits':['All accounts/production identifiers and permissions are synthetic QA fixtures','No real roles, permissions or scope assignments modified','Validity intervals checked in private reviewer only; current permissions table does not store interval policy','QA CSV supplies closure evidence; not new XLSX format verification'],'postgres':db.sql('SHOW server_version')}
  (HERE/'evidence/postgres.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
 finally:db.close()
