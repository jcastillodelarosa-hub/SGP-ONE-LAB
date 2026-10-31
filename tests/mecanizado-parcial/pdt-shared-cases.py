# Executed by integration.py against its new synthetic schema. Every business function is real.
def rpc(name,*args,ok=True):
 query='set role anon; select '+name+'('+','.join(jsonarg(a) if isinstance(a,(dict,list)) else ('true' if a is True else 'false' if a is False else 'null' if a is None else str(a) if isinstance(a,(int,float)) else literal(a)) for a in args)+');'
 text=sql(query,ok)
 return json.loads(text.splitlines()[-1]) if ok else text

shared_key='900288|PANELES_2';shared_prod='900288';shared_res='QA-SH-ROOT';associated='QA-SH-BLACK'
seed(shared_key,288,shared_res)
sql(f"update sgp_producciones set reserva_al='{shared_res},{associated}' where key_produccion='{shared_key}';")
seed('900289|PANELES_2',10,associated)
sql("update sgp_producciones set acabado='BLACK' where key_produccion='900289|PANELES_2';")
# An unrelated key with the same displayed production number must not leak through name matching.
seed('900290|PANELES_2',7,shared_res)
sql("update sgp_producciones set produccion='900288' where key_produccion='900290|PANELES_2';")
sql("""
insert into sgp_maestro_piezas(codigo_sap,tipo_pieza,destino_productivo) values('QA-PANEL','PANEL','PANEL'),('QA-FRAME','FRAME','FRAME');
insert into sgp_aluminio(id_pieza,id_carga,fila_origen,key_produccion,produccion,codigo_sap,sistema,tipo_pieza,acabado,fabricacion,longitud,cantidad,marca)
values('QA-SH-WHITE','QA',1,'900288|PANELES_2','900288','QA-PANEL','QA-S','PANEL','QA-A','E17',100,288,'M1'),
('QA-SH-BLACK','QA',2,'900288|PANELES_2','900288','QA-PANEL','QA-S','PANEL','BLACK','E18',120,288,'M2'),
('QA-SH-FRAME','QA',3,'900288|PANELES_2','900288','QA-FRAME','QA-S','FRAME','QA-A','F1',100,288,'F'),
('QA-SH-FOREIGN','QA',4,'900290|PANELES_2','900288','QA-PANEL','QA-S','PANEL','QA-A','E17',100,7,'AJENA');
insert into sgp_nc_aluminio(consecutivo,cod_nc,referencia,acabado,reserva,produccion,sistema,estado,reserva_solucion)
values('QA-SH-NC','QA-SH-COD','QA-PANEL','BLACK','QA-SH-BLACK','900288','QA-S','Abierta','QA-SH-SOL');
""")
program(shared_key,None,reserve=shared_res,parts=[{'cantidad':q,'fecha':'2026-10-28','turno':'TURNO 1','prioridad':i+1} for i,q in enumerate([90,90,90,18])])
shared_ids=[p['id_programacion'] for p in read(shared_key)['partes']]
state(shared_ids[0],shared_prod)
ctx={'id_programacion':shared_ids[0],'produccion':shared_prod,'completa':False,'cantidad_ventanas':90,'fecha_entrega':'2026-10-28','turno':'TURNO 1'}

def shared_metadata():
 rows=json.loads(sql("select jsonb_agg(to_jsonb(v)) from sgp_produccion_reservas_v v where key_produccion='900288|PANELES_2';"))
 expect({r['reserva'] for r in rows},{shared_res,associated})
 expect(all(r['reserva_principal']==shared_res and r['es_reserva_compartida'] for r in rows),True)
 expect(next(r['acabado_reserva'] for r in rows if r['reserva']==associated),'BLACK')
test('real: vista y funciones reconocen principal/compartida y sus acabados',shared_metadata)

def sources_exact():
 global real_sources
 real_sources=rpc('sgp_pdt_registro_fuentes_v4','qa-picking','PICKING',ctx)['fuentes']
 expect({r['id_pieza'] for r in real_sources},{'QA-SH-WHITE','QA-SH-BLACK'})
 expect({r['key_produccion'] for r in real_sources},{shared_key})
 expect(next(r['reserva'] for r in real_sources if r['id_pieza']=='QA-SH-BLACK'),associated)
test('real: fuentes PANEL incluyen acabado asociado y excluyen FRAME/clave homónima',sources_exact)

def black_piece():
 # Exercise the frontend's actual contract producer with sources returned by real SQL.
 source="""import {readFileSync} from 'node:fs';
 import {registrationPieces,sourceKey} from './src/domain/pdt-registration.js';
 const sources=JSON.parse(readFileSync(0,'utf8'));const piece=sources.find(x=>x.id_pieza==='QA-SH-BLACK');
 console.log(JSON.stringify(registrationPieces('PICKING',sources,[{source:sourceKey(piece),cantidad:2,ncs:['QA-SH-NC'],observacion:'QA material, no ventanas'}])[0]));"""
 out=shell(['node','--input-type=module','-e',source],json.dumps(real_sources)).stdout
 return json.loads(out)

