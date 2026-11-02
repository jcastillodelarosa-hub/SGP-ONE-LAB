import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('../docs/sql-proposals/mecanizado/reserva-compartida-canonica.sql',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('read and both write routes use first reservation as canonical owner',()=>{
 assert.match(sql,/nullif\(trim\(split_part\(coalesce\(sp\.reserva_al,''\),',',1\)\), ''\)=p_reserva/);
 assert.match(sql,/pr\.reserva=nullif\(trim\(split_part\(coalesce\(sp\.reserva_al,''\),',',1\)\), ''\)/);
 assert.match(sql,/RESERVA_NO_PRINCIPAL/);
 assert.doesNotMatch(sql,/join principal x/);
 assert.doesNotMatch(sql,/replace\(pg_get_functiondef|EXECUTE reader|EXECUTE writer/i);
});

test('secondary reserve notice remains informational and outside totals',()=>{
 assert.match(app,/function sharedIncomingForReserve\(reserva\)/);
 assert.match(app,/sharedReserveNoticeHtml\(reserva\)/);
 assert.match(app,/prog-shared-info/);
});
