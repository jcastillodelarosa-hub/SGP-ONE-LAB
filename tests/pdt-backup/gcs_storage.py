"""Private GCS backup channel. Tokens stay in memory, no new keys or IAM writes.
A Google STS access boundary reduces the existing identity to object create/read
inside this project's backup prefix. No plaintext backup is written to GitHub disk.
"""
import datetime,hashlib,json,re,subprocess,urllib.request,urllib.error,urllib.parse,uuid
PROJECT='sgp-one-lab';BUCKET='sgp-one-lab-supabase-backups'
PREFIX='supabase/ocvxbwzqxbrfndkvjmfx/'

class SafeFailure(Exception):pass

def boundary():
 return {'accessBoundary':{'accessBoundaryRules':[{
  'availableResource':'//storage.googleapis.com/projects/_/buckets/'+BUCKET,
  'availablePermissions':['inRole:roles/storage.objectCreator','inRole:roles/storage.objectViewer'],
  'availabilityCondition':{'expression':"resource.name.startsWith('projects/_/buckets/"+BUCKET+"/objects/"+PREFIX+"')"}
 }]}}

def valid_metadata(b):
 iam=b.get('iamConfiguration',{})
 return (b.get('name')==BUCKET and b.get('location','').lower()=='us-east1'
  and iam.get('publicAccessPrevention')=='enforced'
  and iam.get('uniformBucketLevelAccess',{}).get('enabled') is True
  and int(b.get('retentionPolicy',{}).get('retentionPeriod',0))>=604800
  and not b.get('retentionPolicy',{}).get('isLocked',False)
  and not b.get('encryption',{}).get('defaultKmsKeyName'))

def validate_name(name):
 if not name.startswith(PREFIX) or '..' in name or not re.fullmatch(r'[A-Za-z0-9/_.-]+',name):
  raise SafeFailure('OBJECT_OUTSIDE_BACKUP_SCOPE')

def request(url,token,method='GET',data=None,headers=None):
 hdr={'Authorization':'Bearer '+token};hdr.update(headers or {})
 req=urllib.request.Request(url,data=data,method=method,headers=hdr)
 try:
  with urllib.request.urlopen(req,timeout=300) as response:return response.read()
 except urllib.error.HTTPError as e:
  raise SafeFailure('GCS_HTTP_'+str(e.code)) from None
 except Exception:raise SafeFailure('GCS_TRANSPORT_FAILED') from None

class PrivateStorage:
 def __init__(self):
  r=subprocess.run(['gcloud','auth','print-access-token'],capture_output=True,text=True,timeout=60)
  if r.returncode or not r.stdout.strip():raise SafeFailure('GCS_AUTH_UNAVAILABLE')
  source=r.stdout.strip()
  metadata=json.loads(request('https://storage.googleapis.com/storage/v1/b/'+BUCKET,source))
  if not valid_metadata(metadata):raise SafeFailure('BUCKET_PRIVACY_RETENTION_OR_ENCRYPTION_NOT_VERIFIED')
  data=urllib.parse.urlencode({'grant_type':'urn:ietf:params:oauth:grant-type:token-exchange',
   'requested_token_type':'urn:ietf:params:oauth:token-type:access_token',
   'subject_token_type':'urn:ietf:params:oauth:token-type:access_token',
   'subject_token':source,'options':json.dumps(boundary())}).encode()
  req=urllib.request.Request('https://sts.googleapis.com/v1/token',data=data,headers={'Content-Type':'application/x-www-form-urlencoded'})
  try:
   with urllib.request.urlopen(req,timeout=60) as response:result=json.load(response)
  except urllib.error.HTTPError as e:raise SafeFailure('GCS_DOWNSCOPE_HTTP_'+str(e.code)) from None
  except Exception:raise SafeFailure('GCS_DOWNSCOPE_FAILED') from None
  if not result.get('access_token') or not 0<int(result.get('expires_in',0))<=3600:raise SafeFailure('GCS_TEMPORARY_TOKEN_UNEXPECTED')
  self.token=result['access_token']
  # Do not retain the broad source token or credentials in this channel object.
 def put(self,name,data):
  validate_name(name)
  url='https://storage.googleapis.com/upload/storage/v1/b/'+BUCKET+'/o?'+urllib.parse.urlencode({'uploadType':'media','name':name,'ifGenerationMatch':'0'})
  result=json.loads(request(url,self.token,'POST',data,{'Content-Type':'application/octet-stream'}))
  if result.get('name')!=name or int(result.get('size',-1))!=len(data):raise SafeFailure('GCS_UPLOAD_NOT_VERIFIED')
  return {'name':name,'generation':result['generation'],'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
 def get(self,item):
  validate_name(item['name'])
  url='https://storage.googleapis.com/storage/v1/b/'+BUCKET+'/o/'+urllib.parse.quote(item['name'],safe='')+'?'+urllib.parse.urlencode({'alt':'media','generation':item['generation']})
  data=request(url,self.token)
  if len(data)!=item['bytes'] or hashlib.sha256(data).hexdigest()!=item['sha256']:raise SafeFailure('GCS_DOWNLOAD_INTEGRITY_FAILED')
  return data
 def verify_boundary(self):
  # A read outside the permitted prefix must fail before any backup is exported.
  name='out-of-scope-check-'+uuid.uuid4().hex
  url='https://storage.googleapis.com/storage/v1/b/'+BUCKET+'/o/'+name+'?alt=media'
  try:request(url,self.token)
  except SafeFailure as e:
   if str(e)=='GCS_HTTP_403':return
  raise SafeFailure('GCS_TOKEN_BOUNDARY_NOT_VERIFIED')

if __name__=='__main__':
 try:
  channel=PrivateStorage();channel.verify_boundary()
  stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
  content=json.dumps({'purpose':'Supabase backup capability check','production_data':False,'created_utc':stamp}).encode()
  record=channel.put(PREFIX+'checks/'+stamp+'-'+uuid.uuid4().hex+'.json',content)
  if channel.get(record)!=content:raise SafeFailure('GCS_CAPABILITY_CHECK_FAILED')
  print('::notice title=GCS private channel::Private encrypted bucket verified; temporary token restricted to backup prefix; create/read integrity passed; outside-prefix read denied. No IAM changes or production data exported.')
 except SafeFailure as e:
  print('::error title=GCS private channel::'+str(e));raise SystemExit(1)
 except Exception:
  print('::error title=GCS private channel::PRIVATE_CHANNEL_NOT_VERIFIED');raise SystemExit(1)