def incomplete():
 global pending_black,origin_delivery
 key=str(uuid.uuid4());piece=black_piece()
 result=rpc('sgp_pdt_registrar_v4','qa-picking','PICKING',ctx,[piece],key)
 expect(rpc('sgp_pdt_registrar_v4','qa-picking','PICKING',ctx,[piece],key),result)
 pending_black=result['ids_pendientes'][0];origin_delivery=result['id_entrega']
 row=json.loads(sql(f"select to_jsonb(p) from sgp_aluminio_pendientes p where id_pendiente='{pending_black}';"))
 expect((row['key_produccion'],row['reserva'],row['reserva_principal'],row['acabado_pendiente'],row['cantidad']),(shared_key,associated,shared_res,'BLACK',2))
 expect(sql(f"select count(*) from sgp_picking_faltantes where id_entrega='{origin_delivery}' and id_pieza='QA-SH-BLACK' and cantidad=2;"),'1')
 expect(sql(f"select count(*) from sgp_aluminio_pendiente_ncs where id_pendiente='{pending_black}' and consecutivo='QA-SH-NC';"),'1')
 expect(sql("select estado from sgp_nc_aluminio where consecutivo='QA-SH-NC';"),'Abierta')
test('real: payload JS de fuentes SQL crea PDT/faltante/NC; reintento no duplica',incomplete)

def nc_real_link():
 expect('PERMISO_DENEGADO' in sql(f"set role anon; select sgp_aluminio_pendiente_nc_vincular_v1('qa-consulta','{pending_black}',array['QA-SH-COD']);",False),True)
 value=sql(f"set role anon; select sgp_aluminio_pendiente_nc_vincular_v1('qa-coordinador','{pending_black}',array['QA-SH-COD','QA-SH-NC']);")
 expect(json.loads(value.splitlines()[-1])['duplicado'],True)
 expect(sql(f"select count(*) from sgp_aluminio_pendiente_ncs where id_pendiente='{pending_black}';"),'1')
test('real: RPC NC resuelve código/consecutivo sin duplicar y conserva permisos',nc_real_link)

def reception_exact():
 sql(f"""begin;update public.sgp_producciones set semana_actual=45 where key_produccion='900290|PANELES_2';
 do $case$ declare r jsonb;begin
 select value into strict r from jsonb_array_elements(public.sgp_picking_recepcion_cola('qa-picking')) where value->>'id_entrega'='{origin_delivery}';
 if r->>'key_produccion'<>'{shared_key}' or (r->>'cantidad_ventanas')::integer<>90 or r->>'identificador_parte'<>'900288-P1' then raise exception 'RECEPCION_CLAVE_CANTIDAD_O_PARTE_INCORRECTA';end if;
 if (r->'faltantes'->0->>'acabado')<>'BLACK' or (r->'faltantes'->0->>'reserva')<>'{associated}' then raise exception 'RECEPCION_PERDIO_MATERIAL_COMPARTIDO';end if;
 end $case$;rollback;""")
test('real: Recepción conserva clave/P1/90 y material asociado pese a producción homónima',reception_exact)

def reject_foreign():
 for change in [{'key_produccion':'900290|PANELES_2'},{'reserva':'AJENA'},{'acabado':'AJENO'},{'cantidad':289},{'id_pieza':'QA-SH-FRAME','perfil':'QA-FRAME'}]:
  rpc('sgp_pdt_registrar_v4','qa-picking','PICKING',{**ctx,'cantidad_ventanas':0},[{**black_piece(),**change}],str(uuid.uuid4()),ok=False)
test('real: clave/reserva/acabado/FRAME y exceso material ajenos rechazados',reject_foreign)

def validation():
 global black_detail
 detail={'id_pieza':'QA-SH-BLACK','fabricacion':'E18','longitud':120,'acabado':'BLACK','cantidad':2}
 rpc('sgp_aluminio_pendiente_validar_detalles_v1','qa-mecanizado',pending_black,[detail],associated,'QA',ok=False)
 rpc('sgp_aluminio_pendiente_validar_detalles_v1','qa-coordinador',pending_black,[{**detail,'id_pieza':'QA-SH-FOREIGN'}],associated,'QA',ok=False)
 rpc('sgp_aluminio_pendiente_validar_detalles_v1','qa-coordinador',pending_black,[detail],associated,'QA validado')
 black_detail=sql(f"select id_detalle from sgp_aluminio_pendiente_detalles where id_pendiente='{pending_black}';")
 expect(sql(f"select validacion_estado from sgp_aluminio_pendientes where id_pendiente='{pending_black}';"),'VALIDADO')
test('real: validación de fabricación/fuente y permisos sin sustituir la función',validation)

