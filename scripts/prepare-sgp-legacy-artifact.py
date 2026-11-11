"""Ordinary releases after PR adoption retain pre-LP navigation; no network/deploy."""
from pathlib import Path
import subprocess,json,hashlib,shutil,re,os
ROOT=Path(__file__).resolve().parents[1]
# Reuse the reviewed positive-list frontend builder, then remove only LP activation.
subprocess.run(['python',str(ROOT/'scripts/prepare-lp-main-visual.py')],cwd=ROOT,check=True)
out=Path(os.environ.get('SGP_OPT_REVIEW_OUTPUT','/tmp/sgp-lp183-main-visual'));policy=json.loads((ROOT/'deployment/lp-hosting-policy.json').read_text())
legacy=(ROOT/'deployment/lp-legacy-navigation.js').read_bytes()
if hashlib.sha256(legacy).hexdigest()!=policy['legacy_navigation_sha256']:raise ValueError('LEGACY_NAVIGATION_NOT_APPROVED')
(out/'production-line-tabs.js').write_bytes(legacy)
p=out/'index.html';html=p.read_text();html,count=re.subn(r'<script type="module" src="src/modules/lp01-followup.js[^\"]*"></script>','',html)
if count!=1:raise ValueError('LP_BOOT_ENTRY_CHANGED')
p.write_text(html);(out/'lp-visual-synthetic.json').unlink()
# Original module source is preserved on normal releases, but not mounted by index.
for rel in ['src/modules/lp01-followup.js','src/modules/lp01-operation.js']:(out/rel).write_bytes((ROOT/rel).read_bytes())
manifest={'mode':'SGP_EXISTING_RUNTIME_LP_NOT_ACTIVATED','source_head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'files':{str(p.relative_to(out)):hashlib.sha256(p.read_bytes()).hexdigest() for p in out.rglob('*') if p.is_file() and p.name!='manifest.json'}}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Ordinary release artifact prepared: existing runtime; LP entry excluded; positive file list')
