"""Offline, exact-source proposal. Never connects to or modifies a database."""
from pathlib import Path
import hashlib,json
R=Path(__file__).resolve().parents[3];D=Path(__file__).resolve().parent
B=R/'docs/sql-proposals/lp01-incorporar'
md5=lambda s:hashlib.md5(s.encode()).hexdigest()
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
base=json.loads((B/'manifest.json').read_text())
forward=(B/'01_incorporar_REVIEW.sql').read_text()
restore=(B/'02_restore_REVIEW.sql').read_text()
needle="p.key_produccion=k AND p.id_linea=line_id AND p.activa='SI' FOR UPDATE;"
assert forward.count(needle)==1
candidate=forward.replace(needle,"p.key_produccion=k AND p.id_linea=line_id AND p.activa='SI' AND NOT p.excluida_export FOR UPDATE;")
command_old=forward.split('$body$')[3];command_new=candidate.split('$body$')[3]
assert md5(command_old)==base['functions']['public.sgp_lp_operacion_comando(text,jsonb)']['candidate_source_md5']
# A legacy source without the approved-exclusion column cannot silently proceed.
pre=""" IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sgp_producciones' AND column_name='excluida_export' AND data_type='boolean' AND is_nullable='NO')
 THEN RAISE EXCEPTION 'INCORPORAR_EXPORT_APPROVAL_REQUIRED'; END IF;
"""
candidate=candidate.replace('DO $pre$\nBEGIN\n','DO $pre$\nBEGIN\n'+pre,1)
restore=restore.replace(md5(command_old),md5(command_new))
reader=(R/'tests/lp01-incorporar/post-export/export-reader-candidate.sql').read_text().split('$function$')[1]
assert 'WHERE NOT p.excluida_export AND o.etapa=' in reader
assert "'activa',p.activa,'excluida_export',p.excluida_export" in reader
assert 'AND NOT p.excluida_export AND EXISTS(SELECT 1 FROM allowed' in reader
old_read=(B/'04_restore_discovery_REVIEW.sql').read_text().split('$body$')[1]
old_discovery=(B/'03_discovery_REVIEW.sql').read_text().split('$body$')[1]
fragment=old_discovery.split(" res:=res||jsonb_build_object('incorporation'",1)[1].split(' RETURN res||CASE WHEN',1)[0]
fragment=" res:=res||jsonb_build_object('incorporation'"+fragment
assert reader.count(' RETURN res||CASE WHEN')==1
new_read=reader.replace(' RETURN res||CASE WHEN',fragment+' RETURN res||CASE WHEN')
discovery=(B/'03_discovery_REVIEW.sql').read_text().replace(old_discovery,new_read).replace(md5(old_read),md5(reader))
restore_discovery=(B/'04_restore_discovery_REVIEW.sql').read_text().replace(old_read,reader).replace(md5(old_discovery),md5(new_read))
for name,body in [('01_incorporar_REVIEW.sql',candidate),('02_restore_REVIEW.sql',restore),('03_discovery_REVIEW.sql',discovery),('04_restore_discovery_REVIEW.sql',restore_discovery)]:
 (D/name).write_text('-- POST-EXPORT APPROVAL CANDIDATE: inactive; not applied or certified against live state.\n'+body)
base['status']='PROPOSED_POST_EXPORT_NOT_APPLIED_DISABLED'
base['functions']['public.sgp_lp_operacion_comando(text,jsonb)']['candidate_source_md5']=md5(command_new)
base['discovery']['before_source_md5']=md5(reader);base['discovery']['candidate_source_md5']=md5(new_read)
base['sha256']={p.name:sha(p) for p in sorted(D.glob('*.sql'))}
evidence=json.loads((D/'baseline-evidence.json').read_text())
assert evidence['source_md5']==md5(reader)
base['source']={'export_reader_candidate_sha256':sha(R/'tests/lp01-incorporar/post-export/export-reader-candidate.sql'),'export_reader_live_verified':True,'readback_evidence_sha256':sha(D/'baseline-evidence.json'),'baseline_package_manifest_sha256':sha(B/'manifest.json')}
(D/'manifest.json').write_text(json.dumps(base,indent=2)+'\n')
print(json.dumps({'command':md5(command_new),'reader_before':md5(reader),'reader_after':md5(new_read)},indent=2))