def process_pdt():
 rpc('sgp_pdt_estado_v2','qa-mecanizado',pending_black,'CORTE')
 rpc('sgp_pdt_estado_v2','qa-mecanizado',pending_black,'MECANIZADO')
 k=str(uuid.uuid4())
 rpc('sgp_aluminio_pendiente_registrar_avance_v1','qa-recepcion',pending_black,black_detail,1,'T1','2026-10-28',k,'QA',ok=False)
 rpc('sgp_aluminio_pendiente_registrar_avance_v1','qa-mecanizado',pending_black,black_detail,1,'T1','2026-10-28',k,'QA')
 expect(rpc('sgp_aluminio_pendiente_registrar_avance_v1','qa-mecanizado',pending_black,black_detail,1,'T1','2026-10-28',k,'QA')['duplicado'],True)
 rpc('sgp_pdt_estado_v2','qa-mecanizado',pending_black,'PROCESADO',ok=False)
 rpc('sgp_aluminio_pendiente_registrar_avance_v1','qa-mecanizado',pending_black,black_detail,2,'T1','2026-10-28',str(uuid.uuid4()),'exceso',ok=False)
 rpc('sgp_aluminio_pendiente_registrar_avance_v1','qa-mecanizado',pending_black,black_detail,1,'T1','2026-10-28',str(uuid.uuid4()),'QA resto')
 rpc('sgp_pdt_estado_v2','qa-mecanizado',pending_black,'PROCESADO')
 rpc('sgp_pdt_cerrar_v2','qa-coordinador',pending_black,str(uuid.uuid4()),ok=False)
 expect(sql(f"select estado from sgp_aluminio_pendientes where id_pendiente='{pending_black}';"),'PENDIENTE')
test('real: avances parciales/idempotentes; saldo mecanizado cero no cierra PDT',process_pdt)

def audit_origin():
 missing=json.loads(sql(f"select jsonb_agg(jsonb_build_object('id_faltante',id_faltante,'id_pieza',id_pieza,'ventanas_afectadas',2)) from sgp_picking_faltantes where id_entrega='{origin_delivery}';"))
 rpc('sgp_picking_validar_recepcion','qa-picking',origin_delivery,missing,[],'QA auditoría')
 expect(sql(f"select estado from sgp_picking_entregas where id_entrega='{origin_delivery}';"),'VALIDADA')
 expect(sql(f"select auditado from sgp_picking_faltantes where id_entrega='{origin_delivery}';"),'t')
 rpc('sgp_pdt_entrega_registrar_v2','qa-picking',black_detail,origin_delivery,2,str(uuid.uuid4()),ok=False)
test('real: auditoría de faltantes; evento con falta no acredita su propia reposición',audit_origin)

def material_recovery():
 global recovery_delivery,recovery_line
 recovery={**ctx,'completa':True,'cantidad_ventanas':0}
 result=rpc('sgp_pdt_registrar_v4','qa-picking','PICKING',recovery,[],str(uuid.uuid4()))
 recovery_delivery=result['id_entrega']
 line=rpc('sgp_pdt_entrega_registrar_v2','qa-picking',black_detail,recovery_delivery,2,str(uuid.uuid4()))
 recovery_line=line['id_linea']
 rpc('sgp_pdt_entrega_validar_v2','qa-recepcion',recovery_line,ok=False)
 rpc('sgp_picking_validar_recepcion','qa-picking',recovery_delivery,[],[],'QA material recibido')
 rpc('sgp_pdt_entrega_validar_v2','qa-recepcion',recovery_line)
 rpc('sgp_pdt_asignar_v2','qa-recepcion',recovery_line,str(uuid.uuid4()))
 close_key=str(uuid.uuid4())
 expect(rpc('sgp_pdt_cerrar_v2','qa-coordinador',pending_black,close_key)['ok'],True)
 expect(rpc('sgp_pdt_cerrar_v2','qa-coordinador',pending_black,close_key)['duplicado'],True)
 expect(sql(f"select estado from sgp_aluminio_pendientes where id_pendiente='{pending_black}';"),'RESUELTO')
 expect(read(shared_key)['partes'][0]['entregada'],90)
test('real: reposición de PANEL sin volver a sumar ventanas; validar/asignar/cerrar',material_recovery)

def independent():
 data=read(shared_key)
 expect([p['procesada'] for p in data['partes']],[90,0,0,0])
 expect([p['entregada'] for p in data['partes']],[90,0,0,0])
 expect((data['original'],data['programada'],data['disponible']),(288,288,0))
 rows=rpc('sgp_consultar_ensamble','qa-coordinador',44,'PANELES_2')['filas']
 expect(next(r['estado_mecanizado'] for r in rows if r['key_produccion']==shared_key),'MECANIZADO')
 expect(next(r['estado_mecanizado'] for r in rows if r['key_produccion']=='900290|PANELES_2'),'—')
 queue=rpc('sgp_picking_cola','qa-picking');parts=[r for r in queue if r.get('parte_id') in shared_ids]
 expect(sorted(r['cantidad_ventanas'] for r in parts),[18,90,90,90])
 expect(next(r['pdt_abiertos'] for r in parts if r['id_programacion']==shared_ids[0]),0)
