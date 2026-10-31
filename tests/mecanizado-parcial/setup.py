"""Render a fresh synthetic schema from targeted live catalog definitions.
No row copies/backups; all exercised business functions and shared-reserve view are real.
"""
import json,pathlib,re
ROOT=pathlib.Path(__file__).resolve().parents[2]
load=lambda name:json.loads((ROOT/'tests/mecanizado-parcial'/name).read_text())
c=load('catalog.json');auth=load('catalog-auth.json');real=load('catalog-pdt-real.json')
columns=c['columns']+auth['columns']+load('catalog-consumers.json')['columns']
tables={}
for col in columns:
 tables.setdefault(('public',col['table_name']),{})[col['column_name']]={'name':col['column_name'],'type':col['udt_name'],'default':col['column_default'],'notnull':col['is_nullable']=='NO'}
rels={(r['schema'],r['name']):r for r in real['relations']}
for key,r in rels.items():
 if r['kind']=='r':tables[key]={col['name']:col for col in r['columns']}
tables[('public','sgp_lineas')]={col['name']:col for col in real['lineas_columns']}
functions={f['signature']:f for f in c['functions']+auth['functions']+real['functions']}
for r in rels.values():
 for t in r.get('triggers') or []:
  signature=re.search(r'FUNCTION ([^(]+)\(',t['function'])[1]
  # Trigger function definitions are captured, never replaced by a fixture implementation.
  functions.setdefault(signature+'()',{'signature':signature+'()','definition':t['function'],'acl':'{postgres=X/postgres}'})
schemas={'public','extensions','sgp_pdt_multiorigen','sgp_pdt_manual','sgp_pdt_compat_91'}
for schema,_ in tables:schemas.add(schema)
roles={'anon','authenticated','service_role'}
for r in rels.values():roles.update(a['role'] for a in r.get('acl') or [] if a['role'] not in ('public','postgres'))
out=["do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; create role authenticated; create role service_role; end if; end $$;"]
for role in sorted(roles-{'anon','authenticated','service_role'}):out.append(f'DO $$ BEGIN CREATE ROLE "{role}"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;')
for schema in sorted(schemas-{'public'}):out.append('create schema '+schema+';')
out.append('create extension pgcrypto with schema extensions; set check_function_bodies=off;')
qualified=lambda k:k[0]+'.'+k[1]
seqs=set()
for cols in tables.values():
 for col in cols.values():
  m=re.search(r"nextval\('([^']+)'",col.get('default') or '')
  if m:seqs.add(m[1])
for seq in sorted(seqs):out.append('create sequence '+seq+';')
for key,cols in tables.items():
 defs=[]
 for col in cols.values():
  value='"'+col['name']+'" '+col['type']
  if col.get('identity'):value+=' generated '+('always' if col['identity']=='a' else 'by default')+' as identity'
  elif col.get('generated'):value+=' generated always as ('+col['default']+') stored'
  elif col.get('default'):value+=' default '+col['default']
  if col['notnull']:value+=' not null'
  defs.append(value)
 out.append('create table '+qualified(key)+'('+','.join(defs)+');')
constraints=[]
for key,r in rels.items():
 if r['kind']=='r':constraints.extend((key,x) for x in r.get('constraints') or [] if x['type']!='t')
for con in c['constraints']:
 key=('public',con['table'])
 if key in tables and key not in rels:constraints.append((key,con))
constraints.append((('public','sgp_lineas'),{'name':'sgp_lineas_pkey','definition':'PRIMARY KEY(id_linea)'}))
for is_fk in (False,True):
 for key,con in constraints:
  if ('FOREIGN KEY' in con['definition'])==is_fk:out.append('alter table '+qualified(key)+' add constraint '+con['name']+' '+con['definition']+';')
# All business bodies are actual captured definitions. check_function_bodies=off only orders dependencies.
for f in functions.values():out.append(f['definition']+';')
for key,r in rels.items():
 if r['kind']=='v':out.append('create view '+qualified(key)+' as '+r['view']+';')
for idx in real['indexes'] or []:
 if (idx['schema'],idx['table']) in tables:out.append(idx['definition']+';')
for key,r in rels.items():
 for t in r.get('triggers') or []:out.append(t['definition']+';')
for t in c['triggers']:
 if ('public',t['table'].split('.')[-1]) not in rels and ('public',t['table'].split('.')[-1]) in tables:out.append(t['definition']+';')
# Public fallback tables follow previously captured technical grants. Real tables use exact ACLs/RLS.
for key in tables:
 if key not in rels:out.append('grant select,insert,update,delete on '+qualified(key)+' to anon,authenticated;')
for key,r in rels.items():
 if r.get('rls'):out.append('alter table '+qualified(key)+' enable row level security;')
 for a in r.get('acl') or []:
  if a['privilege']!='MAINTAIN':out.append('grant '+a['privilege']+' on '+qualified(key)+' to '+('public' if a['role']=='public' else '"'+a['role']+'"')+';')
for f in functions.values():
 acl=f.get('acl')
 if acl is None:continue
 sig=f['signature'];sig=sig if '.' in sig.split('(')[0] else 'public.'+sig
 out.append('revoke execute on function '+sig+' from public;')
 for role,priv in re.findall(r'([^=,{}]*)=([^/]*)/[^,}]+',acl):
  if 'X' in priv and role in roles|{'','postgres'}:out.append('grant execute on function '+sig+' to '+('public' if not role else '"'+role+'"')+';')
out.append("""
insert into public.sgp_lineas(id_linea,nombre) values('PANELES_2','QA Paneles'),('FRAMES_2','QA Frames');
insert into public.sgp_usuarios(id_usuario,usuario,nombre,password_hash,rol,activo)
values('00000000-0000-0000-0000-000000000001','qa-coordinador','QA','fixture','COORDINADOR',true),
('00000000-0000-0000-0000-000000000002','qa-consulta','QA','fixture','CONSULTA',true),
('00000000-0000-0000-0000-000000000003','qa-picking','QA','fixture','PICKING',true),
('00000000-0000-0000-0000-000000000004','qa-mecanizado','QA','fixture','LIDER MECANIZADO',true),
('00000000-0000-0000-0000-000000000005','qa-recepcion','QA','fixture','RECEPCION',true);
insert into public.sgp_sesiones_app(id_usuario,token_hash,expira_en)
select id_usuario,encode(extensions.digest(usuario,'sha256'),'hex'),now()+interval '1 day' from public.sgp_usuarios;
insert into public.sgp_capacidad_linea(id,linea,proceso,capacidad_turno,capacidad_dia) values(1,'PANELES 2','MECANIZADO',90,180);
insert into public.sgp_mecanizado_arrastre_activacion(id,activado_en) values(true,'2026-01-01');
""")
print('\n'.join(out))
