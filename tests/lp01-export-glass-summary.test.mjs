import test from 'node:test';
import assert from 'node:assert/strict';
import {withExportGlassSummary} from '../src/domain/lp01-export-glass-summary.js';
import {sharedOrderSummary} from '../src/domain/lp01-shared-order-summary.js';
import {compactSummaryMarkup} from '../src/modules/lp01-affectation-summary.js';
import {orderDetailsTransport} from '../src/services/lp01-order-details.js';

const scope={key:'95629 - Synthetic fixture|PANELES_2',line:'PANELES_2',stage:'ENSAMBLE'};
const summary=()=>({categories:{NC_AL:null,NC_V:null,TECNO:null,NOVEDAD:null},reportedQuantities:{},aluminumCoverage:'COMPLETE',hasReports:false,total:null,available:null});
const details=(quantity='3',percentage='50',present=true)=>({contract:'LP-ORDER-DETAILS-1',...scope,note:{revision:0,observation:''},history:[],capabilities:['READ'],export:{quantity,percentage,present,at:'2026-11-06T12:00:00Z',load:'fixture'}});

test('the existing scoped details read makes partial glass visible without any report or assignment',async()=>{
 const calls=[];
 const transport=orderDetailsTransport({...scope,getToken:()=> 'fixture-token',client:{rpc:async(name,args)=>{calls.push({name,args});return {data:details()};}}});
 const result=withExportGlassSummary(summary(),await transport.read(),scope);
 assert.equal(result.exportGlass.exact,'1.5');
 assert.equal(result.exportGlass.rounded,'2');
 assert.equal(result.exportGlass.percentage,'50');
 assert.equal(result.exportGlass.source,'EXPORT');
 assert.match(compactSummaryMarkup(result),/>2 × Tecno · Export<\/button>/);
 assert.equal(calls.length,1);
 assert.equal(calls[0].name,'sgp_lp_order_details_read_v1');
 assert.deepEqual(calls[0].args,{p_token:'fixture-token',p_key:scope.key,p_stage:scope.stage});
 assert.equal(result.categories.TECNO,null);
 assert.equal(result.hasReports,false);
 assert.equal(result.total,null);
 assert.equal(result.available,null);
});

test('current estimates do not replace, sum, mutate or confirm historical reports',()=>{
 const base=summary();base.categories.TECNO=4;base.reportedQuantities.TECNO=[4];base.hasReports=true;base.total=4;base.available=6;
 const before=structuredClone(base),input=details('10','80'),sourceBefore=structuredClone(input);
 const result=withExportGlassSummary(base,input,scope),html=compactSummaryMarkup(result);
 assert.deepEqual(base,before);assert.deepEqual(input,sourceBefore);
 assert.equal(result.categories.TECNO,4);assert.deepEqual(result.reportedQuantities.TECNO,[4]);
 assert.equal(result.exportGlass.rounded,'2');assert.equal(result.total,4);assert.equal(result.available,6);
 assert.match(html,/>4 × Tecno · reportado<\/button>/);assert.match(html,/>2 × Tecno · Export<\/button>/);
 assert.doesNotMatch(html,/>6 × Tecno/);
});

test('zero availability, full availability and fractional percentages retain the approved meaning',()=>{
 for(const [quantity,percentage,rounded] of [['60','0','60'],['60','100','0'],['60','0.5','60'],['1','99','1'],['3','50','2'],['0','0','0']]){
  const result=withExportGlassSummary(summary(),details(quantity,percentage),scope);
  assert.equal(result.exportGlass.rounded,rounded);
  if(rounded==='0')assert.doesNotMatch(compactSummaryMarkup(result),/data-summary-source="EXPORT"/);
  else assert.match(compactSummaryMarkup(result),new RegExp('>'+rounded+' × Tecno · Export<'));
 }
});

