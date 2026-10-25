"""Backup/restore mechanics on an existing network-disabled QA database ONLY.
Not a production backup. Never restore over an existing database or delete artifacts.
"""
import argparse,datetime,hashlib,json,os,pathlib,re,subprocess,sys,tempfile,time
sys.dont_write_bytecode=True
from catalog_compatibility import compare_catalogs
from installation_plan import ROOT
parser=argparse.ArgumentParser();parser.add_argument('database');args=parser.parse_args()
if not re.fullmatch(r'sgp_pdt_qa_91_[A-Za-z0-9_]+',args.database):parser.error('Disposable QA source required')
container='sgp-pdt-qa-91'
meta=json.loads(subprocess.check_output(['docker','inspect',container]))[0]
if meta['HostConfig']['NetworkMode']!='none' or meta['HostConfig'].get('PortBindings'):raise SystemExit('STOP: not isolated')
marker=subprocess.check_output(['docker','exec',container,'psql','-X','-qAt','-U','postgres','-d',args.database,'-c',"SELECT to_regclass('public.qa_assertions') IS NOT NULL"],text=True).strip()
if marker!='t':raise SystemExit('STOP: synthetic fixture marker missing; this tool is not a production backup mechanism')
os.umask(0o077)
artifact=pathlib.Path(tempfile.mkdtemp(prefix='sgp-pdt-qa-recovery-',dir='/tmp'))
archive=artifact/'fixture.dump'
with archive.open('xb') as handle:
 result=subprocess.run(['docker','exec',container,'pg_dump','-U','postgres','-d',args.database,'--format=custom','--no-password'],stdout=handle,stderr=subprocess.PIPE)
if result.returncode:raise SystemExit('QA dump failed; retained private artifacts')
# Verify archive readability without restoring any existing database.
with archive.open('rb') as handle:
 result=subprocess.run(['docker','exec','-i',container,'pg_restore','--list'],stdin=handle,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
if result.returncode:raise SystemExit('Archive TOC verification failed')
target='sgp_pdt_qa_91_restore_'+str(time.time_ns())
subprocess.run(['docker','exec',container,'createdb','-U','postgres',target],check=True)
with archive.open('rb') as handle:
 result=subprocess.run(['docker','exec','-i',container,'pg_restore','-U','postgres','-d',target,'--single-transaction','--exit-on-error','--no-password'],stdin=handle,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
if result.returncode:raise SystemExit('QA restore failed; no existing database touched')
def query(db,text):
 result=subprocess.run(['docker','exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],input=text,text=True,capture_output=True)
 if result.returncode:raise SystemExit('QA verification query failed')
 return result.stdout.strip()
def counts(db):
 names=json.loads(query(db,"SELECT coalesce(json_agg(json_build_object('schema',n.nspname,'name',c.relname) ORDER BY n.nspname,c.relname),'[]'::json) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','sgp_pdt_compat_91') AND c.relkind IN ('r','p')"))
 return {item['schema']+'.'+item['name']:json.loads(query(db,"SELECT json_build_object('count',count(*),'rows_md5',md5(coalesce(string_agg(row_to_json(t)::text,E'\\n' ORDER BY row_to_json(t)::text),''))) FROM "+'"'+item['schema'].replace('"','""')+'"."'+item['name'].replace('"','""')+'" t')) for item in names}
source_counts=counts(args.database);target_counts=counts(target)
source_catalog=json.loads(query(args.database,(ROOT/'PDT_PREFLIGHT_SUPABASE.sql').read_text()))
target_catalog=json.loads(query(target,(ROOT/'PDT_PREFLIGHT_SUPABASE.sql').read_text()))
differences=compare_catalogs(source_catalog,target_catalog)
report={'timestamp_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':args.database,'restored':target,
 'container':container,'network':'none','sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),
 'archive_toc_readable':True,'row_counts_equal':source_counts==target_counts,'table_counts':source_counts,
 'catalog_differences':differences,'fixture_restore_verified':source_counts==target_counts and not differences,
 'production_backup':False,'limitations':['Synthetic fixture only; no production recovery claim','Cluster roles already existed in same QA cluster; roles are not included in pg_dump','No Storage object backup, external secrets or Supabase platform settings','No preservation/replay of later production writes demonstrated']}
if not report['fixture_restore_verified']:
 with (artifact/'report.json').open('x') as handle:json.dump(report,handle,indent=2)
 raise SystemExit('STOP: restore integrity mismatch')
if query(target,"SELECT to_regclass('sgp_pdt_compat_91.entrega_backup') IS NOT NULL")=='t':
 for name in ['20261025_picking_entrega_68_compat_REVIEW.sql','20261025_picking_entrega_68_rollback_REVIEW.sql','20261025_picking_entrega_68_compat_REVIEW.sql']:
  query(target,(ROOT/'docs/sql-proposals/pdt'/name).read_text())
 final_counts=counts(target)
 if {k:v for k,v in source_counts.items() if k.startswith('public.')}!={k:v for k,v in final_counts.items() if k.startswith('public.')}:
  raise SystemExit('Business/test rows changed during compatibility recovery')
 report['compatibility_rebind_rollback_reinstall_verified']=True
with (artifact/'report.json').open('x') as handle:json.dump(report,handle,indent=2)
print(json.dumps({'report':str(artifact/'report.json'),'archive':str(archive),**report},indent=2))
if not report['fixture_restore_verified']:raise SystemExit('STOP: restore integrity mismatch')
