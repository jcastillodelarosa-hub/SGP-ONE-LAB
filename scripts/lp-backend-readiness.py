"""Public, negative-only release checks in the existing Actions runner.
No user credentials, elevated keys, valid SGP sessions, business data or write RPCs.
Managed-executor network policy is never changed, proxied or bypassed.
"""
from pathlib import Path
import base64,datetime,json,os,re,sys,urllib.request,urllib.error
ROOT=Path(__file__).resolve().parents[1]
API='https://ocvxbwzqxbrfndkvjmfx.supabase.co'
ORIGIN='https://sgp-one-lab.web.app'
checks=[];last_response_facts={}
def session_denial(status,data):
 return status==400 and isinstance(data,dict) and data.get('code')=='P0001' and data.get('message')=='SESION_NO_AUTORIZADA'
def platform_denial(status,data,subject):
 # Gateway error codes vary between platform versions. Require its envelope and
 # the relevant reason, rather than accepting any 401 (including an SGP error).
 return (status==401 and isinstance(data,dict) and 'error' not in data
  and re.fullmatch(r'[A-Za-z0-9_]{1,64}',str(data.get('code',''))) is not None
  and subject in str(data.get('message','')).lower())
def request(method,path,headers,body=None):
 global last_response_facts
 if not path.startswith(('/functions/v1/lp-powerbi','/rest/v1/rpc/sgp_')):raise ValueError('PROBE_PATH_NOT_ADMITTED')
 class NoRedirect(urllib.request.HTTPRedirectHandler):
  def redirect_request(self,*args,**kwargs):raise ValueError('PROBE_REDIRECT_NOT_ADMITTED')
 req=urllib.request.Request(API+path,data=None if body is None else json.dumps(body).encode(),method=method,headers=headers)
 try:response=urllib.request.build_opener(NoRedirect).open(req,timeout=15)
 except urllib.error.HTTPError as exc:response=exc
 with response:
  raw=response.read(65537)
  if len(raw)>65536:raise ValueError('PROBE_RESPONSE_TOO_LARGE')
  try:data=json.loads(raw) if raw else None
  except (ValueError,UnicodeDecodeError):raise ValueError('PROBE_NON_JSON_RESPONSE') from None
  code=data.get('code') if isinstance(data,dict) else None
  message=str(data.get('message',data.get('error',data.get('msg','')))).lower() if isinstance(data,dict) else ''
  last_response_facts={'json_keys':sorted(set(data)&{'code','message','error','msg','status_code','error_description'}) if isinstance(data,dict) else [],'code':str(code) if code is not None and re.fullmatch(r'[A-Za-z0-9_]{1,64}',str(code)) else 'UNRECOGNIZED','mentions_authorization':'authorization' in message,'mentions_jwt':'jwt' in message,'mentions_api_key':'apikey' in message or 'api key' in message}
  return response.status,response.headers,data
def require(name,ok,status):
 checks.append({'check':name,'status':'PASS' if ok else 'FAIL','http_status':status,'response_facts':dict(last_response_facts)})
