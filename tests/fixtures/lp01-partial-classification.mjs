import {closurePartialReloadFixture} from './lp01-closure-export-v2.mjs';
export function partialClassificationFixture(){
 const f=JSON.parse(JSON.stringify(closurePartialReloadFixture()).replaceAll('"shift":1','"shift":2').replaceAll('"turno":1','"turno":2'));
 const report=f.data.reports.at(-1),r=report.snapshot.rows[0];
 const payload={contract:'LP-REPORT-CLASSIFICATION-2',status:'ESTIMATED_REFERENCE',method:'CHAINED_CLOSURES_RECONCILED',closureId:report.id,closureVersion:report.version,context:f.context,exactCut:false,historyComplete:false,
  source:{loadId:'synthetic-morning',file:'morning-synthetic.xlsx',at:'2026-11-07T07:41:00-05:00'},verificationSource:{loadId:'synthetic-next',file:'next-synthetic.xlsx',at:'2026-11-08T08:31:00-05:00'},
  priorClosures:[{closureId:'prior-synthetic',closureVersion:2,snapshotHash:'a'.repeat(32),context:{...f.context,shift:1}}],
  rows:[{key:r.key,status:'ESTIMATED_REFERENCE',quantity:10,baseBalance:5,initialBalance:3,realized:r.realized,finalBalance:0,verificationBalance:0,referenceRowId:1,verificationRowId:2,priorMovements:[{closureId:'prior-synthetic',quantity:2}]},
   {key:report.snapshot.rows[1].key,status:'UNAVAILABLE',reason:'NEXT_REFERENCE_MISSING',quantity:10,realized:5,initialBalance:null,finalBalance:null}]};
 return {...f,payload,report};
}
