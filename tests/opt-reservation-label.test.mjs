import test from 'node:test';
import assert from 'node:assert/strict';
import {optReservationLabel} from '../src/domain/opt-reservation-label.js';
import {buildOptProgrammingSnapshot} from '../src/domain/opt-line-scope.js';
const scope={linea:'PANELES_2',anio:2026,semana:46,modo:'BASE'};
const group={reservation:'SYNTH',system:'PANEL',origin:'SERVIDOR',scope,references:[{fuentes:[{origen:'RETAIL'},{origen:'PROYECTO'}]}]};
const production=(key,finish)=>({id_linea:scope.linea,key_produccion:key,sistema:'PANEL',reserva_principal:'SYNTH',reservas_compartidas:[{reserva:'SYNTH',tipo:'PRINCIPAL',acabado:finish}]});
const snapshot=rows=>buildOptProgrammingSnapshot({context:scope,productions:rows,shared:[]});
test('shared origins and all exact reservation finishes; metadata never mutates identities',()=>{
 const s=snapshot([production('A','White'),production('B','Black'),production('C','White')]),before=JSON.stringify([group,s]);
 assert.equal(optReservationLabel(group,s),'SYNTH · PANEL · Acabado: Black / White · Proyecto / Retail · Compartida');
 assert.equal(JSON.stringify([group,s]),before);
});
test('missing, partial and mismatched programming metadata remain explicit',()=>{
 assert.match(optReservationLabel(group,null),/Acabado no disponible/);
 const s=snapshot([production('A','White'),production('B',null)]);
 assert.match(optReservationLabel(group,s),/Acabado: White \/ no disponible/);
 assert.match(optReservationLabel(group,{...s,status:'STALE'}),/Acabado no disponible/);
 assert.match(optReservationLabel({...group,scope:{...scope,semana:47}},s),/Acabado no disponible/);
 assert.match(optReservationLabel({...group,reservation:'OTHER'},s),/Acabado no disponible/);
 assert.match(optReservationLabel({...group,system:'FRAME'},s),/Acabado no disponible/);
});
test('never borrow production finish or index for shared groups, never infer Project from BASE',()=>{
 const p={...production('A',null),acabado:'PRODUCTION-ONLY',reservas_compartidas:[]};
 assert.match(optReservationLabel({...group,associations:[{entry:{finish:'LOCAL-ONLY'}}]},snapshot([p])),/Acabado no disponible/);
 assert.match(optReservationLabel({...group,references:[{fuentes:[{origen:'BASE'},{origen:'DESCONOCIDO'}]}]}),/Origen no disponible/);
});
test('local index preserves multiple and partial finishes without changing status',()=>{
 const local={...group,origin:'RETAIL',associations:[{entry:{finish:'Blue'}},{entry:{finish:'White'}},{entry:{finish:''}}]};
 assert.equal(optReservationLabel(local),'SYNTH · PANEL · Acabado: Blue / White / no disponible · Retail · Candidato local');
 assert.match(optReservationLabel({...local,origin:'PROYECTO'}),/Proyecto · Candidato local$/);
 assert.match(optReservationLabel({...local,origin:'INDIVIDUAL'}),/Origen no disponible/);
});
