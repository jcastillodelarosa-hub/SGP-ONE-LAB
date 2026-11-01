import os
"""Targeted installation/recovery tests, only in the own synthetic network-none DB."""
import pathlib,subprocess,json
ROOT=pathlib.Path(__file__).resolve().parents[2];folder=ROOT/'docs/sql-proposals/picking-audit'
assert json.loads(subprocess.check_output(['docker','inspect','sgp-audit-test']))[0]['HostConfig']['NetworkMode']=='none'
def sql(q,ok=True):
 p=subprocess.run(['docker','exec','-i','sgp-audit-test','psql','-U','postgres','-d',os.environ.get('AUDIT_TEST_DB','sgp_parcial_integration'),'-At','-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True)
 if ok:assert p.returncode==0,p.stderr;return p.stdout.strip()
 assert p.returncode,p.stdout;return p.stderr
install=(folder/'install-review.sql').read_text();rollback=(folder/'rollback-review.sql').read_text();preflight=(folder/'00-preflight-readonly.sql').read_text().replace('begin read only;','').replace('rollback;','')
results=[]
def check(name,fn):fn();results.append({'name':name,'ok':True});print('PASS',name,flush=True)
def expects(message,query):assert message in sql(query,False)
def no_install():assert sql("select to_regnamespace('sgp_picking_audit') is null;")=='t'
# install.py installed the current candidate, which has not been used yet.
check('rollback sin uso restaura cuerpos y elimina solo los objetos propios',lambda:sql(rollback))
check('preflight de solo lectura acepta catálogo vigente',lambda:sql('begin read only;'+preflight+'rollback;'))
check('preflight rechaza cambio de cuerpo/configuración',lambda:expects('CUERPO_DEPENDENCIA_CAMBIO','begin;alter function sgp_configuracion_general_obtener(text) set search_path=public,pg_catalog;'+preflight))
check('preflight rechaza cambio de permisos',lambda:expects('PERMISOS_DEPENDENCIA_CAMBIO','begin;revoke execute on function sgp_pdt_registrar_v4(text,text,jsonb,jsonb,uuid) from anon;'+preflight))
check('preflight rechaza trigger deshabilitado',lambda:expects('TRIGGER_CAMBIO','begin;alter table sgp_aluminio_pendientes disable trigger trg_sgp_pdt_contrato;'+preflight))
def failed_install():
 expects('QA_INSTALL_FAILURE',install.rsplit('commit;',1)[0]+"do $$ begin raise exception 'QA_INSTALL_FAILURE';end $$;commit;");no_install()
 sql('begin read only;'+preflight+'rollback;')
check('error tras todo el DDL revierte contrato y permisos completos',failed_install)
check('instalación única atómica completa',lambda:sql(install))
check('instalación repetida bloqueada',lambda:expects('AUDITORIA_YA_EXISTE',install))
def drift():
 definition=sql("select pg_get_functiondef('sgp_pdt_multiorigen.actor(text,text)'::regprocedure);")
 changed=definition.replace('AS $function$','AS $function$\n-- QA drift',1)
 expects('ROLLBACK_CUERPO_CAMBIO','begin;'+changed+';'+rollback.replace('begin;','',1))
check('rollback no sobrescribe un cuerpo posterior divergente',drift)
pathlib.Path(__file__).with_name('lifecycle-results.json').write_text(json.dumps({'environment':'PostgreSQL 17.11, synthetic network-none fixture','passed':len(results),'tests':results},indent=2)+'\n')
