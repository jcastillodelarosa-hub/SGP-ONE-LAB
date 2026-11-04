import {crc32} from '../../src/domain/powerbi/xlsx-reader.js';
/** Tiny uncompressed ZIP fixture writer, used only to inject invalid XML with valid CRCs. */
export function storeZip(entries){
 const local=[],central=[];let offset=0;
 for(const [name,value] of entries){const n=new TextEncoder().encode(name),bytes=typeof value==='string'?new TextEncoder().encode(value):value,crc=crc32(bytes),h=new Uint8Array(30+n.length),c=new Uint8Array(46+n.length),v=new DataView(h.buffer),w=new DataView(c.buffer);
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint32(14,crc,true);v.setUint32(18,bytes.length,true);v.setUint32(22,bytes.length,true);v.setUint16(26,n.length,true);h.set(n,30);local.push(h,bytes);
  w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint32(16,crc,true);w.setUint32(20,bytes.length,true);w.setUint32(24,bytes.length,true);w.setUint16(28,n.length,true);w.setUint32(42,offset,true);c.set(n,46);central.push(c);offset+=h.length+bytes.length;
 }
 const end=new Uint8Array(22),v=new DataView(end.buffer),size=central.reduce((n,c)=>n+c.length,0);v.setUint32(0,0x06054b50,true);v.setUint16(8,entries.size,true);v.setUint16(10,entries.size,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);
 const out=new Uint8Array(offset+size+22);let at=0;for(const p of [...local,...central,end]){out.set(p,at);at+=p.length;}return out;
}
