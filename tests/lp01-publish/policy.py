"""Pure policy/metadata fixtures only; no network, credentials or Hosting operations."""
from pathlib import Path
import importlib.util,json,copy,yaml,ast,hashlib,subprocess
ROOT=Path(__file__).resolve().parents[2];OUT=Path(__file__).parent/'evidence'
def load(name,path):
 spec=importlib.util.spec_from_file_location(name,ROOT/path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
m=load('gate','scripts/lp-hosting-gate.py');meta=load('metadata','scripts/lp-hosting-metadata.py')
p=json.loads((ROOT/'deployment/lp-hosting-policy.json').read_text());sha='a'*40;hashes={k:'b'*64 for k in m.PROTECTED};checks=[]
for mode in ['legacy','visual']:
 cur=p|{'mode':mode};assert m.decide('push','',cur,None,hashes,sha)['route']=='hold'
checks.append('First policy adoption holds merge, squash, rebase and batched adoption by before/after tree state; no message/PR-title heuristic')
assert m.decide('push','',p,p,hashes,sha)['route']=='legacy'
assert m.decide('push','',p,p,hashes,sha,changed_lp=True)['route']=='hold'
checks.append('Later ordinary pushes retain legacy release route without granting LP publication')
for op,route in [('prepare','prepare'),('inspect','inspect'),('publish','hold'),('recover','hold')]:assert m.decide('workflow_dispatch',op,p,p,hashes,sha,sha)['route']==route
checks.append('Prepare secret-free; inspect GET-only route; current uncertified policy denies publish/recover even with matching source pin')
approved=p|{'mode':'visual','hosting_certified':True,'certification_reference':'QA-NOT-REAL','approved_lp_files':hashes,'baseline_version':'sites/sgp-one-lab/versions/QA','rollback_version':'sites/sgp-one-lab/versions/QA'}
assert m.decide('push','',approved,p,hashes,sha)['route']=='hold'
assert m.decide('push','',approved,approved,hashes,sha)['route']=='visual'
assert m.decide('workflow_dispatch','publish',approved,approved,hashes,sha,sha)['route']=='publish'
wrong=hashes|{m.PROTECTED[0]:'c'*64};assert m.decide('push','',approved,approved,wrong,sha)['route']=='hold'
try:m.decide('workflow_dispatch','publish',approved,approved,hashes,sha,'0'*40);raise AssertionError('Bad source accepted')
except ValueError:pass
checks.append('Policy transition holds; only certified pinned LP assets admit visual releases; drift and wrong source rejected, ordinary non-LP updates can continue')
# Test REST algorithm with synthetic transport; it proves guards only, not Firebase compatibility/access.
version='sites/sgp-one-lab/versions/QA';release='sites/sgp-one-lab/releases/QA';calls=[]
def fake(method,resource,body=None):
 calls.append((method,resource))
 if resource=='projects/sgp-one-lab/sites/sgp-one-lab':return {'name':'projects/QA/sites/sgp-one-lab'}
 if resource=='sites/sgp-one-lab/channels/live':return {'name':resource,'release':{'name':release,'version':{'name':version}}}
 if '/files' in resource:return {'files':[{'path':'/index.html','hash':'QA_HOSTING_HASH','status':'ACTIVE'}]}
 if resource.startswith('sites/sgp-one-lab/versions/'):return {'name':resource,'status':'FINALIZED','config':{}}
 if method=='POST':return {'name':'sites/sgp-one-lab/releases/QA-RECOVERY'}
 raise AssertionError(resource)
e=meta.inspect(fake);assert e['version']==version and all(c[0]=='GET' for c in calls)
try:meta.recover('sites/sgp-one-lab/versions/WRONG',version,fake);raise AssertionError('Stale live accepted')
except ValueError:pass
assert not any(c[0]=='POST' for c in calls)
checks.append('Synthetic API transport: inspect only GET, verifies site/live/version/finalized inventory, stale live refuses recovery; no real identity/version certified')
# Read workflow with BaseLoader because YAML1.1 treats on as boolean.
y=yaml.load((ROOT/'.github/workflows/firebase-hosting.yml').read_text(),Loader=yaml.BaseLoader)
assert y['on']['workflow_dispatch']['inputs']['operation']['default']=='prepare'
assert "'firebase-hosting-live'" in y['concurrency']['group']
assert y['jobs']['gate']['if']=="github.event_name != 'pull_request'"
assert 'secrets.' not in json.dumps(y['jobs']['validate'])
assert 'pull_request' in y['on']
assert 'secrets.' not in json.dumps(y['jobs']['gate']) and 'secrets.' not in json.dumps(y['jobs']['prepare'])
for job,entry in [('ordinary','sgp-ordinary'),('controlled','lp-reviewed')]:
 deploy=[s for s in y['jobs'][job]['steps'] if s.get('uses','').startswith('FirebaseExtended/')];assert len(deploy)==1
 assert deploy[0]['with']['entryPoint']=='${{ runner.temp }}/'+entry
 assert deploy[0]['with']['projectId']=='sgp-one-lab' and deploy[0]['with']['channelId']=='live'
 assert deploy[0]['with']['firebaseServiceAccount']=='${{ secrets.FIREBASE_SERVICE_ACCOUNT_SGP_ONE_LAB }}'
assert 'entryPoint: .' not in (ROOT/'.github/workflows/firebase-hosting.yml').read_text()
checks.append('Workflow YAML: same project/account/live concurrency; secrets after gate; default prepare; both deployment actions point exclusively at prepared public roots')
for path in (ROOT/'scripts').glob('lp-*.py'):ast.parse(path.read_text())
for path in ['scripts/prepare-sgp-legacy-artifact.py','scripts/seal-lp-visual.py','scripts/write-sgp-ordinary-config.py']:ast.parse((ROOT/path).read_text())
legacy=(ROOT/'deployment/lp-legacy-navigation.js').read_bytes()
assert legacy==subprocess.check_output(['git','show','bb224f00924c1feaa47a4a556a829e93b8e4ca3e:production-line-tabs.js'],cwd=ROOT)
assert hashlib.sha256(legacy).hexdigest()==p['legacy_navigation_sha256']
checks.append('Legacy navigation is byte-identical to PR base; no invented legacy UI or RPC contracts')
result={'status':'PASS','checks':checks,'limits':['Pure policy and synthetic metadata transport; no Firebase action executed','Future metadata API/service-account access and Hosting recovery still unverified','Current policy remains legacy and uncertified; no privileged account/secret read']}
OUT.mkdir(exist_ok=True);(OUT/'policy.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
