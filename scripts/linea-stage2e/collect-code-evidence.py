"""Versioned-code provenance only: no service requests or credential reads."""
from pathlib import Path
from datetime import datetime,timezone
import subprocess,json,hashlib,re
R=Path(__file__).resolve().parents[2];MAIN='0a1a5fd53cf622817f164e4031e6c83e7ab0ac56';BASE='a716bdaf8fc23bf757d808369ba48f86e1463b63'
need={
 'app.js':[r'sgp_previsualizar_export_diario',r'sgp_aplicar_export_diario',r'p_id_lote:data.id_carga_diaria',r'sgp_consultar_ensamble',r'const faltantes=',r'sgp_picking_validar_recepcion',r'function repoCanValidate',r'SGPOperationalCanManage'],
 'src/domain/production-importer.js':[r'"Ens\."',r'"Emp\."',r'"Saldo Ens\."',r'"Saldo Emp\."',r'key_produccion: id'],
 'supabase/migrations/001_core_schema.sql':[r'key_produccion text primary key',r'cantidad numeric',r'ensamblado numeric',r'empacado numeric',r'saldo_ensamble numeric',r'saldo_empaque numeric',r'reserva_al text'],
 'supabase/migrations/20261018_pdt_validation_workflow.sql':[r'FUNCTION public.sgp_consultar_ensamble',r'where ap.produccion=p.produccion'],
 'planner-operations-v326.js':[r"rpc\('sgp_linea_plan_"],
 'supabase/migrations/20261022190000_sgp_carga_semanal_stage_timings.sql':[r'pg_try_advisory_xact_lock',r'insert into sgp_producciones',r'insert into sgp_aluminio',r'insert into sgp_lotes_carga'],
 'supabase/migrations/20261023_picking_no_duplicar_entrega_completa.sql':[r'advisory',r'where e.id_programacion',r'trigger'],
 'supabase/migrations/20261027090000_picking_fecha_turno_guard_123.sql':[r'statement_timestamp',r'PICKING_',r'BEFORE INSERT'],
 'src/modules/pdt-v2-controller.js':[r'const validated=',r'const needsValidation=',r'needsValidation && editable']}
files=[]
for path,patterns in need.items():
 b=subprocess.check_output(['git','show',MAIN+':'+path],cwd=R)
 files.append({'path':path,'commit':MAIN,'sha256':hashlib.sha256(b).hexdigest(),'classification':'VERIFICADO EN CÓDIGO','matches':[{'line':i,'excerpt':s[:360]} for i,s in enumerate(b.decode().splitlines(),1) if any(re.search(p,s) for p in patterns)]})
capture=R/'scripts/pdt-compatibility/evidence/PDT_FUNCIONES_REALES.json'
funcs=[{'signature':f['firma'],'definitionSha256':hashlib.sha256(f['definicion'].encode()).hexdigest(),'provenance':'CAPTURA_PREVIA_NO_RECONSULTADA','currentInstallation':'NO DISPONIBLE'} for f in json.loads(capture.read_text())['funciones']]
cmd=['git','grep','-n','-i',r'create.*function.*sgp_\(previsualizar_export_diario\|aplicar_export_diario\)',MAIN,'--','*.sql']
p=subprocess.run(cmd,cwd=R,text=True,capture_output=True);assert p.returncode in(0,1)
out={'capturedAtUtc':datetime.now(timezone.utc).isoformat(),'main':MAIN,'base':BASE,'supabaseReadPerformed':False,'files':files,'priorCapturedFunctions':funcs,'exportDefinitionsFoundInMainSql':p.stdout.splitlines(),'limits':['Code is not installed Supabase metadata','No real Supabase connector/pool available','Reconstructed prior complement is not original SQL Editor export','No source availability or physical identity inferred']}
(R/'tests/linea-stage2e/evidence/code-sources.json').write_text(json.dumps(out,indent=2,ensure_ascii=False)+'\n')
print('Evidence:',len(files),'versioned files;',len(funcs),'preserved prior definitions')
