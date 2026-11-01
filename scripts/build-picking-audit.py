"""Build targeted REVIEW patches from read-only captured production definitions."""
import json,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
c=json.loads((root/'tests/picking-audit-catalog.json').read_text())+json.loads((root/'tests/picking-audit/roles-catalog.json').read_text())+json.loads((root/'tests/picking-audit/guard-catalog.json').read_text())
c += [f for f in json.loads((root/'tests/picking-audit/compatibility-live.json').read_text())['functions'] if f['name']=='sgp_picking_piezas']
c=list({f['signature']:f for f in c}.values())
patches=[];rollback=[]
for f in c:
 s=f['definition'];new=s
 if f['name'] in ('sgp_picking_recepcion_cola','sgp_picking_piezas_panel','sgp_picking_piezas'):
  new=new.replace('public.sgp_validar_sesion_rol(', 'public.sgp_pdt_validar_rol_real(').replace('u:=sgp_validar_sesion_rol(', 'u:=public.sgp_pdt_validar_rol_real(')
 if f['name']=='sgp_picking_recepcion_cola':
  # Reception gets exactly the Picking source/read authorization needed for audit.
  new=new.replace("'SUPERVISOR DE PICKING'","'SUPERVISOR DE PICKING','RECEPCION'")
 if f['name'] in ('sgp_picking_piezas_panel','sgp_picking_piezas'):
  # Add Reception only while an audit-owned capability is active, not to the public reader generally.
  new=new.replace("'SUPERVISOR DE PICKING','LIDER LINEA']", "'SUPERVISOR DE PICKING','LIDER LINEA'] || CASE WHEN EXISTS(SELECT 1 FROM sgp_picking_audit.contextos a WHERE a.transaccion=pg_current_xact_id()::text) THEN ARRAY['RECEPCION'] ELSE ARRAY[]::text[] END")
 if f['name']=='actor':
  new=new.replace(" IF p_origen='PICKING' THEN", """ IF p_origen='PICKING' AND EXISTS(
 SELECT 1 FROM sgp_picking_audit.contextos a WHERE a.transaccion=pg_current_xact_id()::text
 AND a.usuario=public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING','LIDER LINEA','LIDER','RECEPCION'])) THEN
 RETURN public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING','LIDER LINEA','LIDER','RECEPCION']);
 END IF;
 IF p_origen='PICKING' THEN""")
 if f['name']=='sgp_picking_reporte_entregas_v1':
  new=new.replace('e.usuario_validacion,e.fecha_validacion,', "e.usuario_validacion,e.fecha_validacion,(select ae.fecha_recepcion from sgp_picking_audit.eventos ae where ae.id_entrega=e.id_entrega) fecha_recepcion,(select ae.turno_recepcion from sgp_picking_audit.eventos ae where ae.id_entrega=e.id_entrega) turno_recepcion,(select jsonb_agg(to_jsonb(ad) order by ad.id_faltante) from sgp_picking_audit.decisiones ad where ad.id_entrega=e.id_entrega) decisiones_auditoria,")
  new=new.replace('f.id_entrega=e.id_entrega','f.id_entrega=e.id_entrega AND NOT EXISTS(SELECT 1 FROM sgp_picking_audit.decisiones ad WHERE ad.id_faltante=f.id_faltante AND ad.accion=\'ELIMINAR\')')
 if f['name']=='sgp_pdt_guardar_contrato':
  new=new.replace("IF NEW.cantidad IS DISTINCT FROM OLD.cantidad THEN", "IF NEW.cantidad IS DISTINCT FROM OLD.cantidad AND NOT EXISTS(SELECT 1 FROM sgp_picking_audit.correcciones a WHERE a.id_pendiente=OLD.id_pendiente AND a.transaccion=pg_current_xact_id()::text AND a.anterior=OLD.cantidad AND a.nueva=NEW.cantidad) THEN")
  new=new.replace("IF OLD.estado='RESUELTO' OR", "IF OLD.estado IN ('RESUELTO','ANULADO') OR")
 if new==s:continue
 # Assert complete definition, including grants unaffected by CREATE OR REPLACE.
 escaped=s.replace("'","''")
 sig=f['signature'];sig=sig if '.' in sig.split('(')[0] else 'public.'+sig
 patches.append(f"do $guard$ begin if pg_get_functiondef('{sig}'::regprocedure) is distinct from '{escaped}' then raise exception 'CATALOGO_CAMBIO: {sig}';end if;end $guard$;\n"+new+';')
 rollback.append(s+';')
patches.append('revoke insert,update,delete,truncate,references,trigger,maintain on public.sgp_picking_auditoria_diferencias from public,anon,authenticated;')
rollback.append('grant insert,update,delete,truncate,references,trigger,maintain on public.sgp_picking_auditoria_diferencias to anon,authenticated;')
(root/'docs/sql-proposals/picking-audit/02-review-contracts.sql').write_text('begin;\n'+'\n'.join(patches)+'\ncommit;\n')
(root/'docs/sql-proposals/picking-audit/rollback-review.sql').write_text("begin;\ndo $$ begin if exists(select 1 from sgp_picking_audit.eventos) then raise exception 'AUDITORIA_EN_USO_REQUIERE_CORRECCION_FORWARD';end if;end $$;\n"+'\n'.join(rollback)+"\ndrop function public.sgp_picking_auditoria_contexto(text,uuid);\ndrop function public.sgp_picking_auditoria_guardar(text,uuid,text,uuid,date,text,jsonb,jsonb,text);\ndrop schema sgp_picking_audit cascade;\ncommit;\n")