test('real: cerrar PDT/P1 no cierra P2-P4 ni otra clave homónima ni original',independent)

def closed_nc_no_auto():
 expect(sql("select estado from sgp_nc_aluminio where consecutivo='QA-SH-NC';"),'Abierta')
 # Synthetic NC state change represents the NC module's independent input, not PDT completion.
 sql("update sgp_nc_aluminio set estado='Finalizada',fecha_cierre=now() where consecutivo='QA-SH-NC';")
 expect(sql(f"select estado from sgp_aluminio_pendientes where id_pendiente='{pending_black}';"),'RESUELTO')
 # Create another real report referencing the now-finalized NC: it must remain POR_VALIDAR/PENDIENTE.
 global pending_nc
 r=rpc('sgp_pdt_registrar_v4','qa-picking','PICKING',{**ctx,'cantidad_ventanas':0},[black_piece()],str(uuid.uuid4()))
 pending_nc=r['ids_pendientes'][0]
 row=json.loads(sql(f"select jsonb_build_array(validacion_estado,estado,estado_repo) from sgp_aluminio_pendientes where id_pendiente='{pending_nc}';"))
 expect(row,['POR_VALIDAR','PENDIENTE','PENDIENTE'])
 rpc('sgp_pdt_cerrar_v2','qa-coordinador',pending_nc,str(uuid.uuid4()),ok=False)
test('real: NC finalizada no valida ni procesa ni cierra un nuevo PDT',closed_nc_no_auto)

def audit_isolation():
 # Independent report for the same PANEL/production; audit only its own origin event.
 sql(f"""begin;
 do $case$ declare r jsonb; eid uuid; newp uuid; oldflag boolean;
 begin
 r:=public.sgp_pdt_registrar_v4('qa-picking','PICKING',{jsonarg({**ctx,'cantidad_ventanas':0})},{jsonarg([black_piece()])},'{uuid.uuid4()}');
 eid:=(r->>'id_entrega')::uuid;
 select auditado into oldflag from public.sgp_aluminio_pendientes where id_pendiente='{pending_nc}';
 perform public.sgp_picking_validar_recepcion('qa-picking',eid,
 (select jsonb_agg(jsonb_build_object('id_faltante',id_faltante,'id_pieza',id_pieza,'ventanas_afectadas',1)) from public.sgp_picking_faltantes where id_entrega=eid),'[]','QA isolate');
 if (select auditado from public.sgp_aluminio_pendientes where id_pendiente='{pending_nc}') is distinct from oldflag then raise exception 'AUDITORIA_ALTERO_OTRO_EVENTO'; end if;
 end $case$;rollback;""")
test('real: auditar un evento no marca otro PDT de la misma pieza/producción',audit_isolation)

def grouped_real():
 global grouped_pending
 sql("insert into sgp_aluminio(id_pieza,id_carga,fila_origen,key_produccion,produccion,codigo_sap,sistema,tipo_pieza,acabado,fabricacion,longitud,cantidad,marca) select 'QA-SH-BLACK-2','QA',5,key_produccion,produccion,codigo_sap,sistema,tipo_pieza,acabado,fabricacion,longitud,cantidad,'M3' from sgp_aluminio where id_pieza='QA-SH-BLACK';")
 grouped_pending=pending_nc
 d={'id_pieza':'','fabricacion':'E18','longitud':120,'acabado':'BLACK','cantidad':2}
 rpc('sgp_aluminio_pendiente_validar_detalles_v1','qa-coordinador',grouped_pending,[d],associated,'QA grouped actual sources')
 det=sql(f"select id_detalle from sgp_aluminio_pendiente_detalles where id_pendiente='{grouped_pending}';")
 expect(sql(f"select count(*) from sgp_pdt_fuentes where id_detalle='{det}';"),'2')
 rpc('sgp_pdt_estado_v2','qa-mecanizado',grouped_pending,'CORTE');rpc('sgp_pdt_estado_v2','qa-mecanizado',grouped_pending,'MECANIZADO')
 rpc('sgp_aluminio_pendiente_registrar_avance_v1','qa-mecanizado',grouped_pending,det,2,'T1','2026-10-28',str(uuid.uuid4()),'QA grouped')
 rpc('sgp_pdt_estado_v2','qa-mecanizado',grouped_pending,'PROCESADO')
 replacement=rpc('sgp_pdt_registrar_v4','qa-picking','PICKING',{**ctx,'completa':True,'cantidad_ventanas':0},[],str(uuid.uuid4()))['id_entrega']
 line=rpc('sgp_pdt_entrega_registrar_v2','qa-picking',det,replacement,2,str(uuid.uuid4()))['id_linea']
 rpc('sgp_picking_validar_recepcion','qa-picking',replacement,[],[],'QA grouped reception')
 rpc('sgp_pdt_entrega_validar_v2','qa-recepcion',line);rpc('sgp_pdt_asignar_v2','qa-recepcion',line,str(uuid.uuid4()))
 expect(rpc('sgp_pdt_cerrar_v2','qa-coordinador',grouped_pending,str(uuid.uuid4()))['ok'],True)
 expect(read(shared_key)['partes'][0]['entregada'],90)
