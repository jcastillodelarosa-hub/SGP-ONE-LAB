/** Consume snapshots produced by the real isolated SQL fixture, without rewriting them. */
import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
import {currentClosureExportRealized} from '../../src/domain/lp01-closure-export-v2.js';
import {assemblyReports,assemblyReportMarkup,assemblyReportCSV} from '../../src/modules/lp01-assembly-reports.js';
const file=process.argv[2]||new URL('../lp01-export-dual/readback.json',import.meta.url);
const snapshots=JSON.parse(await readFile(file,'utf8')),results=[];
for(const snapshot of snapshots){
 const context={stage:snapshot.stage,line:snapshot.line,date:snapshot.date,shift:snapshot.shift};
 const report={id:snapshot.id,tipo:snapshot.type,etapa:snapshot.stage,linea:snapshot.line,fecha:snapshot.date,turno:snapshot.shift,archivo:snapshot.file.id,version:snapshot.version,snapshot,usuario:snapshot.user,creado_en:snapshot.planSnapshot.capturedAt};
 const data={contract:'LP-OPERACION-1',turn:{estado:'CERRADO',revision:snapshot.version},reports:[report]};
 const output=currentClosureExportRealized(data,context);assert.equal(output.status,'CONFIRMED',context.stage);assert.equal(output.canContinue,false);assert.equal(output.operationalReady,false);
 const model=assemblyReports(data,context).reports[0];assert(model.valid);assert(assemblyReportMarkup(model).includes(context.stage==='EMPAQUE'?'Empaque':'Ensamble'));assert(assemblyReportCSV(model).length>100);
 results.push({stage:context.stage,contract:output.contract,rows:output.rows.length,status:output.status,canContinue:output.canContinue});
}
assert(results.some(r=>r.stage==='ENSAMBLE')&&results.some(r=>r.stage==='EMPAQUE'));console.log(JSON.stringify({status:'PASS',source:'unaltered SQL fixture readback, not production',results}));
