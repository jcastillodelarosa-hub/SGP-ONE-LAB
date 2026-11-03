"""Only reached by the pinned/certified visual policy; reuse offline verifier."""
from pathlib import Path
import os,json,subprocess
root=Path(__file__).resolve().parents[1];temp=Path(os.environ['RUNNER_TEMP']);data=json.loads((temp/'lp-visual-digest.json').read_text())
download=temp/'lp-download';download.mkdir()
for name in ['lp-visual.zip','lp-visual-digest.json']:(download/name).write_bytes((temp/name).read_bytes())
env=os.environ.copy();env.update(LP_SOURCE_SHA=data['source_sha'],LP_ZIP_SHA=data['zip_sha256'])
subprocess.run(['python',str(root/'scripts/lp-verify-downloaded-artifact.py')],env=env,cwd=root,check=True)