test('real: validación agrupada con dos fuentes; Picking y cierre no duplican cantidades',grouped_real)

def reports_reception():
 queue=rpc('sgp_picking_cola','qa-picking');p1=next(r for r in queue if r.get('parte_id')==shared_ids[0])
 expect((p1['cantidad_ventanas'],p1['cantidad_entregada'],p1['pdt_abiertos']),(90,90,0))
 report=rpc('sgp_picking_reporte_entregas_v1','qa-picking','2026-10-28','2026-10-28',None,None,500,0)
 rows=[r for r in report['rows'] if r.get('parte_id') in shared_ids]
 expect(sum(r['cantidad_ventanas_entregadas'] for r in rows),90)
 expect({r['key_produccion_parte'] for r in rows},{shared_key})
 expect(all(r['parte_id']==shared_ids[0] for r in rows),True)
 expect(read(shared_key)['original'],288)
 expect(sql(f"select sum(en.cantidad) from sgp_mecanizado_parcial.entregas en join sgp_picking_entregas pe using(id_entrega) where en.id_programacion='{shared_ids[0]}' and pe.estado='VALIDADA';"),'90')
test('real: informes y Picking separan 90 ventanas de reposiciones de material con 0',reports_reception)

def other_part_evidence_rejected():
 # Same production/key and finish is insufficient: a shortage from P1 cannot use P2's event.
 sql(f"""begin;do $case$ declare r jsonb; other uuid; pending uuid; detail uuid; denied boolean:=false;
 begin
 r:=public.sgp_pdt_registrar_v4('qa-picking','PICKING',{jsonarg({**ctx,'cantidad_ventanas':0})},{jsonarg([black_piece()])},'{uuid.uuid4()}');
 pending:=(r->'ids_pendientes'->>0)::uuid;
 perform public.sgp_aluminio_pendiente_validar_detalles_v1('qa-coordinador',pending,'[{{"id_pieza":"QA-SH-BLACK","fabricacion":"E18","longitud":120,"acabado":"BLACK","cantidad":2}}]','{associated}','QA P1 evidence');
 select id_detalle into strict detail from public.sgp_aluminio_pendiente_detalles where id_pendiente=pending;
 perform public.sgp_pdt_estado_v2('qa-mecanizado',pending,'CORTE');perform public.sgp_pdt_estado_v2('qa-mecanizado',pending,'MECANIZADO');
 perform public.sgp_aluminio_pendiente_registrar_avance_v1('qa-mecanizado',pending,detail,2,'T1','2026-10-28','{uuid.uuid4()}','QA advance before delivery');
 perform public.sgp_pdt_estado_v2('qa-mecanizado',pending,'PROCESADO');
 perform public.sgp_mecanizado_guardar_estado_orden('qa-coordinador','{shared_ids[1]}','{shared_prod}','PROCESADO','QA temporary P2');
 r:=public.sgp_pdt_registrar_v4('qa-picking','PICKING',{jsonarg({**ctx,'id_programacion':shared_ids[1],'completa':True,'cantidad_ventanas':90})},'[]','{uuid.uuid4()}');
 other:=(r->>'id_entrega')::uuid;
 begin perform public.sgp_pdt_entrega_registrar_v2('qa-picking',detail,other,1,'{uuid.uuid4()}');
 exception when others then denied:=true; if sqlerrm not like '%ajena%' then raise; end if; end;
 if not denied then raise exception 'EVIDENCIA_DE_OTRA_PARTE_ACEPTADA'; end if;
 end $case$;rollback;""")
 expect([p['procesada'] for p in read(shared_key)['partes']],[90,0,0,0])
test('real: evidencia de P2 no se usa para cerrar un PDT originado en P1',other_part_evidence_rejected)

