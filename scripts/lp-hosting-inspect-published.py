"""Inspect an ALREADY published release: GET only, no deploy/recover or user session.
Compares the original sealed ZIP with Hosting's API paths and public asset bytes.
"""
from pathlib import Path, PurePosixPath
import concurrent.futures,gzip,hashlib,importlib.util,io,json,os,re,sys,urllib.request,urllib.error,urllib.parse
ROOT=Path(__file__).resolve().parents[1]
ORIGIN='https://sgp-one-lab.web.app'
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
def check_pins(pin,env):
 for field,var in [('source_sha','LP_SOURCE_SHA'),('artifact_run_id','LP_RUN'),('zip_sha256','LP_ZIP_SHA'),('expected_live_version','LP_EXPECTED_LIVE')]:
  if env.get(var)!=pin[field]:raise ValueError('READONLY_PIN_MISMATCH:'+field)
def paths_report(manifest,files):
 expected=set(manifest['files'])|{'manifest.json'}
 paths=[]
 for f in files:
  p=f.get('path')
  if not isinstance(p,str) or not re.fullmatch(r'/?[A-Za-z0-9_.\-/]{1,500}',p):raise ValueError('UNSAFE_API_PATH')
  paths.append(p.lstrip('/'))
 if len(paths)!=len(set(paths)):raise ValueError('DUPLICATE_API_PATH')
 actual=set(paths)
 return {'expected_count':len(expected),'actual_count':len(actual),'missing':sorted(expected-actual),'additional':sorted(actual-expected),'matches':actual==expected}
def sealed(download,pin,dest):
 metadata=json.loads((download/'lp-visual-digest.json').read_text())
 if metadata.get('source_sha')!=pin['source_sha'] or metadata.get('zip_sha256')!=pin['zip_sha256']:raise ValueError('SEALED_PROVENANCE_MISMATCH')
 pre=module('sealed_preflight',ROOT/'scripts/prepare-lp-hosting-plan.py')
 pre.prepare(download/'lp-visual.zip',pin['zip_sha256'],dest,kind='runtime')
 public=dest/'public';manifest=json.loads((public/'manifest.json').read_text())
 if manifest.get('source_head')!=pin['source_sha']:raise ValueError('SEALED_SOURCE_MISMATCH')
 return manifest,public
def public_asset(path,expected):
 # Only paths validated by sealed ZIP preflight; no unknown extra file is fetched.
 parsed=PurePosixPath(path)
 if parsed.is_absolute() or '..' in parsed.parts or '\\' in path:raise ValueError('UNSAFE_PUBLIC_PATH')
 url=ORIGIN+('/' if path=='index.html' else '/'+urllib.parse.quote(path,safe='/._-'))
 class SameOrigin(urllib.request.HTTPRedirectHandler):
  def redirect_request(self,req,fp,code,msg,headers,newurl):
   target=urllib.parse.urlsplit(newurl)
   if target.scheme!='https' or target.netloc!='sgp-one-lab.web.app':raise ValueError('FOREIGN_PUBLIC_REDIRECT')
   return super().redirect_request(req,fp,code,msg,headers,newurl)
 req=urllib.request.Request(url,method='GET',headers={'Accept-Encoding':'identity','Cache-Control':'no-cache'})
 try:
  with urllib.request.build_opener(SameOrigin).open(req,timeout=20) as response:
   body=response.read(4*1024*1024+1)
   if len(body)>4*1024*1024:raise ValueError('PUBLIC_RESPONSE_TOO_LARGE')
   encoding=response.headers.get('Content-Encoding','identity').lower()
   if encoding=='gzip':body=gzip.GzipFile(fileobj=io.BytesIO(body)).read(4*1024*1024+1)
   elif encoding not in ('','identity'):raise ValueError('PUBLIC_ENCODING_NOT_VERIFIED')
   if len(body)>4*1024*1024:raise ValueError('PUBLIC_RESPONSE_TOO_LARGE')
   digest=hashlib.sha256(body).hexdigest()
   return {'path':path,'http_status':response.status,'bytes_match':digest==expected,'sha256':digest,'cache_control':response.headers.get('Cache-Control','')}
 except urllib.error.HTTPError as exc:return {'path':path,'http_status':exc.code,'bytes_match':False}
 except Exception:return {'path':path,'http_status':None,'bytes_match':False,'error':'PUBLIC_TRANSPORT_OR_RESPONSE_NOT_VERIFIED'}
def run():
 if os.environ.get('LP_ROUTE')!='inspect':raise ValueError('READONLY_INSPECT_ROUTE_REQUIRED')
 pin=json.loads((ROOT/'deployment/lp-live-verification.json').read_text());check_pins(pin,os.environ)
 temp=Path(os.environ['RUNNER_TEMP']);manifest,public=sealed(temp/'lp-download',pin,temp/'lp-live-inspected')
 before=json.loads((temp/'lp-hosting-private/metadata-before.json').read_text())
 if before['version']!=pin['expected_live_version']:raise ValueError('LIVE_VERSION_CHANGED')
 report={'status':'INSPECTION_IN_PROGRESS','source_sha':pin['source_sha'],'live':{k:before[k] for k in ['project','site','channel','release','version','observed_at']},'inventory':paths_report(manifest,before['files']),'public_assets':[],'productive_saves_verified':False,'limits':['Public byte checks and API inventory only; no valid SGP session or business write','Authenticated PC/mobile operations remain pending; isolated UI evidence is separate']}
 hashes=manifest['files']|{'manifest.json':hashlib.sha256((public/'manifest.json').read_bytes()).hexdigest()}
 with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
  results=list(pool.map(lambda item:public_asset(*item),sorted(hashes.items())))
 report['public_assets']=results
 meta=module('hosting_metadata',ROOT/'scripts/lp-hosting-metadata.py')
 old,old_files=meta.read_version(pin['rollback_version'])
 report['recovery']={'version':pin['rollback_version'],'status':old['status'],'files':len(old_files),'config_sha256':hashlib.sha256(json.dumps(old.get('config',{}),sort_keys=True).encode()).hexdigest()}
 after=meta.inspect();report['same_live_after_read']=after['version']==before['version']
 report['public_bytes_match']=all(x['bytes_match'] for x in results)
 report['status']='PASS_INVENTORY_AND_PUBLIC_BYTES' if report['same_live_after_read'] and report['inventory']['matches'] and report['public_bytes_match'] else 'DIFFERENCE_OR_UNVERIFIED'
 (temp/'lp-live-inspection.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps(report,indent=2))
 if report['status']!='PASS_INVENTORY_AND_PUBLIC_BYTES':raise ValueError('READONLY_INSPECTION_NOT_COMPLETE')
if __name__=='__main__':
 if '--check-pins' in sys.argv:check_pins(json.loads((ROOT/'deployment/lp-live-verification.json').read_text()),os.environ);print('Read-only pins verified; no network or account used')
 else:run()
