"""Reconstruct a previous frontend from Git for review; never publishes or claims live parity."""
from pathlib import Path
import subprocess,json,hashlib,shutil
ROOT=Path(__file__).resolve().parents[1];REF='4b1e98e37fdd9f615266c963088c8d1313b51266';OUT=Path('/tmp/sgp-lp183-rollback-candidate')
def old(p):return subprocess.check_output(['git','show',REF+':'+p],cwd=ROOT)
if OUT.exists():shutil.rmtree(OUT)
OUT.mkdir()
for rel in subprocess.check_output(['git','ls-tree','-r','--name-only',REF],cwd=ROOT,text=True).splitlines():
 p=Path(rel)
 if p.suffix not in ['.html','.js','.css','.svg','.png','.jpg','.webp','.woff','.woff2','.ico']:continue
 if len(p.parts)>1 and p.parts[0] not in ['src','assets','vendor']:continue
 if p.parts[0]=='src' and (len(p.parts)<3 or p.parts[1] not in ['modules','domain','services','ui','config','data']):continue
 q=OUT/p;q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(old(rel))
matched=json.loads(old('package.json'))['dependencies']==json.loads((ROOT/'package.json').read_text())['dependencies'] and old('scripts/build-vendor.mjs')==(ROOT/'scripts/build-vendor.mjs').read_bytes()
if matched:shutil.copytree(ROOT/'vendor',OUT/'vendor',dirs_exist_ok=True)
manifest={'source':REF,'deploy_run':41514147768,'status':'RECONSTRUCTED_SOURCE_NOT_VERIFIED_LIVE_BYTES','vendor_pinned_build_matches':matched,'files':{str(p.relative_to(OUT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.rglob('*') if p.is_file()}}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(ROOT/'tests/lp01-integration/evidence/rollback.json').write_text(json.dumps({k:v for k,v in manifest.items() if k!='files'},indent=2)+'\n');print('Previous frontend source reconstructed locally; live parity still requires verification')
