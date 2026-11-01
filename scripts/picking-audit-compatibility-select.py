"""Generate only SELECT statements for live comparison; never emit executable DDL/DO."""
import pathlib,json,hashlib
root=pathlib.Path(__file__).resolve().parents[1]
c=json.loads((root/'tests/picking-audit/compatibility-live.json').read_text())
md5=lambda s:hashlib.md5(s.encode()).hexdigest()
fs=[dict(signature=f['signature'] if '.' in f['signature'].split('(')[0] else 'public.'+f['signature'],body=md5(f['definition']),acl=sorted(f['acl'][1:-1].split(',')),owner=f['owner'],security_definer=f['security_definer'],config=f['config']) for f in c['functions']]
rs=[dict(name=r['schema']+'.'+r['name'],rls=r['rls'],acl=sorted(r['acl'][1:-1].split(',')),view=md5(r['view']) if r['view'] else None) for r in c['relations']]
ts=[dict(relation=r['schema']+'.'+r['name'],name=t['name'],enabled=t['enabled'],definition=md5(t['definition']),body=md5(t['function'])) for r in c['relations'] for t in r['triggers'] or []]
cols=[dict(relation=r['schema']+'.'+r['name'],**col) for r in c['relations'] for col in r['columns']]
lit=lambda x:"'"+json.dumps(x).replace("'","''")+"'::jsonb"
query='begin read only;\nwith f as (select value x from jsonb_array_elements('+lit(fs)+''')), r as (select value x from jsonb_array_elements('''+lit(rs)+''')),t as(select value x from jsonb_array_elements('''+lit(ts)+''')),cols as(select value x from jsonb_array_elements('''+lit(cols)+'''))
select jsonb_build_object('functions',(select jsonb_agg(jsonb_build_object('signature',x->>'signature','body_match',md5(pg_get_functiondef(p.oid))=x->>'body','acl_match',to_jsonb(array(select a::text from unnest(p.proacl) a order by 1))=x->'acl','owner_match',pg_get_userbyid(p.proowner)=x->>'owner','definer_match',to_jsonb(p.prosecdef)=x->'security_definer','config_match',to_jsonb(p.proconfig)=x->'config')) from f left join pg_proc p on p.oid=to_regprocedure(x->>'signature')),
'relations',(select jsonb_agg(jsonb_build_object('name',x->>'name','rls_match',to_jsonb(c.relrowsecurity)=x->'rls','acl_match',to_jsonb(array(select a::text from unnest(c.relacl) a order by 1))=x->'acl','view_match',case when c.relkind='v' then md5(pg_get_viewdef(c.oid,true))=x->>'view' else true end)) from r left join pg_class c on c.oid=to_regclass(x->>'name')),
'triggers',(select jsonb_agg(jsonb_build_object('relation',x->>'relation','name',x->>'name','match',tr.tgenabled::text=x->>'enabled' and md5(pg_get_triggerdef(tr.oid))=x->>'definition' and md5(pg_get_functiondef(tr.tgfoid))=x->>'body')) from t left join pg_trigger tr on tr.tgrelid=to_regclass(x->>'relation') and tr.tgname=x->>'name'),
'columns',(select jsonb_build_object('checked',count(*),'mismatches',count(*) filter(where a.attname is null or format_type(a.atttypid,a.atttypmod)<>x->>'type' or to_jsonb(a.attnotnull)<>x->'notnull')) from cols left join pg_attribute a on a.attrelid=to_regclass(x->>'relation') and a.attname=x->>'name' and not a.attisdropped)) compatibility;
rollback;
'''
(root/'docs/sql-proposals/picking-audit/compatibility-select-readonly.sql').write_text(query)
print(query)
