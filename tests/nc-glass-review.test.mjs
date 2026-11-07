import test from 'node:test';
import assert from 'node:assert/strict';
import {ncGlassReviewCandidates,requireNcGlassReviewSelection} from '../src/modules/lp01-nc-glass-review.js';

const source={consecutivo:'NC-17',orden:'982383 - Producción completa',sistema:'ES-TEST',semana_maestro:45,estado_nc:'ABIERTA',activo:true,linea_responsable:'PANELES 2',cant_repo:9};
const row={key:'1314100|PANELES_2',produccion:source.orden,oficial:{sistema:source.sistema},linea:'PANELES_2'};
const candidate=(value=source)=>({reference:value.consecutivo,source:value,sources:[value],sameResponsibleLine:true});
const result=(values=[candidate()])=>({status:'READY',count:values.length,candidates:values});
const previous=()=>ncGlassReviewCandidates(result(),row)[0];
const choice=(extra={})=>requireNcGlassReviewSelection({previous:previous(),result:result(),row,stage:'ENSAMBLE',confirmed:true,...extra});

test('a successful empty read is distinct from unavailable and unauthorized results',()=>{
 assert.deepEqual(ncGlassReviewCandidates(result([]),row),[]);
 for(const response of [null,{status:'UNAVAILABLE',count:null,candidates:[]},{status:'UNAUTHORIZED',count:0,candidates:[]}]){
  assert.throws(()=>ncGlassReviewCandidates(response,row),error=>error.code===(response?.status==='UNAUTHORIZED'?'UNAUTHORIZED':'UNAVAILABLE'));
 }
});

test('validates complete row identity, response cardinality and unique references',()=>{
 for(const badRow of [{...row,key:''},{...row,produccion:''},{...row,oficial:{}},{...row,linea:null}])assert.throws(()=>ncGlassReviewCandidates(result(),badRow));
 for(const response of [{status:'READY'},{...result(),count:null},{...result(),count:2},{...result(),count:-1},result([candidate(),candidate()])])assert.throws(()=>ncGlassReviewCandidates(response,row));
});

test('only explicitly active, open NCs with exact full production and system are eligible',()=>{
 for(const change of [{activo:false},{activo:'true'},{activo:undefined},{estado_nc:'CERRADA'},{estado_nc:null},{orden:'982383'},{sistema:'OTHER'},{consecutivo:''}]){
  assert.throws(()=>ncGlassReviewCandidates(result([candidate({...source,...change})]),row));
 }
 assert.equal(ncGlassReviewCandidates(result([candidate({...source,estado_nc:' abierta ',orden:'  982383 - PRODUCCIO\u0301N   COMPLETA ',sistema:' es-test '})]),row).length,1);
});

test('missing, mismatched or partly inactive source evidence is rejected',()=>{
 for(const value of [
  {...candidate(),source:null}, {...candidate(),sources:[]}, {...candidate(),sources:null},
  {...candidate(),reference:'NC-OTHER'}, {...candidate(),sources:[{...source,activo:false}]},
  {...candidate(),sources:[{...source,linea_responsable:'OTHER'}]}
 ])assert.throws(()=>ncGlassReviewCandidates(result([value]),row));
});

test('different or missing responsible lines remain possible candidates, never links',()=>{
 for(const linea_responsable of ['FRAMES 2',null]){
  const next={...candidate({...source,linea_responsable}),sameResponsibleLine:false};
  const [reviewed]=ncGlassReviewCandidates(result([next]),row);
  assert.equal(reviewed.sameResponsibleLine,false);assert.equal(reviewed.source.linea_responsable,linea_responsable);
  for(const field of ['linked','windows','quantity','stage','key'])assert.equal(Object.hasOwn(reviewed,field),false);
 }
});

test('candidate snapshots cannot be modified by later mutations of the input',()=>{
 const original={...source},data=result([candidate(original)]),[reviewed]=ncGlassReviewCandidates(data,row);
 original.orden='changed';data.candidates[0].reference='changed';
 assert.equal(reviewed.source.orden,source.orden);assert.equal(reviewed.sources[0].orden,source.orden);assert.equal(reviewed.reference,source.consecutivo);
 assert.throws(()=>{reviewed.source.activo=false;},TypeError);
});

test('selection must explicitly supply a current NC, a supported stage and confirmation',()=>{
 for(const extra of [{previous:null},{stage:''},{stage:'ensamble'},{stage:'OTHER'},{confirmed:false},{confirmed:1}])assert.throws(()=>choice(extra),error=>error.code==='INVALID_SELECTION');
 for(const stage of ['ENSAMBLE','EMPAQUE'])assert.equal(choice({stage}).stage,stage);
});

test('prepares only the explicit reference and stage with the fresh source, never a quantity or link',()=>{
 const fresh={...source,cant_repo:500},prepared=choice({result:result([candidate(fresh)])});
 assert.deepEqual(Object.keys(prepared),['reference','stage','source']);assert.equal(prepared.source.cant_repo,500);
 assert.equal(prepared.reference,source.consecutivo);assert.equal(prepared.stage,'ENSAMBLE');
 assert.equal(Object.hasOwn(prepared,'quantity'),false);assert.equal(Object.hasOwn(prepared,'linked'),false);
});

test('source identity changes, closed NCs and disappearing references prevent preparation',()=>{
 assert.throws(()=>choice({result:result([])}),error=>error.code==='CHANGED');
 for(const change of [{consecutivo:'NC-18'},{orden:'982383 - Another'},{sistema:'ES-OTHER'},{linea_responsable:'FRAMES 2'},{semana_maestro:46},{activo:false},{estado_nc:'CERRADA'}])assert.throws(()=>choice({result:result([candidate({...source,...change})])}));
});

test('reordering candidates or repeated item rows cannot change the selected NC',()=>{
 const next=candidate({...source,consecutivo:'NC-18'});
 for(const values of [[next,candidate()],[candidate(),next]])assert.equal(choice({result:result(values)}).reference,'NC-17');
 const a={...candidate(),sources:[source,{...source,item:'2'}]},before=ncGlassReviewCandidates(result([a]),row)[0];
 assert.equal(choice({previous:before,result:result([{...a,sources:[...a.sources].reverse()}])}).reference,'NC-17');
 assert.throws(()=>choice({previous:before,result:result()}),error=>error.code==='CHANGED');
});

test('a denied or failed forced read never falls back to previously loaded evidence',()=>{
 for(const status of ['UNAVAILABLE','UNAUTHORIZED'])assert.throws(()=>choice({result:{status,count:null,candidates:[]}}),error=>error.code===status);
});
