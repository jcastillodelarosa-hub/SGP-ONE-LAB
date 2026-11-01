"""Build targeted REVIEW patches from read-only captured production definitions."""
import json,pathlib
root=pathlib.Path(__file__).resolve().parents[1]
c=json.loads((root/'tests/picking-audit-catalog.json').read_text())+json.loads((root/'tests/picking-audit/roles-catalog.json').read_text())+json.loads((root/'tests/picking-audit/guard-catalog.json').read_text())
patches=[];rollback=[]
for f in c:
 s=f['definition'];new=s
 if f['name'] in ('actor','sgp_picking_piezas_panel','sgp_picking_recepcion_cola'):
  # Reception gets exactly the Picking source/read authorization needed for audit.
  new=new.replace("'SUPERVISOR DE PICKING'","'SUPERVISOR DE PICKING','RECEPCION'")
 if f['name']=='sgp_picking_reporte_entregas_v1':
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
(root/'docs/sql-proposals/picking-audit/02-review-contracts.sql').write_text('begin;\n'+'\n'.join(patches)+'\ncommit;\n')
(root/'docs/sql-proposals/picking-audit/rollback-review.sql').write_text("begin;\ndo $$ begin if exists(select 1 from sgp_picking_audit.eventos) then raise exception 'AUDITORIA_EN_USO_REQUIERE_CORRECCION_FORWARD';end if;end $$;\n"+'\n'.join(rollback)+"\ndrop function public.sgp_picking_auditoria_contexto(text,uuid);\ndrop function public.sgp_picking_auditoria_guardar(text,uuid,text,uuid,date,text,jsonb,jsonb,text);\ndrop schema sgp_picking_audit cascade;\ncommit;\n")
