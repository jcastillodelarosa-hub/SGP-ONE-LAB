"""Concurrent RPC tests on the synthetic, network-disabled fixture only."""
import subprocess,concurrent.futures,sys,json,uuid
container='sgp-pdt-qa-91';database=sys.argv[1]
if not database.startswith('sgp_pdt_qa_91_'):raise SystemExit('Invalid QA destination')
if json.loads(subprocess.check_output(['docker','inspect',container]))[0]['HostConfig']['NetworkMode']!='none':raise SystemExit('Not isolated')
def sql(statement):
 return subprocess.run(['docker','exec','-i',container,'psql','-X','-tA','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],input=statement,text=True,capture_output=True)
def run(statement):
 r=sql(statement)
 if r.returncode:raise AssertionError(r.stderr)
 return r.stdout.strip()
parent=str(uuid.uuid4())
run("UPDATE sgp_aluminio SET activo='SI'; INSERT INTO sgp_aluminio_pendientes(id_pendiente,key_produccion,produccion,perfil,cantidad,reserva,acabado_pendiente) VALUES('%s','qa|PANELES_2','QA-PROD','QA-PERFIL',5,'QA-RES','DS');"%parent)
run("SELECT sgp_aluminio_pendiente_validar_detalles_v1('RECEPCION','%s','[{\"id_pieza\":\"qa-source-1\",\"fabricacion\":\"E17\",\"longitud\":\"109.9375\",\"acabado\":\"DS\",\"cantidad\":5}]');"%parent)
detail=run("SELECT id_detalle FROM sgp_aluminio_pendiente_detalles WHERE id_pendiente='%s'"%parent)
def advance(key,qty):return "SELECT sgp_aluminio_pendiente_registrar_avance_v1('LIDER MECANIZADO','%s','%s',%s,'T1','2026-10-25','%s');"%(parent,detail,qty,key)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 results=list(pool.map(sql,[advance(str(uuid.uuid4()),4),advance(str(uuid.uuid4()),4)]))
assert sorted(r.returncode==0 for r in results)==[False,True]
assert run("SELECT sum(cantidad) FROM sgp_aluminio_pendiente_movimientos WHERE id_detalle='%s'"%detail)=='4'
print('PASS concurrent advances cannot overspend')
key=str(uuid.uuid4())
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 results=list(pool.map(sql,[advance(key,1),advance(key,1)]))
assert all(r.returncode==0 for r in results)
assert run("SELECT count(*) FROM sgp_aluminio_pendiente_movimientos WHERE idempotency_key='%s'"%key)=='1'
print('PASS concurrent idempotent retry inserts once')
# Two positive lines each try to consume 4 units of the same 5 processed units.
for i in range(2):
 run("INSERT INTO sgp_picking_entregas VALUES('%s','50000000-0000-0000-0000-000000000001','QA-PROD',false,'VALIDADA')"%('a0000000-0000-0000-0000-00000000000'+str(i)))
statements=["SELECT sgp_pdt_entrega_registrar_v2('PICKING','%s','a0000000-0000-0000-0000-00000000000%s',4,'%s')"%(detail,i,uuid.uuid4()) for i in range(2)]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(sql,statements))
assert sorted(r.returncode==0 for r in results)==[False,True]
print('PASS concurrent delivery cannot overclaim processed quantity')
line=run("SELECT id_linea FROM sgp_pdt_entrega_lineas WHERE id_detalle='%s'"%detail)
run("SELECT sgp_pdt_entrega_validar_v2('RECEPCION','%s')"%line)
statements=["SELECT sgp_pdt_asignar_v2('RECEPCION','%s','%s')"%(line,uuid.uuid4()) for _ in range(2)]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(sql,statements))
assert sorted(r.returncode==0 for r in results)==[False,True]
assert run("SELECT count(*) FROM sgp_pdt_asignaciones WHERE id_linea='%s'"%line)=='1'
print('PASS concurrent assignment consumes evidence once')
def full_fixture():
 parent=str(uuid.uuid4());event=str(uuid.uuid4());advance_key=str(uuid.uuid4())
 run("INSERT INTO sgp_aluminio_pendientes(id_pendiente,key_produccion,produccion,perfil,cantidad,reserva,acabado_pendiente) VALUES('%s','qa|PANELES_2','QA-PROD','QA-PERFIL',5,'QA-RES','DS');"%parent)
 run("SELECT sgp_aluminio_pendiente_validar_detalles_v1('RECEPCION','%s','[{\"id_pieza\":\"qa-source-1\",\"fabricacion\":\"E17\",\"longitud\":\"109.9375\",\"acabado\":\"DS\",\"cantidad\":5}]');"%parent)
 detail=run("SELECT id_detalle FROM sgp_aluminio_pendiente_detalles WHERE id_pendiente='%s'"%parent)
 run("SELECT sgp_aluminio_pendiente_registrar_avance_v1('LIDER MECANIZADO','%s','%s',5,'T1','2026-10-25','%s');"%(parent,detail,advance_key))
 run("INSERT INTO sgp_picking_entregas VALUES('%s','50000000-0000-0000-0000-000000000001','QA-PROD',false,'VALIDADA')"%event)
 run("SELECT sgp_pdt_entrega_registrar_v2('PICKING','%s','%s',5,'%s')"%(detail,event,uuid.uuid4()))
 line=run("SELECT id_linea FROM sgp_pdt_entrega_lineas WHERE id_detalle='%s'"%detail)
 run("SELECT sgp_pdt_entrega_validar_v2('RECEPCION','%s');SELECT sgp_pdt_asignar_v2('RECEPCION','%s','%s')"%(line,line,uuid.uuid4()))
 for state in ['CORTE','MECANIZADO','PROCESADO']:run("SELECT sgp_pdt_estado_v2('LIDER MECANIZADO','%s','%s')"%(parent,state))
 movement=run("SELECT id_movimiento FROM sgp_aluminio_pendiente_movimientos WHERE idempotency_key='%s'"%advance_key)
 return parent,line,movement
parent,line,movement=full_fixture()
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 results=list(pool.map(sql,["SELECT sgp_pdt_cerrar_v2('COORDINADOR','%s','%s')"%(parent,uuid.uuid4()),"SELECT sgp_aluminio_pendiente_revertir_avance_v1('LIDER MECANIZADO','%s','%s','%s','QA race')"%(parent,movement,uuid.uuid4())]))
assert results[0].returncode==0 and results[1].returncode!=0
assert run("SELECT estado FROM sgp_aluminio_pendientes WHERE id_pendiente='%s'"%parent)=='RESUELTO'
print('PASS concurrent close/reversal cannot invalidate delivered quantity')
parent,line,movement=full_fixture()
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 results=list(pool.map(sql,["SELECT sgp_pdt_cerrar_v2('COORDINADOR','%s','%s')"%(parent,uuid.uuid4()),"SELECT sgp_pdt_entrega_anular_v2('COORDINADOR','%s','QA race')"%line]))
assert sorted(r.returncode==0 for r in results)==[False,True]
state=run("SELECT estado FROM sgp_aluminio_pendientes WHERE id_pendiente='%s'"%parent)
line_state=run("SELECT estado FROM sgp_pdt_entrega_lineas WHERE id_linea='%s'"%line)
assert (state=='RESUELTO' and line_state=='VALIDADA') or (state=='PENDIENTE' and line_state=='ANULADA')
print('PASS concurrent close/annul has no closed pending with annulled evidence')
