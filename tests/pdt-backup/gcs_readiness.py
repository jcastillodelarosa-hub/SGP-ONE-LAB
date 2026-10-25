"""Read-only GCS inventory in the existing SGP project; never writes objects/IAM.
Only safe resource metadata is reported. Access tokens and API bodies are not logged.
"""
import json,os,sys,subprocess,urllib.request,urllib.error,urllib.parse
PROJECT='sgp-one-lab'

def eligible(bucket,policy):
    iam=bucket.get('iamConfiguration',{})
    public=any(p in ('allUsers','allAuthenticatedUsers') for b in policy.get('bindings',[]) for p in b.get('members',[]))
    name=bucket.get('name','')
    return (iam.get('uniformBucketLevelAccess',{}).get('enabled') is True
        and iam.get('publicAccessPrevention')=='enforced' and not public
        and not name.endswith(('.appspot.com','.firebasestorage.app')))

def main():
    token=os.environ.get('GCS_READ_TOKEN')
    if not token:
        try:
            result=subprocess.run(['gcloud','auth','print-access-token'],capture_output=True,text=True,timeout=60)
            if result.returncode:raise RuntimeError()
            token=result.stdout.strip()
            if not token:raise RuntimeError()
        except Exception:
            print('::error title=GCS readiness::No hay autenticación GCS reutilizable disponible')
            return 1
    def get(path):
        request=urllib.request.Request('https://storage.googleapis.com/storage/v1/'+path,headers={'Authorization':'Bearer '+token})
        with urllib.request.urlopen(request,timeout=30) as r:return json.load(r)
    try:
        items=[];page=None
        while True:
            query={'project':PROJECT}
            if page:query['pageToken']=page
            data=get('b?'+urllib.parse.urlencode(query));items+=data.get('items',[])
            page=data.get('nextPageToken')
            if not page:break
        result=[]
        for bucket in items:
            name=bucket['name'];path='b/'+urllib.parse.quote(name,safe='')
            try:policy=get(path+'/iam')
            except urllib.error.HTTPError as e:
                result.append({'bucket':name,'ready':False,'reason':'IAM no verificable','http':e.code});continue
            permissions=get(path+'/iam/testPermissions?'+urllib.parse.urlencode({'permissions':['storage.objects.create','storage.objects.get','storage.objects.list']},doseq=True)).get('permissions',[])
            private=eligible(bucket,policy)
            can_backup=private and all(p in permissions for p in ['storage.objects.create','storage.objects.get','storage.objects.list'])
            result.append({'bucket':name,'ready':can_backup,'private_checks_pass':private,'location':bucket.get('location'),'encryption':'Google-managed at rest' if not bucket.get('encryption',{}).get('defaultKmsKeyName') else 'CMEK configured','object_permissions':permissions})
        safe={'project':PROJECT,'buckets':result,'writes_performed':False}
        # Metadata only; no object names, contents, tokens, credentials or private backups.
        print(json.dumps(safe,ensure_ascii=False))
        summary=os.environ.get('GITHUB_STEP_SUMMARY')
        if summary:
            with open(summary,'a') as h:h.write('GCS readiness (solo lectura):\n\n```json\n'+json.dumps(safe,indent=2,ensure_ascii=False)+'\n```\n')
        candidates=[r['bucket'] for r in result if r['ready']]
        if not candidates:
            print('::warning title=GCS readiness::No hay bucket existente verificado con privacidad y permisos suficientes; no se creó ningún recurso')
        else:
            # Resource names are not credentials. Annotations remain readable even when log downloads are blocked.
            print('::notice title=GCS readiness::Buckets privados elegibles: '+', '.join(candidates))
        print('::notice title=GCS inventory::'+json.dumps(safe,ensure_ascii=False))
        return 0
    except urllib.error.HTTPError as e:
        print('::error title=GCS readiness::Consulta GCS denegada o no disponible (HTTP '+str(e.code)+')')
        return 1
    except Exception:
        print('::error title=GCS readiness::No se pudo verificar GCS; sin cambios ni datos exportados')
        return 1

if __name__=='__main__':sys.exit(main())