# Review preflight is read-only; the install bundle repeats it before any DDL.
live=json.loads((root/'tests/picking-audit/compatibility-live.json').read_text())
quote=lambda value:"'"+value.replace("'","''")+"'"
checks=["if to_regnamespace('sgp_picking_audit') is not null then raise exception 'AUDITORIA_YA_EXISTE_REVISAR_ESTADO';end if;"]
for f in live['functions']:
 sig=f['signature'];sig=sig if '.' in sig.split('(')[0] else 'public.'+sig
 checks.append("if pg_get_functiondef("+quote(sig)+"::regprocedure) is distinct from "+quote(f['definition'])+" then raise exception 'CUERPO_DEPENDENCIA_CAMBIO: "+sig+"';end if;")
 checks.append("if not exists(select 1 from pg_proc p where p.oid="+quote(sig)+"::regprocedure and pg_get_userbyid(p.proowner)="+quote(f['owner'])+" and p.prosecdef="+str(f['security_definer']).lower()+" and array(select x::text from unnest(p.proacl) x order by 1) is not distinct from array(select x::text from unnest("+quote(f['acl'])+"::aclitem[]) x order by 1)) then raise exception 'PERMISOS_DEPENDENCIA_CAMBIO: "+sig+"';end if;")
for r in live['relations']:
 name=r['schema']+'.'+r['name'];oid=quote(name)+'::regclass'
 checks.append("if not exists(select 1 from pg_class c where c.oid="+oid+" and c.relrowsecurity="+str(r['rls']).lower()+" and array(select x::text from unnest(c.relacl) x order by 1) is not distinct from array(select x::text from unnest("+quote(r['acl'])+"::aclitem[]) x order by 1)) then raise exception 'RELACION_PERMISOS_CAMBIO: "+name+"';end if;")
 for col in r['columns']:
  checks.append("if not exists(select 1 from pg_attribute a where a.attrelid="+oid+" and a.attname="+quote(col['name'])+" and not a.attisdropped and format_type(a.atttypid,a.atttypmod)="+quote(col['type'])+" and a.attnotnull="+str(col['notnull']).lower()+") then raise exception 'COLUMNA_CAMBIO: "+name+'.'+col['name']+"';end if;")
 if r['view']:
  checks.append("if pg_get_viewdef("+oid+",true) is distinct from "+quote(r['view'])+" then raise exception 'VISTA_CAMBIO: "+name+"';end if;")
 for t in r['triggers'] or []:
  checks.append("if not exists(select 1 from pg_trigger t where t.tgrelid="+oid+" and t.tgname="+quote(t['name'])+" and t.tgenabled="+quote(t['enabled'])+" and pg_get_triggerdef(t.oid)="+quote(t['definition'])+" and pg_get_functiondef(t.tgfoid)="+quote(t['function'])+") then raise exception 'TRIGGER_CAMBIO: "+name+'.'+t['name']+"';end if;")
preflight='do $preflight$ begin\n'+'\n'.join(checks)+'\nend $preflight$;\n'
folder=root/'docs/sql-proposals/picking-audit'
(folder/'00-preflight-readonly.sql').write_text('begin read only;\n'+preflight+'rollback;\n')
def body(sql):
 lines=sql.splitlines();return '\n'.join(line for line in lines if line.strip().lower() not in ('begin;','commit;'))
(folder/'install-review.sql').write_text('-- REVIEW ONLY. Execute only after explicit installation authorization.\nbegin;\n'+preflight+body((folder/'01-review.sql').read_text())+'\n'+body((folder/'02-review-contracts.sql').read_text())+'\ncommit;\n')
# A never-used installation can be removed; protect later body changes and dependencies.
p=folder/'rollback-review.sql';s=p.read_text()
s=s.replace("exists(select 1 from sgp_picking_audit.eventos)","exists(select 1 from sgp_picking_audit.eventos) or exists(select 1 from sgp_picking_audit.decisiones) or exists(select 1 from sgp_picking_audit.contextos) or exists(select 1 from sgp_picking_audit.correcciones)")
s=s.replace('drop schema sgp_picking_audit cascade;', '''drop function sgp_picking_audit.snapshot(uuid);
drop function sgp_picking_audit.pendiente(public.sgp_picking_faltantes);
drop table sgp_picking_audit.decisiones,sgp_picking_audit.eventos,sgp_picking_audit.correcciones,sgp_picking_audit.contextos;
drop schema sgp_picking_audit restrict;''')
# pg_get_functiondef canonicalizes CREATE FUNCTION and delimiter formatting.
# Store installed body guards as hashes of prosrc, parsed from generated definitions.
import hashlib,re
expected=[]
for f in c:
 original=f['definition'];name=f['name']
 replacements=[patch for patch in patches if ('CREATE OR REPLACE FUNCTION '+(f.get('schema','public')+'.'+name+'(')) in patch]
 if not replacements:continue
 replacement=replacements[0].split('end $guard$;\n',1)[1]
 match=re.search(r'AS (\$[^$]*\$)([\s\S]*)\1',replacement)
 if match:
  sig=f['signature'];sig=sig if '.' in sig.split('(')[0] else 'public.'+sig
  expected.append("if (select md5(prosrc) from pg_proc where oid="+quote(sig)+"::regprocedure)<>"+quote(hashlib.md5(match[2].encode()).hexdigest())+" then raise exception 'ROLLBACK_CUERPO_CAMBIO: "+sig+"';end if;")
s=s.replace('end $$;\n','end $$;\ndo $installed$ begin\n'+'\n'.join(expected)+'\nend $installed$;\n',1)
p.write_text(s)