def audit_difference_real():
 sql(f"""begin;do $case$ declare r jsonb; eid uuid; pending uuid; detalle uuid; replacement uuid; line uuid; rejected boolean;
 begin
 perform public.sgp_mecanizado_guardar_estado_orden('qa-coordinador','{shared_ids[1]}','{shared_prod}','PROCESADO','QA audit P2');
 r:=public.sgp_pdt_registrar_v4('qa-picking','PICKING',{jsonarg({**ctx,'id_programacion':shared_ids[1],'completa':True,'cantidad_ventanas':90})},'[]','{uuid.uuid4()}');
 eid:=(r->>'id_entrega')::uuid;
 rejected:=false;
 begin perform public.sgp_picking_validar_recepcion('qa-picking',eid,'[]',{jsonarg([{**black_piece(),'cantidad':-1,'ventanas_afectadas':1}])},'QA reject negative');
 exception when others then if sqlerrm<>'CANTIDAD_MATERIAL_INVALIDA' then raise;end if;rejected:=true;end;
 if not rejected then raise exception 'NEGATIVE_MATERIAL_ACCEPTED';end if;
 rejected:=false;
 begin perform public.sgp_picking_validar_recepcion('qa-picking',eid,'[]',{jsonarg([{**black_piece(),'cantidad':1,'ventanas_afectadas':91}])},'QA reject affected');
 exception when others then if sqlerrm<>'VENTANAS_AFECTADAS_SUPERAN_PARTE' then raise;end if;rejected:=true;end;
 if not rejected then raise exception 'AFFECTED_EXCEEDS_PART';end if;
 r:=public.sgp_picking_validar_recepcion('qa-picking',eid,'[]',{jsonarg([{**black_piece(),'cantidad':1,'ventanas_afectadas':1}])},'QA diferencia material');
 if r->>'estado'<>'AUDITADA_DIFERENCIA' then raise exception 'AUDIT_STATE'; end if;
 select id_pendiente into strict pending from sgp_mecanizado_parcial.origenes_pdt where id_entrega=eid;
 perform public.sgp_aluminio_pendiente_validar_detalles_v1('qa-coordinador',pending,'[{{"id_pieza":"QA-SH-BLACK","fabricacion":"E18","longitud":120,"acabado":"BLACK","cantidad":1}}]','{associated}','QA audit validation');
 select id_detalle into strict detalle from public.sgp_aluminio_pendiente_detalles where id_pendiente=pending;
 perform public.sgp_pdt_estado_v2('qa-mecanizado',pending,'CORTE');perform public.sgp_pdt_estado_v2('qa-mecanizado',pending,'MECANIZADO');
 perform public.sgp_aluminio_pendiente_registrar_avance_v1('qa-mecanizado',pending,detalle,1,'T1','2026-10-28','{uuid.uuid4()}','QA audit advance');
 perform public.sgp_pdt_estado_v2('qa-mecanizado',pending,'PROCESADO');
 r:=public.sgp_pdt_registrar_v4('qa-picking','PICKING',{jsonarg({**ctx,'id_programacion':shared_ids[1],'completa':True,'cantidad_ventanas':0})},'[]','{uuid.uuid4()}');replacement:=(r->>'id_entrega')::uuid;
 r:=public.sgp_pdt_entrega_registrar_v2('qa-picking',detalle,replacement,1,'{uuid.uuid4()}');line:=(r->>'id_linea')::uuid;
 perform public.sgp_picking_validar_recepcion('qa-picking',replacement,'[]','[]','QA replacement');
 perform public.sgp_pdt_entrega_validar_v2('qa-recepcion',line);perform public.sgp_pdt_asignar_v2('qa-recepcion',line,'{uuid.uuid4()}');
 r:=public.sgp_pdt_cerrar_v2('qa-coordinador',pending,'{uuid.uuid4()}');
 if r->>'ok'<>'true' then raise exception 'AUDIT_PDT_NOT_CLOSED'; end if;
 end $case$;rollback;""")
 expect([p['procesada'] for p in read(shared_key)['partes']],[90,0,0,0])
test('real: diferencias de auditoría siguen validación/avance/reposición/cierre',audit_difference_real)

