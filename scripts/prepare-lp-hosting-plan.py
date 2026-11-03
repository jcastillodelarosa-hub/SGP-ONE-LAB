"""OFFLINE ONLY: verify sealed frontend ZIP and prepare review config, never call Firebase."""
from pathlib import Path,PurePosixPath
import zipfile,hashlib,json,stat,sys,shutil,tempfile,argparse
MAX=32*1024*1024
DENY={'private','tests','docs','supabase','scripts','functions','.git','.github','.agents','node_modules'}
def prepare(archive,expected,destination):
 archive=Path(archive);dest=Path(destination)
 if len(expected)!=64 or any(c not in '0123456789abcdef' for c in expected):raise ValueError('DIGEST_REQUIRED')
 if archive.stat().st_size>MAX or hashlib.sha256(archive.read_bytes()).hexdigest()!=expected:raise ValueError('ZIP_DIGEST_MISMATCH')
 with zipfile.ZipFile(archive) as z:
  info=z.infolist();names=[i.filename for i in info]
  if len(names)!=len(set(names)) or sum(i.file_size for i in info)>MAX or len(info)>1000:raise ValueError('ZIP_LIMIT_OR_DUPLICATE')
  for i in info:
   p=PurePosixPath(i.filename)
   if any(part.startswith('.') for part in p.parts) or (p.suffix not in {'.html','.js','.css','.svg','.png','.jpg','.webp','.woff','.woff2','.ico','.json'}) or (p.suffix=='.json' and i.filename not in {'manifest.json','lp-visual-synthetic.json','release-info.json'}) or i.is_dir() or not p.parts or p.is_absolute() or '..' in p.parts or '\\' in i.filename or p.as_posix()!=i.filename or p.parts[0] in DENY or i.filename.startswith('src/server/') or stat.S_ISLNK(i.external_attr>>16):raise ValueError('UNSAFE_PATH')
  manifest=json.loads(z.read('manifest.json'))
  if manifest.get('mode')!='FULL_SGP_FRONTEND_WITH_SCOPED_SYNTHETIC_LP' or manifest.get('production_deploy') is not False:raise ValueError('VISUAL_ARTIFACT_REQUIRED')
  files=manifest.get('files')
  if not isinstance(files,dict) or set(names)!=set(files)|{'manifest.json'}:raise ValueError('UNMANIFESTED_FILE')
  for p,h in files.items():
   if hashlib.sha256(z.read(p)).hexdigest()!=h:raise ValueError('FILE_DIGEST_MISMATCH')
  for required in ['index.html','app.js','config.js','src/domain/lp01-visual-bridge.js','src/modules/lp01-followup.js','src/modules/lp01-operation.js','lp-visual-synthetic.json']:
   if required not in files:raise ValueError('FRONTEND_INCOMPLETE')
  bootstrap=z.read('src/modules/lp01-followup.js').decode();operation=z.read('src/modules/lp01-operation.js').decode()
  if 'bridge:visualLPBridge(base,read)' not in bootstrap or "const importPowerBI=async()=>{throw Error(" not in operation:raise ValueError('VISUAL_GUARD_MISSING')
  if dest.exists():raise ValueError('DESTINATION_MUST_BE_NEW')
  dest.parent.mkdir(parents=True,exist_ok=True);temporary=Path(tempfile.mkdtemp(prefix='.lp-publish-',dir=dest.parent))
  try:
   public=temporary/'public';public.mkdir()
   for name in names:
    p=public/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(z.read(name))
   config={'hosting':{'site':'sgp-one-lab','public':'public','ignore':[],'headers':[{'source':'**','headers':[{'key':'Cache-Control','value':'no-cache, no-store, must-revalidate'}]}]}}
   (temporary/'firebase.review.json').write_text(json.dumps(config,indent=2)+'\n')
   plan={'status':'BLOQUEADO','network_actions':0,'archive_sha256':expected,'files_verified':len(files),'candidate_project':'sgp-one-lab','candidate_site':'sgp-one-lab','project_site_verified':False,'live_release':None,'live_version':None,'rollback_exact':False,'deploy_command':None,'config':'firebase.review.json','public_root':'public','workflow':'EXPLICIT_REVIEWED_ARTIFACT_NOT_PUSH_MAIN','requires':['authorized live channel metadata','exact prior artifact or verified retained Firebase version','final artifact/site/rollback approval'],'review_only_future_cli':['firebase','deploy','--only','hosting','--project','sgp-one-lab','--config','firebase.review.json']}
   (temporary/'plan.json').write_text(json.dumps(plan,indent=2)+'\n');temporary.rename(dest)
  finally:
   if temporary.exists():shutil.rmtree(temporary)
 return plan
if __name__=='__main__':
 parser=argparse.ArgumentParser(description='Offline artifact preflight; never executes Firebase')
 parser.add_argument('zip');parser.add_argument('sha256');parser.add_argument('output');args=parser.parse_args()
 result=prepare(args.zip,args.sha256,args.output);print(json.dumps({'status':result['status'],'files_verified':result['files_verified'],'network_actions':0}))
