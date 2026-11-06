import os
"""Build an EMPTY isolated QA database; metadata only, no operational rows copied."""
import subprocess,pathlib,json,re
root=pathlib.Path(__file__).resolve().parents[2];container='sgp-audit-test';db=os.environ.get('AUDIT_TEST_DB','sgp_parcial_integration')
def sql(s,db_name=db):
 subprocess.run(['docker','exec','-i',container,'psql','-U','postgres','-d',db_name,'-v','ON_ERROR_STOP=1'],input=s,text=True,check=True,stdout=subprocess.DEVNULL)
assert json.loads(subprocess.check_output(['docker','inspect',container]))[0]['HostConfig']['NetworkMode']=='none'
sql('create database '+db+';','postgres')
sql(subprocess.check_output(['python',str(root/'tests/mecanizado-parcial/setup.py')],text=True))
sql((root/'supabase/migrations/20261030213201_mecanizado_programacion_parcial.sql').read_text())
c=json.loads((root/'tests/picking-audit/compatibility-live.json').read_text())
# Refresh the exact target dependency definitions to the current READ ONLY evidence.
sql('set check_function_bodies=off;\n'+'\n'.join(f['definition']+';' for f in c['functions']))
sql("create table public.sgp_configuracion_general(clave text primary key,valor jsonb not null,descripcion text,actualizado_en timestamptz not null default now());")
config=json.loads((root/'tests/picking-audit/config-readonly.json').read_text())
sql("insert into sgp_configuracion_general values('HORARIOS_TURNOS','"+json.dumps(config['horarios']).replace("'","''")+"'::jsonb,'QA horarios contrastados',now());insert into sgp_maestro_piezas(codigo_sap,tipo_pieza,destino_productivo) values('QA-PANEL','PANEL','PANEL');")
# Restore captured ACL semantics for dependency preflight; no grants to new RPC here.
for f in c['functions']:
 sig=f['signature'];sig=sig if '.' in sig.split('(')[0] else 'public.'+sig
 acl=f['acl'];grants=[]
 for role,priv in re.findall(r'([^=,{}]*)=([^/]*)/[^,}]+',acl or ''):
  if 'X' in priv:grants.append('grant execute on function '+sig+' to '+('public' if not role else '"'+role+'"')+';')
 sql('revoke all on function '+sig+' from public,anon,authenticated,service_role;\n'+'\n'.join(grants))
# PG17 MAINTAIN was intentionally omitted by the older fixture; match current ACLs.
for relation in c['relations']:
 for role,priv in re.findall(r'([^=,{}]*)=([^/]*)/[^,}]+',relation['acl'] or ''):
  if 'm' in priv:sql('grant maintain on '+relation['schema']+'.'+relation['name']+' to '+('public' if not role else '"'+role+'"')+';')
