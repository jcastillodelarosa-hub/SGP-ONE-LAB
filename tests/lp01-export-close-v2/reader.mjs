// Read-only contract bridge: consumes saved synthetic SQL readbacks. No SQL or
// production connection. The writer evidence lives in partial.mjs/results.json.
import assert from 'node:assert/strict';
import {currentClosureExportRealized} from '../../src/domain/lp01-closure-export-v2.js';
import {closureExportRealized} from '../../src/domain/lp01-closure-export.js';
import {assemblyReports,assemblyReportCSV,assemblyReportMarkup} from '../../src/modules/lp01-assembly-reports.js';

export async function assertReaderReadback(readback,context,{corrected=false}={}){
 const original=JSON.stringify(readback),current=currentClosureExportRealized(readback,context);
 assert.equal(current.status,'CONFIRMED');assert.equal(current.contract,'LP-REALIZADO-CIERRE-3');assert.equal(current.authority,'EXPORT_PRODUCTION_V2');
 assert.equal(current.comparisonComplete,false);assert.equal(current.canContinue,false);
 const byKey=new Map(current.rows.map(row=>[row.key,row]));assert.equal(byKey.size,3);
 const present=byKey.get(corrected?'OPEN|PANELES_2':'PLAN|PANELES_2'),preserved=byKey.get(corrected?'PLAN|PANELES_2':'OPEN|PANELES_2'),never=byKey.get('OTHER|PANELES_2');
 assert.equal(present.coverage,'PRESENT');assert.equal(present.valueStatus,'CURRENT_FILE');assert.equal(present.quantity,corrected?2:3);assert.equal(present.preserve,false);
 assert.equal(preserved.coverage,'ABSENT');assert.equal(preserved.valueStatus,'PRESERVED');assert.equal(preserved.quantity,corrected?0:5);assert.equal(preserved.preserve,true);
 assert.equal(never.coverage,'ABSENT');assert.equal(never.valueStatus,'NEVER_REPORTED');assert.equal(never.quantity,null);assert.equal(never.valueSource,null);
 assert.equal(present.fileId,current.file.id);assert.notEqual(preserved.fileId,current.file.id);assert.notEqual(preserved.sha256,current.file.sha256);
 assert.deepEqual(preserved.sourceRows,[]);assert(preserved.valueSource.sourceRows.length>0);
 for(const row of current.rows){assert.equal(row.plan,null);assert.equal(row.planStatus,'PLAN_SOURCE_REQUIRED');assert.equal(row.difference,null);assert.equal(row.pendingAgainstPlan,null);assert.equal(row.budget.available,null);assert.equal(row.continuity.quantity,null);assert.equal(row.identity.line,context.line);}
 assert.equal(closureExportRealized(readback,context).status,'INCOMPATIBLE_CLOSE');
 const reports=assemblyReports(readback,context);assert.equal(reports.currentStatus,'CONFIRMED');assert.equal(reports.reports.length,corrected?3:1);
 const report=reports.reports[0];assert.equal(report.valid,true);assert.equal(report.current,true);assert.equal(report.kind,'EXPORT_V2');assert.equal(report.sourceContract,'LP-EXPORT-CLOSE-3');
 assert.deepEqual(report.totals,{plan:null,realized:null,compliance:null,present:1,absent:2,preserved:1,neverReported:1,reported:corrected?2:3,preservedReported:corrected?0:5,knownReported:corrected?2:8});
 assert.equal(report.sourceFiles.length,2);assert(reports.reports.slice(1).every(r=>r.valid&&!r.current));
 if(corrected)assert.deepEqual(reports.reports.map(r=>r.totals.knownReported),[2,5,8]);
 const csv=assemblyReportCSV(report);
 // These generated synthetic cells deliberately contain no quote-semicolon-quote sequences.
 const matrix=csv.replace(/^\uFEFF/,'').split('\r\n').map(line=>line.slice(1,-1).split('";"').map(cell=>cell.replaceAll('""','"')));
 const [header,...records]=matrix,at=(row,name)=>row[header.indexOf(name)],csvRows=new Map(records.map(row=>[at(row,'Producción (key)'),row]));
 assert.equal(records.length,3);assert(records.every(row=>row.length===header.length));
 assert.equal(at(csvRows.get(present.key),'Realizado'),String(present.quantity));assert.equal(at(csvRows.get(preserved.key),'Realizado'),String(preserved.quantity));assert.equal(at(csvRows.get(never.key),'Realizado'),'');
 for(const row of current.rows){const record=csvRows.get(row.key);assert.equal(at(record,'ID archivo actual'),current.file.id);assert.equal(at(record,'ID archivo del valor'),row.fileId??'');assert.equal(at(record,'SHA256 del valor'),row.sha256??'');assert.equal(at(record,'Estado del valor'),row.valueStatus);assert.equal(at(record,'Filas de origen del valor'),row.valueSource?.sourceRows.join(', ')??'');}
 for(const row of records){for(const name of ['Plan del turno','Cumplimiento (%)','Disponible','Continuidad'])assert.equal(at(row,name),'',name);assert.equal(at(row,'Estado del plan'),'PLAN_SOURCE_REQUIRED');assert.equal(at(row,'Comparación completa'),'false');assert.equal(at(row,'Puede continuar'),'false');}
 const markup=assemblyReportMarkup(report);assert.match(markup,/valor anterior conservado/);assert.match(markup,/Nunca informado/);assert.match(markup,/Fuente conservada/);
 const changed=structuredClone(readback);for(const production of changed.catalog?.productions??[])Object.assign(production.oficial,{produccion:'RENAMED TODAY',sistema:'NOT HISTORICAL'});
 const historical=assemblyReports(changed,context).reports[0];assert.deepEqual(historical.rows.map(r=>[r.production,r.system]),report.rows.map(r=>[r.production,r.system]));
 changed.turn.estado='EN_REVISION';assert.equal(currentClosureExportRealized(changed,context).status,'NO_CONFIRMED_CLOSE');assert(assemblyReports(changed,context).reports.every(r=>r.valid&&!r.current));
 assert.equal(JSON.stringify(readback),original);
 return {current,report,csv};
}
