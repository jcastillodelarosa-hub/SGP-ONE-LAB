"""Strict artifact inventory, retained platform files and public-byte postcheck."""
from pathlib import Path
import os,json,importlib.util,urllib.request,urllib.parse,gzip,io

# Observed in retained version 1a59beda3dffaed9 (run 41856841540).
# Firebase-managed URLs, never files accepted from the application ZIP.
PLATFORM_FILES={'__/firebase/init.js','__/firebase/init.json'}

def verify_inventory(before_files,after_files,manifest_files):
 def index(files):
  result={f['path'].lstrip('/'):f for f in files}
  if len(result)!=len(files):raise ValueError('DUPLICATE_HOSTING_PATH')
  return result
 before=index(before_files);after=index(after_files);expected=set(manifest_files)|{'manifest.json'}
 if any(p.startswith('__/') for p in expected):raise ValueError('RESERVED_PATH_IN_ARTIFACT')
 retained=set(before)&PLATFORM_FILES
 if set(after)!=expected|retained:raise ValueError('LIVE_INVENTORY_DIFFERENT')
 for p in retained:
  if not before[p].get('hash') or after[p].get('hash')!=before[p]['hash'] or after[p].get('status')!=before[p].get('status'):
   raise ValueError('PLATFORM_FILE_CHANGED')
 return len(expected),len(retained)

def decode_public_body(body,encoding,size):
 encoding=encoding.lower().strip()
 if encoding in ('','identity'):return body
 if encoding=='gzip':return gzip.GzipFile(fileobj=io.BytesIO(body)).read(size+1)
 raise ValueError('PUBLIC_ENCODING_NOT_VERIFIED')

def verify_public_bytes(public,fetch=None):
 if fetch is None:
  class NoRedirect(urllib.request.HTTPRedirectHandler):
   def redirect_request(self,*args,**kwargs):raise ValueError('PUBLIC_REDIRECT_NOT_ADMITTED')
  opener=urllib.request.build_opener(NoRedirect)
  def fetch(path,size):
   url='https://sgp-one-lab.web.app/'+('' if path=='index.html' else urllib.parse.quote(path,safe='/'))
   with opener.open(urllib.request.Request(url,headers={'Cache-Control':'no-cache','Accept-Encoding':'identity'}),timeout=15) as response:
    if response.status!=200:raise ValueError('PUBLIC_HTTP_STATUS')
    body=response.read(32*1024*1024+1)
    if len(body)>32*1024*1024:raise ValueError('PUBLIC_RESPONSE_TOO_LARGE')
    return decode_public_body(body,response.headers.get('Content-Encoding','identity'),size)
 manifest=json.loads((public/'manifest.json').read_text())
 for path in sorted(set(manifest['files'])|{'manifest.json'}):
  expected=(public/path).read_bytes()
  if fetch(path,len(expected))!=expected:raise ValueError('PUBLIC_BYTES_DIFFER:'+path)
 return len(manifest['files'])+1

def main():
 root=Path(os.environ['RUNNER_TEMP']);before=json.loads((root/'lp-hosting-private/metadata-before.json').read_text());after=json.loads((root/'lp-hosting-private/metadata-after.json').read_text())
 if os.environ['LP_ROUTE']=='recover':
  if after['version']!=os.environ['LP_ROLLBACK_VERSION']:raise ValueError('RECOVERY_VERSION_NOT_ACTIVE')
  print('Recovery version observed; user acceptance still required')
  return
 if before['version']==after['version']:raise ValueError('NEW_RELEASE_NOT_OBSERVED')
 public=root/'lp-reviewed/public';manifest=json.loads((public/'manifest.json').read_text())
 application,platform=verify_inventory(before['files'],after['files'],manifest['files'])
 print(json.dumps({'application_paths_verified':application,'unchanged_platform_paths':platform}))
 spec=importlib.util.spec_from_file_location('hosting_metadata',Path(__file__).with_name('lp-hosting-metadata.py'));meta=importlib.util.module_from_spec(spec);spec.loader.exec_module(meta)
 old,files=meta.read_version(before['version'])
 canonical=lambda x:json.dumps(x,sort_keys=True,separators=(',',':'))
 if canonical(old.get('config',{}))!=canonical(before['config']) or canonical(sorted(files,key=lambda f:f['path']))!=canonical(sorted(before['files'],key=lambda f:f['path'])):raise ValueError('PREVIOUS_VERSION_CHANGED')
 print('Previous Hosting version retained with identical API inventory/config')
 count=verify_public_bytes(public)
 print(json.dumps({'public_files_byte_identical':count,'source_sha':manifest['source_head'],'version':after['version'],'human_acceptance':'PENDING'}))

if __name__=='__main__':main()