test('absent, stale, malformed and out-of-range Export inputs never become zero or full impact',()=>{
 const invalid=[null,details(null,'80'),details('10',null),details('10','','true'),details('10','50',false),details('10','101'),details('10','NaN'),details('10','-1'),details('10','50 %'),details('10.5','20'),{...details(),export:{quantity:'10',percentage:'80'}}];
 for(const d of invalid){
  const result=withExportGlassSummary(summary(),d,scope);
  assert.equal(result.exportGlass.status,'UNAVAILABLE');
  assert.equal(result.exportGlass.rounded,null);
  assert.equal(result.categories.TECNO,null);
  assert.match(compactSummaryMarkup(result),/>Tecno · sin dato<\/button>/);
  assert.doesNotMatch(compactSummaryMarkup(result),/\d+ × Tecno/);
 }
});

test('foreign key, line, stage or contract cannot enrich another production',()=>{
 for(const change of [{key:'Other|PANELES_2'},{line:'FRAMES_2'},{stage:'EMPAQUE'},{contract:'other'}])assert.throws(()=>withExportGlassSummary(summary(),{...details(),...change},scope),/SCOPE_MISMATCH/);
 for(const s of [{...scope,key:'OTHER'}, {...scope,line:null}, {...scope,stage:'OTHER'},{}])assert.throws(()=>withExportGlassSummary(summary(),details(),s),/SCOPE_INVALID/);
});

test('a supplied computed count cannot override the scoped Export source',()=>{
 const d=details('3','50');d.glass={status:'AVAILABLE',rounded:'999',percentage:'0'};
 const result=withExportGlassSummary(summary(),d,scope);
 assert.equal(result.exportGlass.rounded,'2');
});

test('unknown reports do not hide a separately verified Export estimate',()=>{
 const result=withExportGlassSummary({status:'UNAVAILABLE'},details('10','80'),scope);
 const html=compactSummaryMarkup(result);
 assert.match(html,/>2 × Tecno · Export<\/button>/);assert.match(html,/Datos pendientes/);
});

test('NC recorded references include inactive and fully confirmed reports from both stores',()=>{
 const native={...scope,reports:[],aluminumPending:{status:'AVAILABLE',rows:[]}};
 const shared={...scope,revision:5,reports:[
  {cause:'NC_V',quantity:2,confirmed:2,nc_reference:' CLOSED '},
  {cause:'NC_V',quantity:3,confirmed:0,nc_reference:'ACTIVE'},
  {cause:'NC_AL',quantity:1,confirmed:0,nc_reference:'NOT-GLASS'},
  {cause:'NC_V',quantity:0,confirmed:0,nc_reference:null}
 ],legacyReports:[
  {causa:'NC_V',ventanas:1,confirmadas:1,ncReference:'LEGACY-CLOSED'},
  {causa:'NC_V',ventanas:1,confirmadas:1,ncReference:'ACTIVE'},
  {causa:'NC_V',ventanas:0,confirmadas:0,ncReference:' '},
  {causa:'NC_AL',ventanas:1,confirmadas:0,ncReference:'NOT-GLASS-EITHER'}
 ]};
 const before=structuredClone(shared),result=sharedOrderSummary(native,shared);
 assert.deepEqual(result.ncRecordedReferences,['CLOSED','ACTIVE','LEGACY-CLOSED']);
 assert.deepEqual(result.reportedQuantities.NC_V,[3]);
 assert.equal(result.categories.NC_V,3);assert.equal(result.ncEstimate,1);
 assert.equal(result.total,null);assert.equal(result.available,null);
 assert.deepEqual(shared,before);
});

test('NC candidates never become affected windows in an empty summary',()=>{
 const native={...scope,reports:[],aluminumPending:{status:'AVAILABLE',rows:[]}};
 const shared={...scope,revision:0,reports:[],legacyReports:[]};
 const result=sharedOrderSummary(native,shared);
 assert.deepEqual(result.ncRecordedReferences,[]);assert.equal(result.categories.NC_V,null);
 assert.equal(result.ncEstimate,null);assert.equal(result.total,null);
});
