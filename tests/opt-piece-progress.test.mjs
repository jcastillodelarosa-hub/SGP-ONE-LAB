import {test} from 'node:test';
import assert from 'node:assert/strict';
import {optPieceProgress} from '../src/domain/opt-piece-progress.js';
const pieces=(states)=>states.map((estado,i)=>({id_pieza:String(i+1),estado}));
test('progress counts individual authorized pieces, never document quantity or bars',()=>{
 assert.equal(optPieceProgress(pieces(['CORTADO','PENDIENTE','PENDIENTE'])).percent,33.3);
 assert.equal(optPieceProgress(pieces(['CORTADO','PENDIENTE'])).label,'En proceso');
 assert.equal(optPieceProgress(pieces(['CORTADO','CORTADO'])).percent,100);
 assert.equal(optPieceProgress(pieces(['CORTADO'])).label,'Cortada');
 assert.equal(optPieceProgress(pieces(['PENDIENTE'])).label,'Sin iniciar');
 assert.equal(optPieceProgress(pieces(Array.from({length:2001},(_,i)=>i?'CORTADO':'PENDIENTE'))).percent,99.9);
});
test('unassigned Frames and unverified ledger never assert zero percent',()=>{
 assert.equal(optPieceProgress([]).percent,null);
 assert.equal(optPieceProgress([]).label,'Sin asignar en este ámbito');
 for(const value of [null,[{id_pieza:'1',estado:'UNKNOWN'}],[...pieces(['CORTADO']),...pieces(['CORTADO'])]])assert.equal(optPieceProgress(value).label,'Estado sin comprobar');
 assert.equal(optPieceProgress(pieces(['CORTADO']),{known:false}).percent,null);
});
