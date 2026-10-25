"""Create ONLY the owner-authorized private SGP backup bucket; no new keys/APIs.
No object data is uploaded. Existing buckets are verified, never silently changed.
"""
import json,pathlib,subprocess,sys,urllib.request,urllib.error,urllib.parse
PROJECT='sgp-one-lab';BUCKET='sgp-one-lab-supabase-backups'

def valid_bucket(b,policy):
    iam=b.get('iamConfiguration',{})
    return (b.get('name')==BUCKET and b.get('location','').lower()=='us-east1'
        and iam.get('uniformBucketLevelAccess',{}).get('enabled') is True
        and iam.get('publicAccessPrevention')=='enforced'
        and int(b.get('retentionPolicy',{}).get('retentionPeriod',0))>=604800
        and b.get('retentionPolicy',{}).get('isLocked',False) is False
        and not any(p in ['allUsers','allAuthenticatedUsers'] for r in policy.get('bindings',[]) for p in r.get('members',[])))

def main():
    auth=subprocess.run(['gcloud','auth','print-access-token'],capture_output=True,text=True,timeout=60)
    if auth.returncode:
        print('::error title=GCS bucket::Autenticación GCS no disponible');return 1
    token=auth.stdout.strip()
    def request(path,method='GET',payload=None):
        data=None if payload is None else json.dumps(payload).encode()
        req=urllib.request.Request('https://storage.googleapis.com/storage/v1/'+path,data=data,method=method,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
        with urllib.request.urlopen(req,timeout=60) as response:return json.load(response)
    try:
        created=False
        try:b=request('b/'+BUCKET)
        except urllib.error.HTTPError as e:
            if e.code!=404:raise
            config=json.loads(pathlib.Path(__file__).with_name('gcs-config').joinpath('bucket.json').read_text())
            if config['name']!=BUCKET or config['location']!='US-EAST1':raise RuntimeError('UNEXPECTED_CONFIGURATION')
            b=request('b?project='+PROJECT,'POST',config);created=True
        policy=request('b/'+BUCKET+'/iam')
        if not valid_bucket(b,policy):raise RuntimeError('PRIVACY_OR_RETENTION_NOT_VERIFIED')
        # Remove default project-editor/viewer bucket grants from a newly created
        # bucket. Project owners retain recovery control; no project IAM is changed.
        if created:
            principal=subprocess.run(['gcloud','auth','list','--filter=status:ACTIVE','--format=value(account)'],capture_output=True,text=True,timeout=30)
            account=principal.stdout.strip()
            if principal.returncode or not account.endswith('.iam.gserviceaccount.com') or '\n' in account:raise RuntimeError('IDENTITY_NOT_VERIFIED')
            owners=[m for r in policy.get('bindings',[]) for m in r.get('members',[]) if m.startswith('projectOwner:')]
            minimal={'version':3,'etag':policy['etag'],'bindings':[
                {'role':'roles/storage.objectCreator','members':['serviceAccount:'+account]},
                {'role':'roles/storage.objectViewer','members':['serviceAccount:'+account]}]}
            if owners:minimal['bindings'].append({'role':'roles/storage.legacyBucketOwner','members':sorted(set(owners))})
            request('b/'+BUCKET+'/iam','PUT',minimal)
            policy=request('b/'+BUCKET+'/iam')
            if not valid_bucket(b,policy):raise RuntimeError('POST_CREATE_POLICY_NOT_VERIFIED')
        print('::notice title=GCS bucket::Bucket privado gs://'+BUCKET+' verificado: US-EAST1, cifrado GCS, acceso público impedido, retención mínima 7 días sin bloqueo irreversible; sin claves nuevas ni cambios en IAM del proyecto')
        return 0
    except urllib.error.HTTPError as e:
        reason='unspecified'
        try:
            errors=json.load(e).get('error',{}).get('errors',[])
            candidate=errors[0].get('reason','') if errors else ''
            if candidate in ['forbidden','billingNotEnabled','accountDisabled','projectNotFound','conflict','invalid','conditionNotMet','required','usageLimits','accessNotConfigured']:reason=candidate
        except Exception:pass
        print('::error title=GCS bucket::Creación/verificación detenida: HTTP '+str(e.code)+' ('+reason+'); no se exportaron datos')
        return 1
    except Exception as e:
        safe=str(e) if str(e) in ['UNEXPECTED_CONFIGURATION','PRIVACY_OR_RETENTION_NOT_VERIFIED','IDENTITY_NOT_VERIFIED','POST_CREATE_POLICY_NOT_VERIFIED'] else 'GCS_CONFIGURATION_NOT_VERIFIED'
        print('::error title=GCS bucket::'+safe+'; no se exportaron datos');return 1

if __name__=='__main__':sys.exit(main())
