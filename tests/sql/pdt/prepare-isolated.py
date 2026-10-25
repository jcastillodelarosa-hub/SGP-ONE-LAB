"""Prepare an atomic batch; optional install ONLY after replica/catalog preflight."""
import argparse,json,pathlib,subprocess,sys,os,re,hashlib
sys.dont_write_bytecode=True
from installation_plan import ROOT,render,manifest
parser=argparse.ArgumentParser()
parser.add_argument('--phase',choices=['A','B','AB'],default='AB')
parser.add_argument('--output',type=pathlib.Path,required=True)
parser.add_argument('--install',action='store_true')
parser.add_argument('--database')
parser.add_argument('--production-catalog',type=pathlib.Path)
args=parser.parse_args()
if args.install:
 if args.phase!='AB':parser.error('Compatible replica installation requires complete AB batch')
 if not args.database or not re.fullmatch(r'sgp_pdt_qa_91_[A-Za-z0-9_]+',args.database) or not args.production_catalog:
  parser.error('Specify isolated database and production catalog')
 # Preflight validates network isolation and exact catalog; any difference aborts.
 result=subprocess.run([sys.executable,str(ROOT/'tests/sql/pdt/preflight-compatible.py'),args.database,'--production-catalog',str(args.production_catalog)])
 if result.returncode:raise SystemExit(result.returncode)
text=render(args.phase)
os.umask(0o077)
# Exclusive creation: preserve existing review artifacts, never overwrite.
with args.output.open('x',encoding='utf-8') as handle:handle.write(text)
metadata={'phase':args.phase,'sql_sha256':hashlib.sha256(text.encode()).hexdigest(),'sources':manifest(args.phase),'production_applied':False}
with pathlib.Path(str(args.output)+'.manifest.json').open('x',encoding='utf-8') as handle:json.dump(metadata,handle,indent=2)
print(json.dumps({'batch':str(args.output),'manifest':str(args.output)+'.manifest.json','phase':args.phase,'production_applied':False}))
if args.install:
 result=subprocess.run(['docker','exec','-i','sgp-pdt-qa-91','psql','-X','-U','postgres','-d',args.database,'-v','ON_ERROR_STOP=1'],input=text,text=True,capture_output=True)
 if result.returncode:raise SystemExit('Isolated atomic installation failed; transaction rolled back.\n'+result.stderr)
 print('Installed only in isolated replica; acceptance tests still required.')
