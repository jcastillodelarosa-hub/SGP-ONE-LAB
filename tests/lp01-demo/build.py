"""Build a separate, static, read-only synthetic preview; never deploy."""
from pathlib import Path
import sys,shutil,re,json,hashlib
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tests/lp01-operacion'))
from postgres import Database
OUT=Path('/tmp/sgp-lp183-preview');OUT.mkdir(exist_ok=True)
db=Database()
try:
 key='QA-DEMO|PANELES_2';parts=db.seed(key);snapshots={}
 for stage in ['ENSAMBLE','EMPAQUE']:
  db.execute(db.cmd('ABRIR',stage=stage))
  for p,n in zip(parts,[90,90,90,18]):db.execute(db.cmd('SALE',stage=stage,key=key,part=p,quantity=n,observation='DEMO · decisión sintética'))
  db.execute(db.cmd('EJECUTAR',stage=stage,key=key,part=parts[0],quantity=90,observation='DEMO · P1 completa'),'LIDER')
  db.execute(db.cmd('EJECUTAR',stage=stage,key=key,part=parts[1],quantity=30,observation='DEMO · pendiente vidrio'),'LIDER')
  db.execute(db.cmd('VALIDAR',stage=stage,key=key,part=parts[1],affectations={'NC_AL':2,'NC_V':2},consolidated=2,observation='DEMO · solapamiento confirmado'))
  rows=db.snapshot(stage)['orders'];content='etapa;fecha;turno;key_produccion;parte;cantidad\n'+'\n'.join(';'.join(map(str,[stage,'2026-11-01',1,r['key'],r['parte'],r['ejecutado']])) for r in rows)
  db.sql('UPDATE sgp_lp_operacion.config SET formato_bi_aprobado=true WHERE id')
  f=db.execute(db.cmd('IMPORTAR_BI',stage=stage,filename='demo-synthetic.csv',content=content))
  db.execute(db.cmd('CERRAR',stage=stage,file_id=f['fileId'],observation='DEMO · cierre sintético justificado',reasons={key+'/'+p:'DEMO · pendiente' for p in parts}),'LIDER')
  db.sql('UPDATE sgp_lp_operacion.config SET escrituras=false WHERE id')
  snapshots[stage]=db.snapshot(stage);db.sql('UPDATE sgp_lp_operacion.config SET escrituras=true WHERE id')
finally:db.close()
# Copy only passive styles and the modules needed by the existing LP interface.
for folder in ['src/domain','src/modules']:
 dst=OUT/folder;dst.mkdir(parents=True,exist_ok=True)
 for p in (ROOT/folder).rglob('*'):
  if p.is_file() and p.suffix in ['.js','.css']:
   q=OUT/p.relative_to(ROOT);q.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,q)
for p in ROOT.glob('*.css'):shutil.copyfile(p,OUT/p.name)
for name in ['production-line-tabs.js','favicon-sgp.svg']:shutil.copyfile(ROOT/name,OUT/name)
html=(ROOT/'index.html').read_text();html=re.sub(r'<script\b[^>]*>.*?</script>','',html,flags=re.S)
html=html.replace('<head>','<head><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; connect-src \'self\'; script-src \'self\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data:; object-src \'none\'; base-uri \'none\'; form-action \'none\'">')
html=html.replace('</body>','<script src="demo.js"></script><script src="production-line-tabs.js"></script><script type="module" src="src/modules/lp01-followup.js"></script></body>')
(OUT/'index.html').write_text(html);(OUT/'snapshots.json').write_text(json.dumps(snapshots))
shutil.copyfile(ROOT/'tests/lp01-demo/demo.js',OUT/'demo.js')
manifest={'mode':'STATIC_SYNTHETIC_READ_ONLY','output':'/tmp/sgp-lp183-preview','files':{str(p.relative_to(OUT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in OUT.rglob('*') if p.is_file()}}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2));print('Preview prepared locally; no publish or deployment')
