"""Positive-list real frontend, no data fixtures, no deployment or backend activation."""
from pathlib import Path
import subprocess,shutil,json,hashlib
ROOT=Path(__file__).resolve().parents[1];OUT=Path('/tmp/sgp-lp183-main-visual')
if OUT.exists():shutil.rmtree(OUT)
OUT.mkdir()
for rel in subprocess.check_output(['git','ls-files'],cwd=ROOT,text=True).splitlines():
 p=Path(rel)
 if p.suffix not in ['.html','.js','.css','.svg','.png','.jpg','.webp','.woff','.woff2','.ico']:continue
 if len(p.parts)>1 and p.parts[0] not in ['src','assets','vendor']:continue
 if p.parts[0]=='src' and(len(p.parts)<3 or p.parts[1] not in ['modules','domain','services','ui','config','data']):continue
 if rel=='src/domain/lp01-visual-bridge.js':continue
 dst=OUT/p;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/p,dst)
(OUT/'vendor').mkdir(exist_ok=True)
for n in ['supabase.js','html2canvas.min.js','jspdf.umd.min.js']:shutil.copyfile(ROOT/'vendor'/n,OUT/'vendor'/n)
if (ROOT/'release-info.json').exists():shutil.copyfile(ROOT/'release-info.json',OUT/'release-info.json')
manifest={'mode':'FULL_SGP_RUNTIME_LP','production_deploy':True,'backend_activation':False,'source_head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'files':{str(p.relative_to(OUT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.rglob('*') if p.is_file()}}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print('Prepared real RPC frontend, no synthetic data, no deployment')