def legacy_real_cycle():
 # Historical whole-order header, no new part metadata. Still use real V4 + real PDT functions.
 seed('900400|PANELES_2',6,'QA-LEGACY-R')
 sql("insert into sgp_aluminio(id_pieza,id_carga,fila_origen,key_produccion,produccion,codigo_sap,sistema,tipo_pieza,acabado,fabricacion,longitud,cantidad) values('QA-LEGACY-PANEL','QA',40,'900400|PANELES_2','900400','QA-PANEL','QA-S','PANEL','QA-A','LEG-FAB',80,6);")
 legacy=sql("select sgp_mecanizado_programar('qa-coordinador','QA-LEGACY-R','900400',6,'2026-10-28','TURNO 1',1,'QA','QA','1.1');")
 expect(sql(f"select sgp_mecanizado_es_parte('{legacy}');"),'f')
 context={'id_programacion':legacy,'produccion':'900400','completa':False,'fecha_entrega':'2026-10-28','turno':'TURNO 1'}
 source=rpc('sgp_pdt_registro_fuentes_v4','qa-picking','PICKING',context)['fuentes'][0]
 piece={**source,'perfil':source['codigo_sap'],'cantidad':1,'nc':None}
 report=rpc('sgp_pdt_registrar_v4','qa-picking','PICKING',context,[piece],str(uuid.uuid4()))
 pending=report['ids_pendientes'][0]
 rpc('sgp_aluminio_pendiente_validar_detalles_v1','qa-coordinador',pending,[{'id_pieza':'QA-LEGACY-PANEL','fabricacion':'LEG-FAB','longitud':80,'acabado':'QA-A','cantidad':1}],'QA-LEGACY-R','QA legacy')
 detail=sql(f"select id_detalle from sgp_aluminio_pendiente_detalles where id_pendiente='{pending}';")
 rpc('sgp_pdt_estado_v2','qa-mecanizado',pending,'CORTE');rpc('sgp_pdt_estado_v2','qa-mecanizado',pending,'MECANIZADO')
 rpc('sgp_aluminio_pendiente_registrar_avance_v1','qa-mecanizado',pending,detail,1,'T1','2026-10-28',str(uuid.uuid4()),'QA legacy real')
 rpc('sgp_pdt_estado_v2','qa-mecanizado',pending,'PROCESADO')
 replacement=rpc('sgp_pdt_registrar_v4','qa-picking','PICKING',{**context,'completa':True},[],str(uuid.uuid4()))['id_entrega']
 line=rpc('sgp_pdt_entrega_registrar_v2','qa-picking',detail,replacement,1,str(uuid.uuid4()))['id_linea']
 rpc('sgp_picking_validar_recepcion','qa-picking',replacement,[],[],'QA legacy receive')
 rpc('sgp_pdt_entrega_validar_v2','qa-recepcion',line);rpc('sgp_pdt_asignar_v2','qa-recepcion',line,str(uuid.uuid4()))
 expect(rpc('sgp_pdt_cerrar_v2','qa-coordinador',pending,str(uuid.uuid4()))['ok'],True)
 expect(read('900400|PANELES_2')['original'],6)
test('real: cabecera histórica sin partes mantiene registro/validación/Picking/cierre V4',legacy_real_cycle)

def no_stub_fingerprints():
 import hashlib
 data=json.loads((ROOT/'tests/mecanizado-parcial/catalog-pdt-real.json').read_text())
 exact=['sgp_pdt_multiorigen.actor','sgp_pdt_multiorigen.registrar','sgp_pdt_contexto_internal_v3','sgp_pdt_origenes_internal_v3',
 'sgp_aluminio_pendiente_validar_detalles_v1','sgp_pdt_multiorigen.nuevo_sgp_aluminio_pendiente_validar_detalles_v1',
 'sgp_pdt_multiorigen.grouped_nuevo_validar','sgp_aluminio_pendiente_registrar_avance_v1','sgp_pdt_manual.original_avance',
 'sgp_pdt_estado_v2','sgp_pdt_guardar_contrato','sgp_pdt_entrega_validar_v2','sgp_pdt_asignar_v2','sgp_pdt_cerrar_v2','sgp_pdt_manual.original_cerrar_v2',
 'sgp_aluminio_pendiente_nc_vincular_v1','sgp_es_reserva_compartida','sgp_reserva_es_principal','sgp_reservas_por_produccion_json']
 evidence=[]
 for name in exact:
  f=next(x for x in data['functions'] if x['signature'].split('(')[0]==name)
  expected=hashlib.md5(f['definition'].encode()).hexdigest()
  actual=sql(f"select md5(pg_get_functiondef({literal(f['signature'])}::regprocedure));")
  expect(actual,expected);evidence.append({'signature':f['signature'],'md5_actual_catalog_and_test':expected,'stub':False})
 view=next(r['view'] for r in data['relations'] if r['name']=='sgp_produccion_reservas_v')
 expect(sql("select md5(pg_get_viewdef('sgp_produccion_reservas_v'::regclass,true));"),hashlib.md5(view.encode()).hexdigest())
 (ROOT/'tests/mecanizado-parcial/real-function-evidence.json').write_text(json.dumps({'functions':evidence,'view_md5':hashlib.md5(view.encode()).hexdigest(),'data':'synthetic only; no backup or database copy'},indent=2)+'\n')
test('sin stubs: 19 funciones núcleo tienen huella idéntica al catálogo vivo leído',no_stub_fingerprints)

