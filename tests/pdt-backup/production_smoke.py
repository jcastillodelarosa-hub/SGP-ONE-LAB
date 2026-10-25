"""Live release smoke. No persistent test accounts or business data are created."""
import hashlib,json,os,pathlib,re,subprocess,tempfile,urllib.request,urllib.error,uuid
ROOT=pathlib.Path(__file__).resolve().parents[2]
BASE='https://sgp-one-lab.web.app'

def main():
 if os.environ.get('GITHUB_ACTIONS')!='true':raise RuntimeError('PROTECTED_RUNNER_REQUIRED')
 # Real authentication/capabilities, using one synthetic account entirely rolled back.
 with tempfile.TemporaryDirectory(prefix='sgp-smoke-ca-') as folder:
  cert=pathlib.Path(folder)/'ca.crt';public=pathlib.Path(__file__).with_name('certs')
  cert.write_bytes(pathlib.Path('/etc/ssl/certs/ca-certificates.crt').read_bytes()+b'\n'+(public/'prod-ca-2021.crt').read_bytes()+b'\n'+(public/'prod-ca-2025.crt').read_bytes())
  args=['docker','run','--rm','-i','--log-driver=none','--env','PGPASSWORD',
   '--env','PGHOST=aws-0-us-east-2.pooler.supabase.com','--env','PGPORT=5432',
   '--env','PGDATABASE=postgres','--env','PGUSER=postgres.ocvxbwzqxbrfndkvjmfx',
   '--env','PGSSLMODE=verify-full','--env','PGSSLROOTCERT=/etc/sgp-ca.crt',
   '--env','PGCONNECT_TIMEOUT=20','--mount','type=bind,source='+str(cert)+',target=/etc/sgp-ca.crt,readonly',
   'postgres:17','psql','-X','-qAt','-v','ON_ERROR_STOP=1']
  env=os.environ.copy();env['PGPASSWORD']=os.environ['SUPABASE_DB_PASSWORD']
  query="""BEGIN; SET LOCAL lock_timeout='3s'; SET LOCAL statement_timeout='20s';
DO $smoke$ DECLARE col text; username text:='pdt_qa_'||replace(gen_random_uuid()::text,'-','');
 password text:=gen_random_uuid()::text||gen_random_uuid()::text; response jsonb; session jsonb; caps jsonb; definition text;
BEGIN
 SELECT pg_get_functiondef('public.sgp_login(text,text)'::regprocedure) INTO definition;
 IF position('crypt' IN lower(definition))=0 THEN RAISE EXCEPTION 'SMOKE_AUTH_HASH_CONTRACT_UNRECOGNIZED'; END IF;
 SELECT a.attname INTO col FROM pg_attribute a WHERE a.attrelid='public.sgp_usuarios'::regclass
 AND a.attname IN ('password_hash','clave_hash','contrasena_hash','hash_password') AND NOT a.attisdropped;
 IF col IS NULL THEN RAISE EXCEPTION 'SMOKE_AUTH_HASH_COLUMN_UNRECOGNIZED'; END IF;
 EXECUTE format('INSERT INTO public.sgp_usuarios(usuario,nombre,rol,activo,%I) VALUES($1,$2,$3,true,extensions.crypt($4,extensions.gen_salt(''bf'')))',col)
 USING username,'SGP QA temporal rollback','COORDINADOR',password;
 response:=public.sgp_login(username,password);
 IF nullif(response->>'token','') IS NULL THEN RAISE EXCEPTION 'SMOKE_REAL_LOGIN_FAILED'; END IF;
 session:=public.sgp_sesion_actual(response->>'token');
 IF session->>'valida'<>'true' OR session->>'rol'<>'COORDINADOR' THEN RAISE EXCEPTION 'SMOKE_REAL_SESSION_FAILED'; END IF;
 caps:=public.sgp_pdt_capacidades_v2(response->>'token');
 IF caps->>'contract_version'<>'2' OR caps->>'picking_cuantitativo'<>'true' OR caps->>'cierre_v2'<>'true'
 THEN RAISE EXCEPTION 'SMOKE_CAPABILITIES_FAILED'; END IF;
END $smoke$;
ROLLBACK;
SELECT 'REAL_LOGIN_SESSION_PDT_PICKING_ROLLBACK_OK';
"""
  r=subprocess.run(args,input=query.encode(),env=env,capture_output=True,timeout=80)
  if r.returncode:
   # No SQL, rows, passwords, tokens or raw errors in GitHub logs.
   m=re.search(rb'SMOKE_[A-Z_]+',r.stderr)
   code=m.group().decode() if m else 'TRANSACTIONAL_AUTH_SMOKE_FAILED'
   print('::error title=PDT live verification::'+code+'; test transaction rolled back; no persistent QA account');return 1
  if r.stdout.strip()!=b'REAL_LOGIN_SESSION_PDT_PICKING_ROLLBACK_OK':raise RuntimeError('AUTH_SMOKE_RESULT_UNEXPECTED')
 print('::notice title=PDT live verification::Real SGP login/session and PDT v2/Picking capabilities passed inside rolled-back transaction; no persistent QA account/session/business writes.')
 # Verify the independently fetched deployed source, not a local preview or mock.
 for name in ['index.html','app.js','src/modules/pdt-v2-controller.js','src/services/aluminum-pending-v2.js']:
  req=urllib.request.Request(BASE+'/'+name+'?pdt_check='+uuid.uuid4().hex,headers={'Cache-Control':'no-cache'})
  with urllib.request.urlopen(req,timeout=25) as r:
   remote=r.read()
   if r.status!=200 or hashlib.sha256(remote).digest()!=hashlib.sha256((ROOT/name).read_bytes()).digest():raise RuntimeError('DEPLOYED_RESOURCE_DIFFERS')
 from playwright.sync_api import sync_playwright
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox'])
  for width,height in [(1280,900),(390,844)]:
   page=browser.new_page(viewport={'width':width,'height':height})
   errors=[];page.on('pageerror',lambda e:errors.append(type(e).__name__))
   r=page.goto(BASE+'/?pdt_check='+uuid.uuid4().hex,wait_until='networkidle',timeout=60000)
   if not r or r.status!=200:raise RuntimeError('LIVE_PAGE_UNAVAILABLE')
   page.locator('#authUser').wait_for(state='visible',timeout=20000)
   page.locator('#authUser').fill('pdt_nonexistent_'+uuid.uuid4().hex)
   page.locator('#authPassword').fill(uuid.uuid4().hex)
   page.locator('#authLogin').click()
   page.wait_for_function("document.querySelector('#authStatus').textContent.includes('Error de acceso')",timeout=25000)
   if errors:raise RuntimeError('LIVE_PAGE_JAVASCRIPT_ERROR')
   page.close()
  browser.close()
 print('::notice title=PDT live verification::Firebase HTTPS/resources match release; live browser desktop/mobile loaded without JS errors and rejected nonexistent login through real Supabase. Business actions with operational accounts were not executed.')
 return 0
if __name__=='__main__':
 try:raise SystemExit(main())
 except Exception:print('::error title=PDT live verification::LIVE_SMOKE_NOT_VERIFIED; no business transactions submitted');raise SystemExit(1)
