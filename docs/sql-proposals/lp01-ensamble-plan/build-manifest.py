"""Hash only. No database, generated SQL rewrite, connection or activation."""
from pathlib import Path
import hashlib,json,re
D=Path(__file__).resolve().parent;R=D.parents[2]
s=(D/'01_plan_REVIEW.sql').read_text()
functions={name:{'body_md5':hashlib.md5(body.encode()).hexdigest(),'body_sha256':hashlib.sha256(body.encode()).hexdigest()} for name,body in re.findall(r'CREATE FUNCTION sgp_lp_operacion\.(plan_\w+)\(.*? AS \$\$(.*?)\$\$;',s,re.S)}
files=[p for p in D.iterdir() if p.name!='manifest.json' and p.is_file()]+list((R/'tests/lp01-ensamble-plan').glob('*.mjs'))+list((R/'tests/lp01-ensamble-plan').glob('*.json'))
manifest={'status':'PROPOSED_NOT_APPLIED_DISABLED','source_head':'518eb2d76c2036be1bc31d225b01068129fbdebe','scope':'ENSAMBLE/PANELES_2 only; private helpers, no public RPC or new grant','functions':functions,'source_pins':{'programar':'248f9feb45f1c2d260896aa95c3e1569','mover':'52752c4887c68f8336e38c08a58cc38b'},'artifact_sha256':{str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(files)},'limits':['No live SQL/activation or multiconnection PostgreSQL17 evidence','No command/import/close/runtime integration','Prior history UNKNOWN, never reconstructed']}
(D/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'functions':len(functions),'files':len(files),'status':manifest['status']}))
