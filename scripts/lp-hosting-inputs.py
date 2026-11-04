import os,re,json
from pathlib import Path
policy=json.loads((Path(__file__).resolve().parents[1]/'deployment/lp-hosting-policy.json').read_text())
route=os.environ['LP_ROUTE']
# Later routine pushes use the certified/pinned visual policy and a fresh metadata
# read, not a stale version ID copied from its first release.
if route!='visual':
 if len(os.environ.get('LP_REASON','').strip())<10:raise ValueError('EXPLICIT_AUTHORIZATION_REFERENCE_REQUIRED')
 if not re.fullmatch(r'sites/sgp-one-lab/versions/[A-Za-z0-9_-]+',os.environ.get('LP_EXPECTED_LIVE','')):raise ValueError('ACCREDITED_CURRENT_VERSION_REQUIRED')
 if route=='publish' and os.environ.get('LP_EXPECTED_LIVE')!=policy.get('baseline_version'):raise ValueError('BASELINE_NOT_ACCREDITED_BY_POLICY')
 if route=='recover' and os.environ.get('LP_ROLLBACK_VERSION')!=policy.get('rollback_version'):raise ValueError('RECOVERY_NOT_ACCREDITED_BY_POLICY')
 if route=='publish' and (not re.fullmatch('[1-9][0-9]*',os.environ.get('LP_RUN','')) or not re.fullmatch('[a-f0-9]{64}',os.environ.get('LP_ZIP_SHA',''))):raise ValueError('REVIEWED_ARTIFACT_AND_DIGEST_REQUIRED')
 if route=='recover' and not re.fullmatch(r'sites/sgp-one-lab/versions/[A-Za-z0-9_-]+',os.environ.get('LP_ROLLBACK_VERSION','')):raise ValueError('ACCREDITED_ROLLBACK_VERSION_REQUIRED')
print('Specific inputs accepted; no Hosting action performed')
