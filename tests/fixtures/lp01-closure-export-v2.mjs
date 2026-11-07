/** Synthetic immutable-close shape matching close-fragment.sql. No production data
 * or writes; the same fixture is shared by the reader, reports and controller QA. */
export function closureV2Fixture(){
 const context={stage:'ENSAMBLE',line:'PANELES_2',date:'2026-11-07',shift:1};
 const closureId='11111111-1111-4111-8111-111111111111',fileId='22222222-2222-4222-8222-222222222222',importId='33333333-3333-4333-8333-333333333333';
 const refs=['44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555','66666666-6666-4666-8666-666666666666'];
 const official=(name,system)=>({key_produccion:name+'|PANELES_2',id_linea:context.line,produccion:name,sistema:system,reserva_al:'R-'+name,cantidad:20,saldos_inicializados:true,presente_ultimo_export:true,saldo_ensamble:10,anio:2026,semana_base:45});
 const assignment=(name,part)=>({key:name+'|PANELES_2',parte:part,linea:context.line,etapa:context.stage,fecha:context.date,turno:context.shift,sale:999,ejecutado:999,observacion:'Referencia manual histórica',oficial:official(name,'ES100')});
 const row=(name,parts,coverage)=>({key:name+'|PANELES_2',identity:{key:name+'|PANELES_2',line:context.line,production:name,system:name==='A'?'ES100':null},coverage,realized:coverage==='PRESENT'?7:null,plan:null,planStatus:'PLAN_SOURCE_REQUIRED',difference:null,pendingAgainstPlan:null,
  scheduledReference:{authority:'HISTORICAL_REFERENCE_ONLY',quantity:null,assignments:[]},preserve:coverage==='ABSENT',sourceRows:coverage==='PRESENT'?[2,3]:[],reason:coverage==='ABSENT'?'No incluida en este archivo':null,
  assignmentRefs:[...parts],manualHistory:{authority:'HISTORICAL_ONLY',assignments:parts.map(part=>assignment(name,part))},budget:{status:'RECONCILIATION_REQUIRED',available:null},continuity:{status:'RECONCILIATION_REQUIRED',quantity:null,allocation:'NONE'}});
 const snapshot={ok:true,contract:'LP-EXPORT-CLOSE-3',authority:'EXPORT_PRODUCTION_V2',id:closureId,...context,type:'CON_ACTIVIDAD',version:4,importId,universeRevision:'b'.repeat(64),rows:[row('A',refs.slice(0,2),'PRESENT'),row('B',refs.slice(2),'ABSENT')],file:{id:fileId,name:'ensamble-export.xlsx',sha256:'a'.repeat(64),adapter:'LP-PBI-XLSX-1'},reasons:{'B|PANELES_2':'No incluida en este archivo'},observation:'Cierre sintético para pruebas',user:'QA_COORDINADOR',canContinue:false,comparisonComplete:false,planComparison:'PLAN_SOURCE_REQUIRED',reconciliation:'RECONCILIATION_REQUIRED'};
 for(const row of snapshot.rows){row.valueStatus=row.coverage==='PRESENT'?'CURRENT_FILE':'NEVER_REPORTED';row.valueSource=row.coverage==='PRESENT'?{importId,importVersion:snapshot.version-1,universeRevision:snapshot.universeRevision,context:{...context},file:{...snapshot.file},sourceRows:[...row.sourceRows]}:null;}
 return {context,data:{contract:'LP-OPERACION-1',turn:{estado:'CERRADO',revision:4,etapa:context.stage,linea:context.line,fecha:context.date,turno:context.shift},orders:[assignment('A',refs[0]),assignment('A',refs[1]),assignment('B',refs[2])],
  catalog:{contract:'LP-HOJA-1',...context,productions:['A','B'].map(name=>({key:name+'|PANELES_2',oficial:official(name,'ES100'),assignments:[]}))},
  reports:[{id:closureId,etapa:context.stage,linea:context.line,fecha:context.date,turno:context.shift,version:4,archivo:fileId,tipo:'CON_ACTIVIDAD',usuario:snapshot.user,creado_en:'2026-11-07T19:30:00Z',snapshot}]}};
}

/** Two committed versions: A7/B5, then a filtered A3 file. B keeps the exact
 * source of its earlier value; current-file coverage remains ABSENT. */
export function closurePartialReloadFixture(){
 const fixture=closureV2Fixture(),latest=fixture.data.reports[0],s=latest.snapshot,old=structuredClone(latest);
 old.id='77777777-7777-4777-8777-777777777777';old.version=2;old.snapshot.id=old.id;old.snapshot.version=2;
 old.snapshot.importId='88888888-8888-4888-8888-888888888888';old.snapshot.universeRevision='c'.repeat(64);
 old.archivo='99999999-9999-4999-8999-999999999999';old.snapshot.file={id:old.archivo,name:'earlier-full-export.xlsx',sha256:'d'.repeat(64),adapter:'LP-PBI-XLSX-1'};
 for(const [index,row] of old.snapshot.rows.entries()){
  Object.assign(row,{coverage:'PRESENT',valueStatus:'CURRENT_FILE',realized:index===0?7:5,preserve:false,sourceRows:[index+2],reason:null});
  row.valueSource={importId:old.snapshot.importId,importVersion:1,universeRevision:old.snapshot.universeRevision,context:{...fixture.context},file:{...old.snapshot.file},sourceRows:[...row.sourceRows]};
 }
 old.snapshot.reasons={};
 // Close2 → reopen3 → partial import4 → close5; the prior source remains import1.
 latest.version=5;s.version=5;fixture.data.turn.revision=5;s.rows[0].valueSource.importVersion=4;s.rows[0].realized=3;
 Object.assign(s.rows[1],{realized:5,valueStatus:'PRESERVED',valueSource:structuredClone(old.snapshot.rows[1].valueSource)});
 fixture.data.reports.unshift(old);
 return fixture;
}
