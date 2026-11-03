from pathlib import Path
import os,json
root=Path(os.environ['RUNNER_TEMP'])/'sgp-ordinary';public=root/'public';m=json.loads((public/'manifest.json').read_text())
if m['mode']!='SGP_EXISTING_RUNTIME_LP_NOT_ACTIVATED':raise ValueError('ORDINARY_MODE_REQUIRED')
if 'src/modules/lp01-followup.js' in (public/'index.html').read_text():raise ValueError('LP_BOOT_NOT_ALLOWED')
config={'hosting':{'public':'public','ignore':[],'headers':[{'source':'**','headers':[{'key':'Cache-Control','value':'no-cache, no-store, must-revalidate'}]}]}}
(root/'firebase.json').write_text(json.dumps(config,indent=2)+'\n')
