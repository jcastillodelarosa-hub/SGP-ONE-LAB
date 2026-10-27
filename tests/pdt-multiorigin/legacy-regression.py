"""Legacy state matrix: compare before/after installation, never production data.
Resolver/state are supplied real bodies; traditional validator is versioned SQL,
NOT claimed to be the current installed validator. This limitation is reported.
"""
import json,re

def seed(root,sql,functions):
 sql('ALTER TABLE sgp_aluminio_pendientes_historial ADD COLUMN estado_anterior text,ADD COLUMN estado_nuevo text;')
 for f in functions:
  if f['firma'].startswith(('sgp_aluminio_pendiente_estado(','sgp_aluminio_pendiente_resolver(')):sql(f['definicion'])
 text=(root/'supabase/migrations/20261018_pdt_validation_workflow.sql').read_text()
 a=text.index('CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendiente_validar(');b=text.index('end $function$;',a)+len('end $function$;');sql(text[a:b])
 sql((root/'docs/sql-proposals/pdt/20261025_pdt_legacy_guard_REVIEW.sql').read_text())
 ids=json.loads(sql("SELECT jsonb_agg(sgp_aluminio_pendiente_crear('COORDINADOR','R','QA ORDER','PANEL-REF',1,100,'PRODUCCION','QA','QA','QA|PANELES_2','R','DS')) FROM generate_series(1,4)"))
 sql("UPDATE sgp_aluminio_pendientes SET validacion_estado='VALIDADO' WHERE id_pendiente IN ('"+"','".join(ids[1:])+"');")
 sql("SELECT sgp_aluminio_pendiente_estado('LIDER','"+ids[2]+"','CORTE','QA movement');")
 sql("SELECT sgp_aluminio_pendiente_resolver('COORDINADOR','"+ids[3]+"');")
 sql("CREATE TABLE qa_legacy_snapshot AS SELECT to_jsonb(p) row FROM sgp_aluminio_pendientes p;")
 sql("CREATE TABLE qa_legacy_history AS SELECT to_jsonb(h) row FROM sgp_aluminio_pendientes_historial h;")
 return ids

def results(sql,ids):
 out={}
 for state,id in zip(['open','validated','with_movements','closed'],ids):
  calls={
   'sources':"sgp_pdt_fuentes_v2('COORDINADOR','"+id+"')",
   'traditional_validation':"sgp_aluminio_pendiente_validar('COORDINADOR','"+id+"','E17',100,'R','DS',NULL)",
   'individual_v2_preparation':"sgp_aluminio_pendiente_validar_detalles_v1('COORDINADOR','"+id+"','[{\"id_pieza\":\"P1\",\"fabricacion\":\"E17\",\"longitud\":100,\"acabado\":\"DS\",\"cantidad\":1}]','R',NULL)",
   'followup':"sgp_aluminio_pendientes_listar_v2('COORDINADOR',false)",
   'picking_reader':"sgp_pdt_picking_v2('COORDINADOR','"+id+"')",
   'closure_certificate':"to_jsonb(sgp_pdt_cierre_acreditado('"+id+"'))",
   'state':"sgp_aluminio_pendiente_estado('LIDER','"+id+"','PROCESADO','QA')",
   'resolve':"(SELECT to_jsonb(p.estado) FROM (SELECT sgp_aluminio_pendiente_resolver('COORDINADOR','"+id+"')) q CROSS JOIN sgp_aluminio_pendientes p WHERE p.id_pendiente='"+id+"')",
  }
  out[state]={}
  for name,call in calls.items():
   # Subtransaction always rolled back, including successful explicit preparation.
   query="""BEGIN;ALTER TABLE sgp_aluminio_pendientes_historial ALTER COLUMN estado_nuevo SET NOT NULL;CREATE FUNCTION pg_temp.qa_capture() RETURNS jsonb LANGUAGE plpgsql AS $body$
DECLARE result jsonb; snapshot jsonb; BEGIN
 BEGIN
 SELECT to_jsonb(q.v) INTO result FROM (SELECT """+call+""" v) q;
 SELECT jsonb_build_object('contrato',p.contrato_pdt,'validacion',p.validacion_estado,'estado',p.estado,'estado_repo',p.estado_repo,'cantidad',p.cantidad) INTO snapshot FROM sgp_aluminio_pendientes p WHERE id_pendiente='"""+id+"""';
 RAISE EXCEPTION USING ERRCODE='Z0001',MESSAGE=jsonb_build_object('ok',true,'result',result,'snapshot',snapshot)::text;
 EXCEPTION WHEN SQLSTATE 'Z0001' THEN RETURN SQLERRM::jsonb;
 WHEN OTHERS THEN RETURN jsonb_build_object('ok',false,'error',SQLERRM,'code',SQLSTATE);
 END;
END $body$;SELECT pg_temp.qa_capture();ROLLBACK;"""
   data=json.loads(sql(query));
   if name in ['sources','followup','resolve']:assert data['ok'],(state,name,data)
   if name in ['traditional_validation','individual_v2_preparation']:assert data['ok']==(state=='open'),(state,name,data)
   if name=='state':assert data['ok']==(state in ['validated','with_movements']),(state,name,data)
   if name=='followup' and data.get('ok'):
    data['result']['pendientes'].sort(key=lambda r:r['id_pendiente'])
   out[state][name]=data
 return out

def unchanged(sql):
 assert sql("SELECT (SELECT jsonb_agg(row ORDER BY row->>'id_pendiente') FROM qa_legacy_snapshot)=(SELECT jsonb_agg(to_jsonb(p) ORDER BY id_pendiente) FROM sgp_aluminio_pendientes p)")=='t'
 assert sql("SELECT (SELECT jsonb_agg(row ORDER BY row->>'id') FROM qa_legacy_history)=(SELECT jsonb_agg(to_jsonb(h) ORDER BY id) FROM sgp_aluminio_pendientes_historial h)")=='t'
