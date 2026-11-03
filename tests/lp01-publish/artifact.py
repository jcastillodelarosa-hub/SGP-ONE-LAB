"""Actual local build/download preflight paths. No Actions, tokens or network."""
from pathlib import Path
import subprocess,tempfile,os,json,hashlib,shutil,zipfile
ROOT=Path(__file__).resolve().parents[2];checks=[];index=(ROOT/'index.html').read_bytes();info=ROOT/'release-info.json';old_info=info.read_bytes() if info.exists() else None
try:
 with tempfile.TemporaryDirectory() as t:
  temp=Path(t);env=os.environ.copy();sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip();env.update(RUNNER_TEMP=t,GITHUB_SHA=sha)
  subprocess.run(['python','scripts/prepare-sgp-legacy-artifact.py'],cwd=ROOT,env=env,check=True,capture_output=True)
  public=Path('/tmp/sgp-lp183-main-visual');assert 'src/modules/lp01-followup.js' not in (public/'index.html').read_text()
  assert (public/'production-line-tabs.js').read_bytes()==(ROOT/'deployment/lp-legacy-navigation.js').read_bytes()
  assert (public/'app.js').read_bytes()==(ROOT/'app.js').read_bytes() and (public/'config.js').read_bytes()==(ROOT/'config.js').read_bytes()
  assert not (public/'lp-visual-synthetic.json').exists();ordinary=temp/'sgp-ordinary/public';ordinary.parent.mkdir();shutil.copytree(public,ordinary)
  subprocess.run(['python','scripts/write-sgp-ordinary-config.py'],cwd=ROOT,env=env,check=True,capture_output=True)
  assert json.loads((ordinary.parent/'firebase.json').read_text())['hosting']['public']=='public'
  checks.append('Ordinary artifact retains byte-identical legacy navigation and current app/config, removes LP boot/sample, separate public root')
  subprocess.run(['python','scripts/seal-lp-visual.py'],cwd=ROOT,env=env,check=True,capture_output=True)
  digest=json.loads((temp/'lp-visual-digest.json').read_text());assert digest['source_sha']==sha
  download=temp/'lp-download';download.mkdir()
  for name in ['lp-visual.zip','lp-visual-digest.json']:shutil.copyfile(temp/name,download/name)
  env.update(LP_ZIP_SHA=digest['zip_sha256'],LP_SOURCE_SHA=sha)
  subprocess.run(['python','scripts/lp-verify-downloaded-artifact.py'],cwd=ROOT,env=env,check=True,capture_output=True)
  reviewed=temp/'lp-reviewed/public';manifest=json.loads((reviewed/'manifest.json').read_text())
  assert manifest['mode']=='FULL_SGP_FRONTEND_WITH_SCOPED_SYNTHETIC_LP'
  assert 'bridge:visualLPBridge(base,read)' in (reviewed/'src/modules/lp01-followup.js').read_text()
  assert "const importPowerBI=async()=>{throw Error(" in (reviewed/'src/modules/lp01-operation.js').read_text()
  assert 'data-release-commit="'+sha+'"' in (reviewed/'index.html').read_text()
  assert not any(p.split('/')[0] in ['private','tests','docs','supabase','deployment','scripts','functions'] or p.startswith('src/server/') for p in manifest['files'])
  checks.append('Sealed visual ZIP and source pins revalidated byte-for-byte; deterministic commit stamp and RPC/HTTP write guards preserved; private/backend paths absent')
  # Wrong run/source metadata or a different external hash cannot reuse the prepared artifact.
  env['LP_ZIP_SHA']='0'*64
  r=subprocess.run(['python','scripts/lp-verify-downloaded-artifact.py'],cwd=ROOT,env=env,capture_output=True,text=True)
  assert r.returncode and 'ARTIFACT_PROVENANCE_MISMATCH' in r.stderr
  checks.append('Mismatched reviewed artifact digest refused before credentials or Firebase')
  # A self-consistent re-sealed package that omits a source resource must still fail.
  with zipfile.ZipFile(download/'lp-visual.zip') as z:payload={x.filename:z.read(x.filename) for x in z.infolist()}
  m=json.loads(payload['manifest.json']);missing='vendor/jspdf.umd.min.js';del m['files'][missing];del payload[missing];payload['manifest.json']=json.dumps(m).encode()
  with zipfile.ZipFile(download/'lp-visual.zip','w',zipfile.ZIP_DEFLATED) as z:
   for name,content in payload.items():z.writestr(name,content)
  altered=hashlib.sha256((download/'lp-visual.zip').read_bytes()).hexdigest();digest['zip_sha256']=altered;(download/'lp-visual-digest.json').write_text(json.dumps(digest));env['LP_ZIP_SHA']=altered
  shutil.rmtree(temp/'lp-reviewed')
  r=subprocess.run(['python','scripts/lp-verify-downloaded-artifact.py'],cwd=ROOT,env=env,capture_output=True,text=True)
  assert r.returncode and 'ARTIFACT_SOURCE_INVENTORY_DIFFERS' in r.stderr
  checks.append('Self-consistent new ZIP/manifest/digest omitting an original source asset rejected before account use')

 result={'status':'PASS','checks':checks,'firebase_actions':0,'limits':['Local source/ZIP integration only; no GitHub artifact download, Hosting credentials or active version certified']}
 (ROOT/'tests/lp01-publish/evidence/artifact.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
finally:
 (ROOT/'index.html').write_bytes(index)
 if old_info is not None:info.write_bytes(old_info)
 elif info.exists():info.unlink()
