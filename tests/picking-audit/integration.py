"""Real PostgreSQL audit contracts; fresh synthetic rows, no database copies."""
import pathlib,json,uuid,concurrent.futures
exec((pathlib.Path(__file__).resolve().parents[1]/'mecanizado-parcial/integration.py').read_text().split('# Refuse any attached')[0])
CONTAINER='sgp-audit-test';DB='sgp_parcial_integration'
def rpc(name,*args,ok=True):
 q='set role anon;select '+name+'('+','.join(jsonarg(a) if isinstance(a,(dict,list)) else 'null' if a is None else str(a) if isinstance(a,int) else literal(a) for a in args)+');'
 t=sql(q,ok);return json.loads(t.splitlines()[-1]) if ok else t
counter=100
def fixture(count=1):
 global counter
 counter+=1;prod=str(920000+counter);key=prod+'|PANELES_2';res='QA-AUD-'+prod
 seed(key,288,res);ids=[]
 for i in range(4):
  id='AUD-'+prod+'-'+str(i);ids.append(id)
  sql(f"insert into sgp_aluminio(id_pieza,id_carga,fila_origen,key_produccion,produccion,codigo_sap,sistema,tipo_pieza,acabado,fabricacion,longitud,cantidad,marca) values('{id}','QA-AUD',{i},'{key}','{prod}','QA-PANEL','QA-S','PANEL','QA-A','E{i}',{100+i},288,'M{i}');")
 program(key,90,reserve=res);part=read(key)['partes'][0]['id_programacion'];state(part,prod)
 ctx={'id_programacion':part,'produccion':prod,'completa':False,'cantidad_ventanas':90,'fecha_entrega':'2026-10-28','turno':'TURNO 1'}
 sources=rpc('sgp_pdt_registro_fuentes_v4','qa-picking','PICKING',ctx)['fuentes']
 pieces=[dict(s,perfil=s['codigo_sap'],cantidad=2,ventanas_afectadas=1,ncs=[]) for s in sources[:count]]
 event=rpc('sgp_pdt_registrar_v4','qa-picking','PICKING',ctx,pieces,str(uuid.uuid4()))
 snap=rpc('sgp_picking_auditoria_contexto','qa-recepcion',event['id_entrega'])
 decisions=[dict(id_faltante=f['id_faltante'],accion='ACEPTAR') for f in snap['faltantes']]
 return dict(prod=prod,key=key,res=res,part=part,sources=sources,event=event,snap=snap,decisions=decisions,request=str(uuid.uuid4()))
def save(f,token='qa-recepcion',ok=True,diffs=None,version=None):
 return rpc('sgp_picking_auditoria_guardar',token,f['event']['id_entrega'],version or f['snap']['version'],f['request'],'2026-10-30','TURNO 2',f['decisions'],diffs or [],'QA audit',ok=ok)
def pending(f,i=0):return f['snap']['faltantes'][i]['pendiente']['id_pendiente']
def change(f,action,i=0):
 f['decisions'][i].update(accion=action,motivo='QA corrección')
 if action=='MODIFICAR':
  s=f['sources'][-1];f['decisions'][i].update(id_pieza=s['id_pieza'],reserva=s['reserva'],acabado=s['acabado'],cantidad=3,ventanas_afectadas=4,observacion='QA changed')

def accept():
 f=fixture();before=sql(f"select to_jsonb(e)-'estado'-'usuario_validacion'-'fecha_validacion'-'observacion_validacion' from sgp_picking_entregas e where id_entrega='{f['event']['id_entrega']}';")
 r=save(f);expect(save(f),r)
 expect(sql(f"select cantidad||'|'||estado||'|'||auditado from sgp_aluminio_pendientes where id_pendiente='{pending(f)}';"),'2|PENDIENTE|true')
 expect(sql(f"select to_jsonb(e)-'estado'-'usuario_validacion'-'fecha_validacion'-'observacion_validacion' from sgp_picking_entregas e where id_entrega='{f['event']['id_entrega']}';"),before)
 expect(sql(f"select fecha_recepcion||'|'||turno_recepcion||'|'||usuario from sgp_picking_audit.eventos where id_entrega='{f['event']['id_entrega']}';"),'2026-10-30|TURNO 2|qa-recepcion')