def run():
 config=(ROOT/'config.js').read_text()
 def field(name):
  match=re.search(r'\b'+name+r'\s*:\s*"([^"\r\n]+)"',config)
  if not match:raise ValueError('PROBE_CONFIG_MISSING:'+name)
  return match[1]
 if field('supabaseUrl')!=API:raise ValueError('PROBE_PROJECT_MISMATCH')
 key,jwt=field('supabasePublishableKey'),field('lpPowerBiGatewayJwt')
 if not key.startswith('sb_publishable_'):raise ValueError('PROBE_PUBLIC_KEY_REQUIRED')
 parts=jwt.split('.')
 if len(parts)!=3:raise ValueError('PROBE_ANON_JWT_REQUIRED')
 claims=json.loads(base64.urlsafe_b64decode(parts[1]+'='*(-len(parts[1])%4)))
 if claims.get('role')!='anon' or claims.get('ref')!='ocvxbwzqxbrfndkvjmfx':raise ValueError('PROBE_ELEVATED_OR_FOREIGN_TOKEN')
 headers={'content-type':'application/json','apikey':key,'Authorization':'Bearer '+jwt,'Origin':ORIGIN}
 # Deliberately invalid marker. It is never a created session or productive credential.
 token='__LP183_INVALID_SESSION_READINESS__'
 date=datetime.datetime.now(datetime.timezone.utc).date().isoformat()
 context={'id':'00000000-0000-4000-8000-000000000001','stage':'ENSAMBLE','line':'PANELES_2','date':date,'shift':1,'revision':0}
 body={'p_token':token,'filename':'readiness-invalid.xlsx','base64':'AAAA','command':context}
 for origin in [ORIGIN,'https://sgp-one-lab.firebaseapp.com']:
  status,h,data=request('OPTIONS','/functions/v1/lp-powerbi',{'Origin':origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,apikey,authorization'})
  require('CORS_EXACT_'+origin.split('//')[1],status==204 and h.get('Access-Control-Allow-Origin')==origin,status)
 status,h,data=request('POST','/functions/v1/lp-powerbi',{'content-type':'application/json','Origin':ORIGIN},body)
 require('PLATFORM_DENIES_NO_CREDENTIALS',platform_denial(status,data,'authorization'),status)
 status,h,data=request('POST','/functions/v1/lp-powerbi',{k:v for k,v in headers.items() if k!='Authorization'},body)
 # Observed on this hosted project: a valid publishable apikey can reach SGP
 # authentication without an explicit Authorization header. It must never confer
 # human authorization. Do not label this as a missing-JWT platform rejection.
 require('PUBLIC_KEY_ALONE_DOES_NOT_AUTHORIZE_SGP_USER',status==401 and isinstance(data,dict) and data.get('code')=='SGP_SESSION_INVALID',status)
 bad=parts[0]+'.'+parts[1]+'.'+('A' if parts[2][0]!='A' else 'B')+parts[2][1:]
 status,h,data=request('POST','/functions/v1/lp-powerbi',headers|{'Authorization':'Bearer '+bad},body)
 require('PLATFORM_REJECTS_BAD_SIGNATURE',platform_denial(status,data,'jwt'),status)
 status,h,data=request('POST','/functions/v1/lp-powerbi',headers,body)
 require('VALID_PUBLIC_JWT_REACHES_SGP_AUTH',status==401 and isinstance(data,dict) and data.get('code')=='SGP_SESSION_INVALID',status)
 status,h,data=request('POST','/rest/v1/rpc/sgp_sesion_actual',headers,{'p_token':token})
 require('NATIVE_SESSION_RPC_REJECTS_INVALID_SESSION',status==200 and isinstance(data,dict) and data.get('valida') is False,status)
 for stage in ['ENSAMBLE','EMPAQUE']:
  status,h,data=request('POST','/rest/v1/rpc/sgp_lp_operacion_consultar',headers,{'p_token':token,'p_etapa':stage,'p_linea':'PANELES_2','p_fecha':date,'p_turno':1})
  require('PROTECTED_READ_DENIES_'+stage,session_denial(status,data),status)
  status,h,data=request('POST','/rest/v1/rpc/sgp_lp_seguimiento_consultar',headers,{'p_token':token,'p_etapa':stage,'p_linea':'PANELES_2'})
  require('GLOBAL_TRACKING_DENIES_'+stage,session_denial(status,data),status)
 status,h,data=request('OPTIONS','/functions/v1/lp-powerbi',{'Origin':'https://untrusted.invalid'})
 require('FOREIGN_ORIGIN_DENIED',status==403 and isinstance(data,dict) and data.get('error')=='Origen no permitido',status)
if __name__=='__main__':
 policy=json.loads((ROOT/'deployment/lp-hosting-policy.json').read_text())
 result={'source_sha':os.environ.get('GITHUB_SHA'),'project':'ocvxbwzqxbrfndkvjmfx','status':'NOT_REQUESTED','checks':checks,'productive_saves_verified':False,'limits':['Negative requests only; no valid user/session or business writes','Does not certify positive user scope, real data or productive closures','Runs solely in the existing authorized Actions preparation job; no managed network changes']}
 enabled=policy.get('backend_probe_required') is True
 try:
  if enabled:
   if os.environ.get('GITHUB_ACTIONS')!='true' or os.environ.get('GITHUB_REPOSITORY')!='jcastillodelarosa-hub/SGP-ONE-LAB':raise ValueError('EXISTING_ACTIONS_CONTEXT_REQUIRED')
   run()
   if any(c['status']!='PASS' for c in checks):raise ValueError('PROBE_CHECKS_FAILED')
   result['status']='PASS_PUBLIC_NEGATIVE_CHECKS'
 except Exception as exc:
  result['status']='FAIL';marker=str(exc)
  result['failure']=marker if re.fullmatch(r'(PROBE_[A-Z_]+|PROBE_CHECK_FAILED:[A-Z0-9_.-]+|EXISTING_ACTIONS_CONTEXT_REQUIRED)',marker) else 'PROBE_TRANSPORT_OR_RESPONSE_FAILED'
 target=Path(os.environ.get('RUNNER_TEMP','/tmp'))/'lp-backend-readiness.json'
 target.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
 if result['status']=='FAIL':sys.exit(1)
