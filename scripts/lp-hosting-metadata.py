"""Prepared Hosting API operations using the SAME configured service account at future dispatch.
No credential discovery. Inspect is GET-only. Recovery requires explicit guarded workflow route.
Never used by local tests against Firebase.
"""
import os,json,re,sys,hashlib,datetime,urllib.request,urllib.parse
from functools import lru_cache
from pathlib import Path
API='https://firebasehosting.googleapis.com/v1beta1/';SITE='sgp-one-lab';PROJECT='sgp-one-lab'
@lru_cache(maxsize=1)
def access_token():
 """OAuth JWT grant using existing service-account JSON; no IAM impersonation API."""
 from google.oauth2 import service_account
 from google.auth.transport.requests import Request
 raw=os.environ.get('FIREBASE_SERVICE_ACCOUNT_JSON')
 if not raw:raise ValueError('AUTHORIZED_CREDENTIAL_REQUIRED')
 info=json.loads(raw)
 if info.get('type')!='service_account' or info.get('project_id')!=PROJECT:
  raise ValueError('SERVICE_ACCOUNT_PROJECT_MISMATCH')
 creds=service_account.Credentials.from_service_account_info(info,scopes=['https://www.googleapis.com/auth/firebase.hosting'])
 creds.refresh(Request())
 if not creds.token:raise ValueError('OAUTH_TOKEN_NOT_ISSUED')
 return creds.token
def request(method,resource,body=None):
 token=access_token()
 payload=None if body is None else json.dumps(body).encode()
 req=urllib.request.Request(API+resource,data=payload,method=method,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
 class NoRedirect(urllib.request.HTTPRedirectHandler):
  def redirect_request(self,*args,**kwargs):raise ValueError('HOSTING_REDIRECT_NOT_ADMITTED')
 with urllib.request.build_opener(NoRedirect).open(req,timeout=30) as r:return json.load(r)
def inspect(call=request):
 site=call('GET',f'projects/{PROJECT}/sites/{SITE}')
 if not site.get('name','').endswith('/sites/'+SITE):raise ValueError('SITE_NOT_VERIFIED')
 channel=call('GET',f'sites/{SITE}/channels/live')
 if channel.get('name')!=f'sites/{SITE}/channels/live':raise ValueError('CHANNEL_NOT_VERIFIED')
 release=channel.get('release',{});version=release.get('version',{});name=version.get('name','')
 if not re.fullmatch('sites/'+SITE+r'/versions/[A-Za-z0-9_-]+',name) or not release.get('name','').startswith('sites/'+SITE+'/releases/'):raise ValueError('LIVE_LINK_NOT_VERIFIED')
 version,files=read_version(name,call)
 return {'project':PROJECT,'site_resource':site['name'],'site':SITE,'channel':channel.get('name'),'release':release['name'],'version':name,'version_status':version['status'],'files':files,'config':version.get('config',{}),'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
def read_version(name,call=request):
 if not re.fullmatch('sites/'+SITE+r'/versions/[A-Za-z0-9_-]+',name):raise ValueError('VERSION_NOT_ADMITTED')
 version=call('GET',name)
 if version.get('name')!=name or version.get('status')!='FINALIZED':raise ValueError('LIVE_VERSION_NOT_RESTORABLE')
 files=[];page=None;seen=set()
 while True:
  suffix='?'+urllib.parse.urlencode({'pageToken':page}) if page else ''
  result=call('GET',name+'/files'+suffix);files.extend(result.get('files',[]));page=result.get('nextPageToken')
  if not page:break
  if page in seen or len(files)>50000:raise ValueError('FILE_PAGINATION_INVALID')
  seen.add(page)
 if not files:raise ValueError('LIVE_FILE_INVENTORY_EMPTY')
 return version,files
def safe_summary(e):return {k:e[k] for k in ['project','site','channel','release','version','version_status','observed_at']}|{'files':len(e['files']),'inventory_sha256':hashlib.sha256(json.dumps(e['files'],sort_keys=True).encode()).hexdigest(),'config_sha256':hashlib.sha256(json.dumps(e['config'],sort_keys=True).encode()).hexdigest()}
def recover(expected_live,target,call=request):
 before=inspect(call)
 if before['version']!=expected_live:raise ValueError('LIVE_CHANGED_NO_RECOVERY')
 if not re.fullmatch('sites/'+SITE+r'/versions/[A-Za-z0-9_-]+',target):raise ValueError('RECOVERY_VERSION_INVALID')
 v=call('GET',target)
 if v.get('name')!=target or v.get('status')!='FINALIZED':raise ValueError('RECOVERY_VERSION_NOT_RETAINED')
 # Re-read just before mutation; external publishers still require a coordinated freeze.
 if inspect(call)['version']!=expected_live:raise ValueError('LIVE_CHANGED_NO_RECOVERY')
 return call('POST','sites/'+SITE+'/releases?'+urllib.parse.urlencode({'versionName':target}),{'message':'Explicitly authorized LP183 frontend recovery'})
if __name__=='__main__':
 try:
  op=os.environ.get('LP_METADATA_OPERATION','inspect')
  if op=='recover':
   if os.environ.get('LP_GUARDED_ROUTE')!='recover':raise ValueError('RECOVERY_NOT_ADMITTED')
   r=recover(os.environ['LP_EXPECTED_LIVE'],os.environ['LP_ROLLBACK_VERSION']);print(json.dumps({'result':'RECOVERY_RELEASE_CREATED_POSTCHECK_REQUIRED','release':r.get('name')}))
  else:
   e=inspect();expected=os.environ.get('LP_EXPECTED_LIVE')
   if expected and e['version']!=expected:raise ValueError('LIVE_VERSION_MISMATCH')
   root=Path(os.environ['RUNNER_TEMP'])/'lp-hosting-private';root.mkdir(mode=0o700,exist_ok=True)
   label=os.environ.get('LP_METADATA_LABEL','before')
   if label not in ['before','after']:raise ValueError('METADATA_LABEL_INVALID')
   p=root/('metadata-'+label+'.json');p.write_text(json.dumps(e));p.chmod(0o600)
   Path(os.environ['RUNNER_TEMP'],'lp-hosting-'+label+'-summary.json').write_text(json.dumps(safe_summary(e),indent=2)+'\n');print(json.dumps(safe_summary(e)))
 except Exception:
  # Never dump bearer tokens, raw API errors or returned identity fields.
  print('HOSTING_READ_OR_GUARD_FAILED; stop without credential escalation',file=sys.stderr);sys.exit(1)