test('aceptar, fecha/turno independientes y reintento idempotente',accept)
def edit():
 f=fixture();change(f,'MODIFICAR');save(f)
 expect(sql(f"select id_pieza||'|'||cantidad||'|'||ventanas_afectadas from sgp_aluminio_pendientes where id_pendiente='{pending(f)}';"),f['sources'][-1]['id_pieza']+'|3|4')
 expect(sql(f"select count(*) from sgp_mecanizado_parcial.contextos_pdt where id_entrega='{f['event']['id_entrega']}';"),'1')
 expect(sql(f"select count(*) from sgp_aluminio_pendientes_historial where id_pendiente='{pending(f)}' and tipo_evento='AUDITORIA_PICKING_MODIFICAR' and datos_anteriores is not null;"),'1')
 rows=rpc('sgp_aluminio_pendientes_listar_v2','qa-recepcion',True)['pendientes'];row=next(x for x in rows if x['id_pendiente']==pending(f));expect(row['cantidad_reportada'],3)
test('modificar mismo ID, pieza física, cantidades, historial y listado V2',edit)
def cancel():
 f=fixture();change(f,'ELIMINAR');save(f)
 expect(sql(f"select estado from sgp_aluminio_pendientes where id_pendiente='{pending(f)}';"),'ANULADO')
 rows=rpc('sgp_aluminio_pendientes_listar_v2','qa-recepcion',True)['pendientes'];expect(any(x['id_pendiente']==pending(f) for x in rows),False)
 expect(sql(f"select count(*) from sgp_picking_faltantes where id_entrega='{f['event']['id_entrega']}';"),'1')
 report=rpc('sgp_picking_reporte_entregas_v1','qa-picking','2026-10-28','2026-10-28',None,None,500,0)
 expect(next(r['faltantes'] for r in report['rows'] if r['id_entrega']==f['event']['id_entrega']),[])
test('anulación lógica conserva relaciones y sale de activos V2',cancel)
def difference():
 f=fixture();s=f['sources'][-1];diff=dict(s,perfil=s['codigo_sap'],cantidad=2,ventanas_afectadas=3,ncs=[])
 r=save(f,diffs=[diff]);expect(len(r['ids_nuevos']),1);expect(save(f,diffs=[diff]),r)
 expect(sql(f"select count(*) from sgp_picking_auditoria_diferencias where id_entrega='{f['event']['id_entrega']}';"),'1')
 expect(sql(f"select origen||'|'||contrato_pdt||'|'||ventanas_afectadas from sgp_aluminio_pendientes where id_pendiente='{r['ids_nuevos'][0]}';"),'PICKING_AUDITORIA|V2|3')
test('diferencia adicional V4 real, origen auditoría e idempotencia',difference)
def mixed():
 f=fixture(3);change(f,'MODIFICAR',1);change(f,'ELIMINAR',2);save(f)
 expect(sql(f"select count(*) from sgp_picking_audit.decisiones where id_entrega='{f['event']['id_entrega']}';"),'3')
test('tres pendientes con decisiones independientes en una transacción',mixed)
def atomic():
 f=fixture(2);change(f,'ELIMINAR',0);change(f,'MODIFICAR',1);f['decisions'][1]['id_pieza']='AJENA'
 expect('PIEZA_NO_CORRESPONDE' in save(f,ok=False),True)
 expect(sql(f"select estado||'|'||auditado from sgp_aluminio_pendientes where id_pendiente='{pending(f)}';"),'PENDIENTE|false')
 expect(sql(f"select count(*) from sgp_picking_audit.decisiones where id_entrega='{f['event']['id_entrega']}';"),'0')
test('error tardío revierte decisiones previas y sus historiales',atomic)
def permissions():
 f=fixture()
 for role in ['qa-consulta','qa-mecanizado']:
  save(f,token=role,ok=False)
 sql("insert into sgp_usuarios(usuario,nombre,password_hash,rol,activo) values('qa-patinador','QA','fixture','PATINADOR',true);insert into sgp_sesiones_app(id_usuario,token_hash,expira_en) select id_usuario,encode(extensions.digest(usuario,'sha256'),'hex'),now()+interval '1 day' from sgp_usuarios where usuario='qa-patinador';")
 save(f,token='qa-patinador',ok=False);save(f)
 sql("set role anon;select * from sgp_picking_audit.eventos;",False)
test('Recepción autorizada; Consulta, Patinador y otros roles sin auditoría ni escritura directa',permissions)
def conflict():
 f=fixture();sql(f"update sgp_aluminio_pendientes set observacion='concurrent change' where id_pendiente='{pending(f)}';")
 expect('CONFLICTO' in save(f,ok=False),True)
