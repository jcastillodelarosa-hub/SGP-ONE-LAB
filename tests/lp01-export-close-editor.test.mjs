import test from 'node:test';import assert from 'node:assert/strict';
import {exportCloseEnabled,confirmedImport,exportCloseCommand} from '../src/modules/lp01-export-close-editor.js';
import {powerBIExportMode} from '../src/server/lp-powerbi-export-mode.js';
const context={stage:'EMPAQUE',line:'PANELES_2',date:'2026-11-08',shift:1};
const data=()=>({contract:'LP-OPERACION-1',writeContract:'LP-OPERACION-CAS-2',writes:true,turn:{estado:'ABIERTO',revision:4},exportClose:{...context,writerScope:'LP-EXPORT-DUAL-1',contract:'LP-EXPORT-CLOSE-4',authority:'EXPORT_PRODUCTION_V2',enabled:true,canImport:true,canClose:true}});
const receipt=()=>({ok:true,writerScope:'LP-EXPORT-DUAL-1',contract:'LP-EXPORT-IMPORT-3',authority:'EXPORT_PRODUCTION_V2',turnRevision:4,universe:{...context},sha256:'a'.repeat(64),universeRevision:'b'.repeat(64),fileId:'file',importId:'import',rows:[{key:'A|PANELES_2',coverage:'PRESENT',quantity:0,valueStatus:'CURRENT_FILE'},{key:'B|PANELES_2',coverage:'ABSENT',quantity:3,valueStatus:'PRESERVED'},{key:'C|PANELES_2',coverage:'ABSENT',quantity:null,valueStatus:'NEVER_REPORTED'}]});
test('missing, stale or legacy discovery cannot enable the editor',()=>{assert(exportCloseEnabled(data(),context));for(const patch of [{exportClose:null},{writes:false},{writeContract:'old'},{turn:{estado:'CERRADO'}}])assert(!exportCloseEnabled({...data(),...patch},context));for(const patch of [{writerScope:null},{stage:'ENSAMBLE'},{date:'2026-11-09'},{canClose:false},{enabled:false}])assert(!exportCloseEnabled({...data(),exportClose:{...data().exportClose,...patch}},context));});
test('receipts preserve explicit zero, prior quantity and unknown without summing',()=>{assert(confirmedImport(receipt(),data(),context));for(const patch of [{turnRevision:3},{writerScope:null},{universe:{...context,shift:2}},{contract:'legacy'},{rows:[...receipt().rows,receipt().rows[0]]}])assert.equal(confirmedImport({...receipt(),...patch},data(),context),null);});
test('close sends identifiers and reasons only, never plan, baseline, quantity or manual advance',()=>{assert.throws(()=>exportCloseCommand(receipt(),data(),context,{},'Cierre'),/motivo/);const cmd=exportCloseCommand(receipt(),data(),context,{'B|PANELES_2':'Conservado','C|PANELES_2':'Pendiente','EVIL':'ignored'},' Cierre ');assert.deepEqual(Object.keys(cmd).sort(),['close_authority','close_contract','file_id','import_id','observation','reasons']);assert.equal(cmd.reasons.EVIL,undefined);assert.equal(cmd.observation,'Cierre');const r=receipt();r.rows[0].pendingAgainstPlan=2;assert.throws(()=>exportCloseCommand(r,data(),context,{'B|PANELES_2':'b','C|PANELES_2':'c'},'Cierre'),/motivo/);});
test('gateway deploy mode defaults contained and accepts only explicit dual marker',()=>{assert.equal(powerBIExportMode(undefined).exportProductionV2,false);assert.equal(powerBIExportMode('LP-EXPORT-DUAL-1').exportWriterScope,'LP-EXPORT-DUAL-1');assert.throws(()=>powerBIExportMode('true'));});
test('historical writer requires matching explicit discovery, never inferred from date',()=>{const d=data(),r=receipt();d.exportClose.writerScope='LP-EXPORT-HISTORICAL-1';assert(exportCloseEnabled(d,context));assert.equal(confirmedImport(r,d,context),null);r.writerScope='LP-EXPORT-HISTORICAL-1';assert(confirmedImport(r,d,context));assert.equal(confirmedImport(r,data(),context),null);});

test('confirmed rows show exact authorized order, system and finish, not receipt guesses',async()=>{
 const {exportCloseRowDetails}=await import('../src/modules/lp01-export-close-editor.js');
 const key='A|PANELES_2',row={key,valueStatus:'CURRENT_FILE',produccion:'untrusted receipt name'};
 const d={catalog:{contract:'LP-HOJA-1',...context,productions:[{key,oficial:{key_produccion:key,id_linea:context.line,produccion:'Orden A',sistema:'ES-2020',acabado:'BRONZE'}}]}};
 assert.deepEqual(exportCloseRowDetails(row,d,context),{production:'Orden A',system:'ES-2020',finish:'BRONZE',status:''});
 d.catalog.date='2026-01-01';assert.equal(exportCloseRowDetails(row,d,context).production,'No informado');
 d.catalog.date=context.date;d.catalog.productions[0].oficial.id_linea='OTHER';assert.equal(exportCloseRowDetails(row,d,context).production,'No informado');
});
test('metadata fallback keeps absent values explicit and Spanish preserved status',async()=>{
 const {exportCloseRowDetails}=await import('../src/modules/lp01-export-close-editor.js');
 const key='A|PANELES_2',oficial={key_produccion:key,id_linea:context.line,produccion:'Orden A',sistema:'ES-2020'};
 const d={catalog:{contract:'LP-HOJA-1',...context,productions:[{key,oficial}]},orders:[{key,etapa:context.stage,linea:context.line,fecha:context.date,turno:context.shift,oficial:{...oficial,acabado:'WHITE'}}]};
 assert.equal(exportCloseRowDetails({key,valueStatus:'PRESERVED'},d,context).finish,'WHITE');
 assert.equal(exportCloseRowDetails({key,valueStatus:'PRESERVED'},d,context).status,'Valor anterior conservado');
 d.orders[0].fecha='2026-01-01';assert.equal(exportCloseRowDetails({key},d,context).finish,'No informado');
 assert.equal(exportCloseRowDetails({key,valueStatus:'NEVER_REPORTED'},{},context).status,'Sin reporte previo');
});
