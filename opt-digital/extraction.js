// Generic preliminary extraction recovered from the approved v14 prototype.
export function linesFromItems(items){
 let groups=[];
 for(const item of items){if(!item.str?.trim())continue;const y=Math.round(item.transform[5]/2)*2;let row=groups.find(g=>Math.abs(g.y-y)<3);if(!row){row={y,items:[]};groups.push(row)}row.items.push({x:item.transform[4],text:item.str})}
 groups.sort((a,b)=>b.y-a.y);
 return groups.map(g=>g.items.sort((a,b)=>a.x-b.x).map(t=>t.text.trim()).join(' ').replace(/\s+/g,' ').trim()).filter(Boolean)
}
export function inferPlansFromPages(pageLines){
 const plans=[], issues=[];
 let activeRef='',finish='';
 const title=/\b((?:ES-[A-Z0-9-]+|ALU-[A-Z0-9-]+|PLA-[A-Z0-9-]+))\s+(2604 BERMUDA BRONZE|CLEAR ANOD CL 1|MILL FINISH)\b/i;
 const bar=/Longitud del perfil:\s*([^,]+),\s*Perfiles usados:\s*(\d+)/i;
 const length=/\b\d+(?:\s+\d+\/\d+)?\s*"/g;
 for(let pi=0;pi<pageLines.length;pi++){
   let ls=pageLines[pi];
   for(let i=0;i<ls.length;i++){
     let head=ls[i].match(title);if(head){activeRef=head[1].toUpperCase();finish=head[2].toUpperCase()}
     let m=ls[i].match(bar);if(!m)continue;
     const page=pi+1,barqty=Number(m[2]),barLength=m[1].trim();
     let hdr=ls[i];const location=(hdr.match(/UBICACION:\s*(\S+)/i)||[])[1]||'—';const code=(hdr.match(/CODIGO:\s*(\S+)/i)||[])[1]||'—';
     let sec=[];
     for(let j=i+1;j<ls.length;j++){
       if(bar.test(ls[j])||title.test(ls[j])||/P[aá]gina\s*\d+\s*\/\s*\d+/i.test(ls[j]))break;
       sec.push(ls[j]);
     }
     let cuts=[];
     // Solo filas inequívocas: #perf, longitud, referencia, Cant. en la misma línea.
     for(let k=0;k<sec.length;k++){
       let row=sec[k];let rm=row.match(/^\s*(\d+)\s+(\d+(?:\s+\d+\/\d+)?")\s+(.+?)\s+(\d+)\s+(?:\d+(?:\s+\d+\/\d+)?"|$)/);
       if(!rm)continue;
       let rep=Number(rm[1]),qty=Number(rm[4]);if(rep>100||qty>100||rep<1||qty<1)continue;
       for(let n=0;n<rep*qty;n++)cuts.push({length:rm[2],project:rm[3],qty:1,profileInstance:Math.floor(n/qty)+1,unitInstance:n%qty+1,sourceRow:k+1});
     }
     if(!activeRef){issues.push('Página '+page+': barra sin referencia reconocida');continue}
     if(!cuts.length){issues.push('Página '+page+' · '+activeRef+': patrón sin cortes interpretables; revisar PDF');}
     plans.push({id:'import-p'+page+'-'+i,ref:activeRef,finish,length:barLength,barqty,location,code,page,cuts,extractionStatus:'PRELIMINAR: requiere conciliación manual',rawSection:sec.join('\n')});
   }
 }
 return {plans:plans.filter(p=>p.cuts.length),issues,detected:plans.length};
}