test('versión detecta cambios concurrentes de pendiente',conflict)
def dependencies():
 for mode in ['nc','detalle','validado']:
  f=fixture();change(f,'ELIMINAR')
  if mode=='nc':sql(f"update sgp_aluminio_pendientes set nc='QA-NC' where id_pendiente='{pending(f)}';")
  elif mode=='validado':sql(f"update sgp_aluminio_pendientes set validacion_estado='VALIDADO' where id_pendiente='{pending(f)}';")
  else:sql(f"insert into sgp_aluminio_pendiente_detalles(id_pendiente,id_pieza,fabricacion,longitud,acabado,cantidad_validada,creado_por) select id_pendiente,id_pieza,fabricacion,longitud,acabado_pendiente,1,'qa' from sgp_aluminio_pendientes where id_pendiente='{pending(f)}';")
  f['snap']=rpc('sgp_picking_auditoria_contexto','qa-recepcion',f['event']['id_entrega']);expect('DEPENDENCIAS' in save(f,ok=False),True)
test('NC, detalle/material y validación posterior bloquean anulación',dependencies)
def duplicates():
 f=fixture();s=f['sources'][0];d=dict(s,perfil=s['codigo_sap'],cantidad=1,ventanas_afectadas=1,ncs=[])
 expect('DUPLICADO' in save(f,ok=False,diffs=[d]),True)
 f['decisions']=f['decisions']*2;expect('UNA_VEZ' in save(f,ok=False),True)
test('rechazar diferencia duplicada y doble decisión',duplicates)
# Worker returns an error instead of hiding the exception.
def race():
 f=fixture();g=dict(f,request=str(uuid.uuid4()))
 def worker(x):
  try:return save(x)
  except Exception as e:return str(e)
 with concurrent.futures.ThreadPoolExecutor(2) as pool:out=list(pool.map(worker,[f,g]))
 expect(sum(isinstance(x,dict) for x in out),1);expect(any('CONFLICTO' in x for x in out if isinstance(x,str)),True)
 expect(sql(f"select count(*) from sgp_picking_audit.eventos where id_entrega='{f['event']['id_entrega']}';"),'1')
test('dos auditores concurrentes: una sola confirmación',race)
def edited_validation():
 f=fixture();change(f,'MODIFICAR');save(f);pid=pending(f);src=f['sources'][-1]
 detail={'id_pieza':src['id_pieza'],'fabricacion':src['fabricacion'],'longitud':src['longitud'],'acabado':src['acabado'],'cantidad':3}
 rpc('sgp_aluminio_pendiente_validar_detalles_v1','qa-coordinador',pid,[detail],src['reserva'],'QA validación tras corrección')
 did=sql(f"select id_detalle from sgp_aluminio_pendiente_detalles where id_pendiente='{pid}';")
 rpc('sgp_aluminio_pendiente_registrar_avance_v1','qa-mecanizado',pid,did,3,'T1','2026-10-30',str(uuid.uuid4()),'QA')
 expect(sql(f"select cantidad_validada from sgp_aluminio_pendiente_detalles where id_detalle='{did}';"),'3')
test('PDT corregido continúa con validación y avance reales por 3 piezas',edited_validation)
def guards():
 f=fixture();pid=pending(f)
 expect('INMUTABLE' in sql(f"update sgp_aluminio_pendientes set cantidad=7 where id_pendiente='{pid}';",False),True)
 change(f,'ELIMINAR');save(f)
 expect('INMUTABLE' in sql(f"update sgp_aluminio_pendientes set estado='PENDIENTE' where id_pendiente='{pid}';",False),True)
 expect(sql('select count(*) from sgp_picking_audit.correcciones;'),'0')
 expect('AUDITORIA_EN_USO' in sql((ROOT/'docs/sql-proposals/picking-audit/rollback-review.sql').read_text(),False),True)
test('guardas V2 persisten fuera de auditoría y un anulado no se reactiva',guards)
def unknown_origin():
 f=fixture();sql(f"delete from sgp_pdt_multiorigen.detalles where id_pendiente='{pending(f)}';")
 expect('ORIGEN_NO_UNIVOCO' in rpc('sgp_picking_auditoria_contexto','qa-recepcion',f['event']['id_entrega'],ok=False),True)
test('histórico sin vínculo explícito bloqueado; no deducir relación por nombre/pieza',unknown_origin)
pathlib.Path(__file__).with_name('integration-results.json').write_text(json.dumps({'environment':'PostgreSQL 17.11 network none, synthetic data, real SGP/PDT functions','passed':sum(x['ok'] for x in results),'failed':sum(not x['ok'] for x in results),'tests':results},indent=2)+'\n')
assert all(x['ok'] for x in results)
