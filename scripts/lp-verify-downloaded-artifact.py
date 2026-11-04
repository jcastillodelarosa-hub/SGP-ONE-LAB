"""Future workflow preflight only; no network or deployment."""
from pathlib import Path
import os,json,importlib.util,shutil,re,subprocess
root=Path(__file__).resolve().parents[1];temp=Path(os.environ['RUNNER_TEMP']);download=temp/'lp-download';sha=os.environ['LP_ZIP_SHA'];source=os.environ['LP_SOURCE_SHA']
if not re.fullmatch('[a-f0-9]{64}',sha) or not re.fullmatch('[a-f0-9]{40}',source):raise ValueError('EXPLICIT_PINS_REQUIRED')
if source!=os.environ['GITHUB_SHA']:raise ValueError('DISPATCH_SOURCE_MISMATCH')
metadata=json.loads((download/'lp-visual-digest.json').read_text())
if metadata.get('source_sha')!=source or metadata.get('zip_sha256')!=sha:raise ValueError('ARTIFACT_PROVENANCE_MISMATCH')
spec=importlib.util.spec_from_file_location('preflight',root/'scripts/prepare-lp-hosting-plan.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
kind=json.loads((root/'deployment/lp-hosting-policy.json').read_text()).get('artifact_kind','visual')
review=temp/'lp-reviewed';m.prepare(download/'lp-visual.zip',sha,review,kind=kind)
manifest=json.loads((review/'public/manifest.json').read_text())
if manifest.get('source_head')!=source:raise ValueError('ARTIFACT_SOURCE_MISMATCH')
# Byte-bind ordinary SGP resources and all LP resources to this exact reviewed source.
# The known visual transformations are reconstructed, not arbitrary artifact code.
subprocess.run(['node',str(root/'scripts/stamp-lp-release.mjs')],cwd=root,check=True)
subprocess.run(['python',str(root/('scripts/prepare-lp-runtime.py' if kind=='runtime' else 'scripts/prepare-lp-main-visual.py'))],cwd=root,check=True)
reference=Path('/tmp/sgp-lp183-main-visual')
if set(manifest['files'])!=set(json.loads((reference/'manifest.json').read_text())['files']):raise ValueError('ARTIFACT_SOURCE_INVENTORY_DIFFERS')
for rel in manifest['files']:
 if (review/'public'/rel).read_bytes()!=(reference/rel).read_bytes():raise ValueError('ARTIFACT_SOURCE_BYTES_DIFFER')
shutil.copyfile(review/'firebase.review.json',review/'firebase.json')
print('Sealed artifact, source and review config verified; Hosting authorization still required')