def concurrent_real_pdt():
 report=rpc('sgp_pdt_registrar_v4','qa-picking','PICKING',{**ctx,'cantidad_ventanas':0},[black_piece()],str(uuid.uuid4()))
 pending=report['ids_pendientes'][0]
 rpc('sgp_aluminio_pendiente_validar_detalles_v1','qa-coordinador',pending,[{'id_pieza':'QA-SH-BLACK','fabricacion':'E18','longitud':120,'acabado':'BLACK','cantidad':2}],associated,'QA race real PDT')
 detail=sql(f"select id_detalle from sgp_aluminio_pendiente_detalles where id_pendiente='{pending}';")
 rpc('sgp_pdt_estado_v2','qa-mecanizado',pending,'CORTE');rpc('sgp_pdt_estado_v2','qa-mecanizado',pending,'MECANIZADO')
 def advance(_):
  try:return rpc('sgp_aluminio_pendiente_registrar_avance_v1','qa-mecanizado',pending,detail,2,'T1','2026-10-28',str(uuid.uuid4()),'QA concurrent')
  except AssertionError as e:
   assert 'supera saldo' in str(e),str(e)
   return None
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:expect(sum(r is not None for r in pool.map(advance,range(2))),1)
 expect(sql(f"select sum(cantidad) from sgp_aluminio_pendiente_movimientos where id_detalle='{detail}' and tipo='AVANCE';"),'2')
 rpc('sgp_pdt_estado_v2','qa-mecanizado',pending,'PROCESADO')
 eid=rpc('sgp_pdt_registrar_v4','qa-picking','PICKING',{**ctx,'completa':True,'cantidad_ventanas':0},[],str(uuid.uuid4()))['id_entrega']
 def deliver(_):
  try:return rpc('sgp_pdt_entrega_registrar_v2','qa-picking',detail,eid,2,str(uuid.uuid4()))
  except AssertionError as e:
   assert 'supera procesado' in str(e),str(e)
   return None
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:lines=[r for r in pool.map(deliver,range(2)) if r is not None]
 expect(len(lines),1);line=lines[0]['id_linea']
 rpc('sgp_picking_validar_recepcion','qa-picking',eid,[],[],'QA concurrent replacement')
 rpc('sgp_pdt_entrega_validar_v2','qa-recepcion',line);rpc('sgp_pdt_asignar_v2','qa-recepcion',line,str(uuid.uuid4()))
 rpc('sgp_pdt_cerrar_v2','qa-coordinador',pending,str(uuid.uuid4()))
 expect([p['entregada'] for p in read(shared_key)['partes']],[90,0,0,0])
test('real: avances y entregas PDT concurrentes rechazan exceso y conservan 90 ventanas',concurrent_real_pdt)

def physical_report_real_payload():
 keys=[shared_key,'900290|PANELES_2']
 base=json.loads(sql("select jsonb_agg(to_jsonb(p)) from sgp_producciones p where key_produccion in ('900288|PANELES_2','900290|PANELES_2');"))
 schedule=[r for r in rpc('sgp_mecanizado_programacion_listar','qa-coordinador') if r.get('parte_id') in shared_ids]
 executions=json.loads(sql("select coalesce(jsonb_agg(to_jsonb(e)),'[]') from sgp_mecanizado_ejecucion e join sgp_mecanizado_parcial.partes pt using(id_programacion) where pt.key_produccion='900288|PANELES_2';"))
 orders=json.loads(sql("select coalesce(jsonb_agg(to_jsonb(e)),'[]') from sgp_mecanizado_ejecucion_orden e join sgp_mecanizado_parcial.partes pt using(id_programacion) where pt.key_produccion='900288|PANELES_2';"))
 links=json.loads(sql("select jsonb_agg(to_jsonb(v)) from sgp_produccion_reservas_v v where key_produccion in ('900288|PANELES_2','900290|PANELES_2');"))
 relations=[{'key_produccion':key,'reserva_principal':shared_res,'es_reserva_compartida':sql(f"select sgp_es_reserva_compartida({literal(key)});")=='t','reservas':rpc('sgp_reservas_por_produccion_json',key)} for key in keys]
 coverage=[r for r in rpc('sgp_mecanizado_cobertura_ordenes','qa-coordinador',44) if r['key_produccion'] in keys]
 data={'base':base,'receipts':[{'reserva':r,'estado':'RECIBIDA','completa':True,'fecha_recepcion':'2026-10-28'} for r in [shared_res,associated]],'shared':relations,'schedule':schedule,'executions':executions,'orderExecutions':orders,'moves':[],'links':links,'coverage':coverage}
 source="""import {readFileSync} from 'node:fs';import {basePhysicalProgress} from './src/domain/mecanizado-base-progress.js';const d=JSON.parse(readFileSync(0,'utf8'));console.log(JSON.stringify([basePhysicalProgress(d,{year:2026,weeks:[44]}).total,basePhysicalProgress({...d,base:d.base.filter(x=>x.key_produccion==='900288|PANELES_2')},{year:2026,weeks:[44]}).total]));"""
 output=json.loads(shell(['node','--input-type=module','-e',source],json.dumps(data)).stdout)
 expect((output[0]['programmed'],output[0]['processed'],output[0]['pending']),(295,90,205))
 expect((output[1]['programmed'],output[1]['processed'],output[1]['pending']),(288,90,198))
 (ROOT/'tests/mecanizado-parcial/physical-report-evidence.json').write_text(json.dumps({'sql_inputs':'actual synthetic production/parts/coverage/execution/relations; reception DTOs are explicit synthetic input data','totals':output},indent=2)+'\n')
test('real: informe JS consume contratos SQL; 90/288 sin atribuir avances a homónimas',physical_report_real_payload)
