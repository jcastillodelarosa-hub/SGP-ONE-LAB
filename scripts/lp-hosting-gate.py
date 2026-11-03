"""Pure deployment policy; no credentials/Firebase. First adoption never deploys."""
from pathlib import Path
import json,hashlib,subprocess,os,re
POLICY='deployment/lp-hosting-policy.json'
PROTECTED=['production-line-tabs.js','src/modules/lp01-followup.js','src/modules/lp01-operation.js','src/domain/lp01-visual-bridge.js','scripts/prepare-lp-main-visual.py','tests/lp01-integration/fixtures/lp-synthetic.json','scripts/stamp-lp-release.mjs','scripts/seal-lp-visual.py']
def decide(event,operation,current,previous,hashes,source_sha,expected_sha='',changed_lp=False):
 if current.get('contract')!='LP-HOSTING-POLICY/1' or current.get('mode') not in ['legacy','visual'] or current.get('project')!='sgp-one-lab' or current.get('site')!='sgp-one-lab':raise ValueError('POLICY_INVALID')
 if event=='push':
  if previous is None:return {'route':'hold','reason':'FIRST_POLICY_ADOPTION_PR183_NO_DEPLOY'}
  if current!=previous:return {'route':'hold','reason':'POLICY_TRANSITION_REQUIRES_EXPLICIT_REVIEW'}
  if current['mode']=='legacy' and changed_lp:return {'route':'hold','reason':'LP_CHANGE_HELD_WHILE_PENDING'}
  if current['mode']=='legacy':return {'route':'legacy','reason':'ORDINARY_MAIN_PUSH_LEGACY_LP_RETAINED'}
 elif event=='workflow_dispatch':
  if operation=='prepare':return {'route':'prepare','reason':'BUILD_ONLY_NO_SECRET_NO_DEPLOY'}
  if operation=='inspect':return {'route':'inspect','reason':'EXPLICIT_READ_ONLY_METADATA_NO_DEPLOY'}
  if operation not in ['publish','recover']:raise ValueError('OPERATION_INVALID')
  if not re.fullmatch('[a-f0-9]{40}',expected_sha) or expected_sha!=source_sha:raise ValueError('SOURCE_SHA_MISMATCH')
 else:raise ValueError('EVENT_INVALID')
 if current['mode']!='visual' or current.get('hosting_certified') is not True or not current.get('certification_reference') or not re.fullmatch(r'sites/sgp-one-lab/versions/[A-Za-z0-9_-]+',current.get('baseline_version') or '') or not re.fullmatch(r'sites/sgp-one-lab/versions/[A-Za-z0-9_-]+',current.get('rollback_version') or ''):return {'route':'hold','reason':'HOSTING_CERTIFICATION_MISSING'}
 approved=current.get('approved_lp_files')
 if not isinstance(approved,dict) or set(approved)!=set(PROTECTED) or any(approved[k]!=hashes.get(k) for k in PROTECTED):return {'route':'hold','reason':'LP_ASSETS_NOT_APPROVED'}
 return {'route':('visual' if event=='push' else operation),'reason':'CERTIFIED_VISUAL_POLICY'}
if __name__=='__main__':
 if os.environ.get('GITHUB_REPOSITORY')!='jcastillodelarosa-hub/SGP-ONE-LAB' or os.environ.get('GITHUB_REF') not in ['refs/heads/main','refs/heads/feat/lp01-seguimiento-operacion']:raise ValueError('REPOSITORY_OR_REF_NOT_ADMITTED')
 root=Path(__file__).resolve().parents[1];cur=json.loads((root/POLICY).read_text());prev=None
 if os.environ['GITHUB_EVENT_NAME']=='push':
  before=json.loads(Path(os.environ['GITHUB_EVENT_PATH']).read_text())['before']
  if before=='0'*40:raise ValueError('NO_PREVIOUS_MAIN_TREE')
  if not re.fullmatch('[a-f0-9]{40}',before):raise ValueError('BEFORE_INVALID')
  p=subprocess.run(['git','show',before+':'+POLICY],cwd=root,text=True,capture_output=True)
  if p.returncode==0:prev=json.loads(p.stdout)
  else:
   # Missing policy is adoption only when the before tree is actually available.
   subprocess.run(['git','cat-file','-e',before+'^{commit}'],cwd=root,check=True,capture_output=True)
 hashes={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in PROTECTED}
 changed=False
 if os.environ['GITHUB_EVENT_NAME']=='push' and prev is not None:
  for path in PROTECTED:
   old=subprocess.run(['git','show',before+':'+path],cwd=root,capture_output=True)
   if old.returncode or hashlib.sha256(old.stdout).hexdigest()!=hashes[path]:changed=True
 result=decide(os.environ['GITHUB_EVENT_NAME'],os.environ.get('LP_OPERATION','prepare'),cur,prev,hashes,os.environ['GITHUB_SHA'],os.environ.get('LP_SOURCE_SHA',''),changed_lp=changed)
 with open(os.environ['GITHUB_OUTPUT'],'a') as out:
  for k,v in result.items():out.write(k+'='+v+'\n')
 print(json.dumps(result))
