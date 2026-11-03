"""Build/seal only. Prints artifact hashes, never configuration values or credentials."""
from pathlib import Path
import subprocess,json,hashlib,zipfile,os
ROOT=Path(__file__).resolve().parents[1]
subprocess.run(['node',str(ROOT/'scripts/stamp-lp-release.mjs')],cwd=ROOT,check=True)
subprocess.run(['python',str(ROOT/'scripts/prepare-lp-main-visual.py')],cwd=ROOT,check=True)
root=Path('/tmp/sgp-lp183-main-visual');target=Path(os.environ.get('RUNNER_TEMP','/tmp'))/'lp-visual.zip'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(root.rglob('*')):
  if p.is_file():z.write(p,str(p.relative_to(root)))
result={'source_sha':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'zip_sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'filename':target.name}
(target.parent/'lp-visual-digest.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
