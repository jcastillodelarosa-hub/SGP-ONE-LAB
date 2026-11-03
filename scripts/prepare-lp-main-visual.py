"""Offline frontend artifact, never deploys; positive allowlist excludes private/backend files."""
from pathlib import Path
import subprocess,shutil,json,hashlib,sys,re
ROOT=Path(__file__).resolve().parents[1];OUT=Path('/tmp/sgp-lp183-main-visual')
if len(sys.argv)>2:raise SystemExit('At most one local synthetic input')
source=Path(sys.argv[1]) if len(sys.argv)==2 else ROOT/'tests/lp01-integration/fixtures/lp-synthetic.json';snapshot=json.loads(source.read_text())
if set(snapshot)!={'ENSAMBLE','EMPAQUE'} or any(r['key']!='QA-DEMO|PANELES_2' for s in snapshot.values() for r in s['orders']):raise SystemExit('Synthetic fixture required')
if OUT.exists():shutil.rmtree(OUT)
OUT.mkdir();files=subprocess.check_output(['git','ls-files'],cwd=ROOT,text=True).splitlines()
for rel in files:
 p=Path(rel)
 if p.suffix not in ['.html','.js','.css','.svg','.png','.jpg','.webp','.woff','.woff2','.ico']:continue
 if len(p.parts)>1 and p.parts[0] not in ['src','assets','vendor']:continue
 if p.parts[0]=='src' and (len(p.parts)<3 or p.parts[1] not in ['modules','domain','services','ui','config','data']):continue
 dst=OUT/p;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/p,dst)
# SDK is generated/untracked in this repository: use the existing local build, no credentials.
(OUT/'vendor').mkdir(exist_ok=True)
for name in ['supabase.js','html2canvas.min.js','jspdf.umd.min.js']:shutil.copyfile(ROOT/'vendor'/name,OUT/'vendor'/name)
for rel in ['src/domain/lp01-visual-bridge.js']:
 dst=OUT/rel;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/rel,dst)
(OUT/'lp-visual-synthetic.json').write_text(json.dumps(snapshot))
p=OUT/'src/modules/lp01-followup.js';s=p.read_text();start=s.index('function boot(){');end=s.index("\nif(document.readyState",start)
s=s[:start]+'''function boot(){
 const tracking=document.getElementById('productionTrackingPanel'),operation=document.getElementById('productionOperationPanel');
 const base={getToken:()=>window.SGPPlannerBridge?.getToken?.()};
 const read=async stage=>{const r=await fetch(new URL('../../lp-visual-synthetic.json',import.meta.url),{cache:'no-store'});return (await r.json())[stage];};
 mountFollowup({tracking,operation,bridge:visualLPBridge(base,read)});
 tracking.querySelector('[data-op-date]').value='2026-11-01';
 for(const panel of [tracking,operation]){const b=document.createElement('p');b.textContent='DATOS SINTÉTICOS · MUESTRA VISUAL · SIN OPERACIONES PRODUCTIVAS';b.style='padding:12px;background:#fff3cd;color:#493600;font-weight:bold';panel.prepend(b);}
}
'''+s[end:];p.write_text("import {visualLPBridge} from '../domain/lp01-visual-bridge.js';\n"+s)
# The XLSX uploader uses fetch outside the RPC bridge: explicitly remove that
# path in this visual artifact as defense beyond disabled controls.
p=OUT/'src/modules/lp01-operation.js';s=p.read_text();needle="import {importPowerBI} from './lp01-powerbi-client.js';"
if s.count(needle)!=1:raise SystemExit('XLSX client contract changed; review required')
p.write_text(s.replace(needle,"const importPowerBI=async()=>{throw Error('Muestra visual: no se importa ni se envía Power BI');};"))
# index, app and config remain the full SGP application; no demo.js or fake global auth bridge.
manifest={'mode':'FULL_SGP_FRONTEND_WITH_SCOPED_SYNTHETIC_LP','source_head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'production_deploy':False,'files':{str(p.relative_to(OUT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.rglob('*') if p.is_file()}}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Prepared offline full SGP visual artifact; no publish')
