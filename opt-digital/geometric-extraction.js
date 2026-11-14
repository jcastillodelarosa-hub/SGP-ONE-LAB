import {projectCell} from './pdf-grid.js';
import {reconcileIndividuals} from './individual-reconciliation.js';
// Read PDF text coordinates, never infer a missing quantity or reference from totals.
// Each continuation remains tied to its printed column and preceding pattern.
const norm = value => String(value ?? '').replace(/\s+/g, '');
const inch = /^\d+(?:\s+\d+\/\d+)?"$/;
export function thirtySeconds(value) {
  const m=String(value??'').trim().match(/^(\d+)(?:\s+(\d+)\/(\d+))?"$/);
  if(!m) return null;
  const whole=Number(m[1]),num=Number(m[2]||0),den=Number(m[3]||1);
  return Number.isSafeInteger(whole)&&num<den&&den>0&&32%den===0 ? whole*32+num*32/den : null;
}
export function coordinateRows(items) {
  const rows=[];
  for(const item of items){if(!item.str?.trim()||!Array.isArray(item.transform)||!Number.isFinite(item.transform[4])||!Number.isFinite(item.transform[5]))continue;
    const y=item.transform[5],x=item.transform[4],width=Number(item.width)||0;
    let row=rows.find(r=>Math.abs(r.y-y)<1.5);
    if(!row){row={y,items:[]};rows.push(row);}row.items.push({text:item.str.trim(),x,center:x+width/2});
  }
  return rows.sort((a,b)=>b.y-a.y).map(r=>({...r,items:r.items.sort((a,b)=>a.x-b.x),text:r.items.sort((a,b)=>a.x-b.x).map(i=>i.text).join(' ')}));
}
function cellsFor(row,centers) {
  const cells=centers.map(()=>[]);
  for(const item of row.items){let col=0;while(col<centers.length-1&&item.center>(centers[col]+centers[col+1])/2)col++;cells[col].push(item.text);}
  return cells.map(x=>x.join(' ').trim());
}
// Short right-aligned remainders may cross the midpoint between header labels.
// Recover only from painted cell borders; never replace an absent value with zero.
function terminalCells(row,centers,rules,cells){
  if(cells[13]||!Array.isArray(rules))return cells;
  const vertical=rules.filter(r=>Math.abs(r.x1-r.x2)<.05&&Math.min(r.y1,r.y2)<row.y&&Math.max(r.y1,r.y2)>row.y).map(r=>r.x1);
  const left=Math.max(...vertical.filter(x=>x<centers[13])),right=Math.min(...vertical.filter(x=>x>centers[13]));
  if(!(left>centers[12]&&right<centers[14]))return cells;
  const inside=row.items.filter(i=>i.x>left&&2*i.center-i.x<right);
  const outside=row.items.filter(i=>i.x>=right);
  if(inside.length!==1||!inch.test(inside[0].text)||outside.length!==1||!['Cortar','Almac.'].includes(outside[0].text))return cells;
  const result=[...cells];result[13]=inside[0].text;result[14]=outside[0].text;return result;
}
function count(map,key,quantity){map.set(key,(map.get(key)||0)+quantity);}
function equals(a,b){return a.size===b.size&&[...a].every(([k,v])=>b.get(k)===v);}
export function extractCoordinatePlans(pages) {
  if(!Array.isArray(pages)||pages.length>500)throw Error('PDF fuera del límite de 500 páginas');
  const plans=[],issues=[],projectRows=[],summaryRows=[],profileSummaries=[];let expandedTotal=0,lastPage=null,totalItems=0;
  let documentId='',canonicalDocumentId='',mode='',ref='',finish='',block=null,current=null,centers=null,projectCenters=null,summaryCenters=null;const knownReferences=new Set();let sourceSettings={};
  let previousPage=null;const handledProjectCells=new Set();
  const issue=(code,page,detail='')=>issues.push({code,page,reference:ref,detail});
  for(const page of pages){
    if(page.rotation&&page.rotation%360!==0)throw Error('PDF rotado: requiere revisión manual');
    if(!Array.isArray(page.items)||page.items.length>100000||(totalItems+=page.items.length)>500000)throw Error('Página fuera del límite de lectura');
    if(lastPage && (page.page!==lastPage.page+1 || Math.abs(page.width-lastPage.width)>1)){issue('PAGE_CONTEXT_CHANGED',page.page);if(current)current.issues.push('PAGE_CONTEXT_CHANGED');mode='';current=null;block=null;}
    previousPage=lastPage;lastPage=page;
    const rows=coordinateRows(page.items);
    // Only discard wrapped header text when the complete title is independently
    // printed in project metadata. Never suppress arbitrary top-of-page content.
    const metadata=rows.find(r=>/^Nombre del proyecto:\s*\S/.test(r.text));
    if(metadata)canonicalDocumentId=metadata.text.replace(/^Nombre del proyecto:\s*/, '').trim();
    const headerContinuations=new Set();
    for(const [index,r] of rows.entries()){
      const h=r.text.match(/^Optimizador de corte\s*-\s*(.+)$/);
      if(!h||!canonicalDocumentId.startsWith(h[1].trim()))continue;
      // PDF line wrapping drops the separator whitespace at the next baseline.
      // Compare only that known metadata suffix; never discard arbitrary text.
      const suffix=canonicalDocumentId.slice(h[1].trim().length).trim(),next=rows[index+1];
      if(suffix&&next&&next.text===suffix&&next.items.length===1&&
         r.y-next.y>0&&r.y-next.y<=25&&Math.abs(next.items[0].x-r.items[0].x)<2)headerContinuations.add(next);
    }
    for(const [rowIndex,row] of rows.entries()){
      if(headerContinuations.has(row))continue;
      const text=row.text;
      const documentHeader=text.match(/^Optimizador de corte\s*-\s*(.+)$/);if(documentHeader){const partial=documentHeader[1].trim();documentId=canonicalDocumentId.startsWith(partial)?canonicalDocumentId:partial;}
      if(documentId&&text===documentId)continue;
      if(row.y<20 || /^(?:Optimizador de corte|Creado\b|Actualizado\b|\(c\) \d{4})/.test(text))continue;
      // Numeric-leading profiles require an exact prior Pipe entry. Do not
      // interpret arbitrary numeric project rows as profile headings.
      const numericCandidate=text.match(/^(\d+[A-Z][A-Z0-9]*-[A-Z0-9-]+)\s+(.+)$/);
      const candidate=text.match(/^([A-Z][A-Z0-9-]*\d[A-Z0-9-]*)\s+(.+)$/)
        || (numericCandidate&&knownReferences.has(numericCandidate[1])?numericCandidate:null);
      const title=candidate&&(!knownReferences.size||knownReferences.has(candidate[1]))?candidate:null;
      if(title){sourceSettings={};ref=title[1];finish=title[2];mode='';current=null;block=null;continue;}
      for(const [key,label] of [['kerf','Espesor de la sierra'],['leftTrim','Corte izquierdo inutilizable'],['rightTrim','Corte derecho inutilizable'],['minimumReusable','Longitud mínima reutilizable']]){
        const match=text.match(new RegExp(label+':\\s*(\\d+(?:\\s+\\d+/\\d+)?")'));if(match){sourceSettings[key]=match[1];sourceSettings[key+'Page']=page.page;}
      }
      const totals=text.match(/Longitud de los cortes:\s*([^,]+),\s*Longitud de los perfiles usados:\s*([^,]+),\s*Length of reused stubs:\s*([^,]+),\s*Longitud del desperdicio:\s*(.+)$/);
      if(totals&&ref)profileSummaries.push({ref,finish,page:page.page,cutLength:totals[1],stockLength:totals[2],reusedLength:totals[3],wasteLength:totals[4],
        bars:null,pieces:null,plans:null,scrapPercentagePrinted:null,countsPage:null,countsSourceText:null});
      // Counts are printed documentary facts, never reconstructed from patterns.
      // Bind only the immediately adjacent summary line in the same profile/page.
      const printedCounts=text.match(/^Yield:\s*\d+(?:\.\d+)?%,\s*Reused:\s*\d+(?:\.\d+)?%,\s*Waste:\s*(\d+(?:\.\d+)?%)\s+Número de items cortados:\s*(\d+),\s*Número de perfiles usados:\s*(\d+),\s*Número planos de corte:\s*(\d+)$/);
      if(printedCounts){
        const summary=profileSummaries.at(-1),previous=rows[rowIndex-1];
        const quantities=printedCounts.slice(2).map(Number);
        const samePage=summary?.page===page.page&&previous&&/^Longitud de los cortes:/.test(previous.text)&&previous.y-row.y>0&&previous.y-row.y<=25;
        const isFurniture=r=>r.y<20||/^(?:Optimizador de corte|Creado\b|Actualizado\b|\(c\) \d{4})/.test(r.text);
        const previousContent=previousPage?coordinateRows(previousPage.items).filter(r=>!isFurniture(r)):[];
        const lastContent=previousContent.at(-1);
        const continuedPage=summary?.page===page.page-1&&previousPage?.page===page.page-1&&
          previousPage.width===page.width&&previousPage.height===page.height&&canonicalDocumentId&&documentId===canonicalDocumentId&&
          lastContent&&/^Longitud de los cortes:/.test(lastContent.text)&&lastContent.y<60&&row.y>page.height-80&&
          rows.slice(0,rowIndex).every(r=>isFurniture(r)||headerContinuations.has(r));
        if(summary&&summary.ref===ref&&summary.finish===finish&&(samePage||continuedPage)&&summary.countsPage===null&&
           quantities.every(n=>Number.isSafeInteger(n)&&n>=0)&&Number(printedCounts[1].slice(0,-1))<=100){
          Object.assign(summary,{pieces:quantities[0],bars:quantities[1],plans:quantities[2],
            scrapPercentagePrinted:printedCounts[1],countsPage:page.page,countsSourceText:text});
        }
      }
      const bar=text.match(/Longitud del perfil:\s*([^,]+),\s*Perfiles usados:\s*(\d+)/i);
      if(bar){block={length:bar[1].trim(),declared:Number(bar[2]),location:text.match(/UBICACION:\s*(\S+)/i)?.[1]||'',code:text.match(/CODIGO:\s*(\S+)/i)?.[1]||''};mode='';current=null;continue;}
      if(row.items.some(i=>i.text==='#perf')){
        const header=row.items.filter(i=>['#perf','Long.','Referencia','Cant.','Rest','Disp.'].includes(i.text));
        if(header.length!==15 || header.filter(i=>i.text==='Long.').length!==4){issue('UNSUPPORTED_COLUMNS',page.page);mode='';continue;}
        centers=header.map(i=>i.center);mode='patterns';continue;
      }
      if(row.items.some(i=>i.text==='Pipe')&&row.items.some(i=>i.text==='Qty')){
        projectCenters=row.items.filter(i=>['Item','Pipe','Code','Length','Reference','Qty'].includes(i.text)).map(i=>i.center);
        mode=projectCenters.length===6?'project':'';continue;
      }
      if(row.items.some(i=>i.text==='UBICACION')&&row.items.some(i=>i.text==='Qty')){
        summaryCenters=row.items.filter(i=>['Item','Referencia','CODE','Longitud','Qty','UBICACION','CODIGO','OBSERVACION'].includes(i.text)).map(i=>i.center);
        mode=summaryCenters.length===8?'summary':'';continue;
      }
      if(/^(?:Project data:|Requerimientos de material:|Material requirements:|Resumen|Sobrantes|Item\s)/i.test(text)){mode='';continue;}
      if(mode==='project'){
        const c=cellsFor(row,projectCenters),lengthIndex=row.items.findIndex(i=>inch.test(i.text));
        const continuationCell=projectCell(page.rules,projectCenters,row.y);
        if(continuationCell){
          const cellKey=`${page.page}:${continuationCell.top}:${continuationCell.bottom}`;
          const inside=rows.filter(r=>r.y>continuationCell.bottom&&r.y<continuationCell.top);
          const anchors=inside.filter(r=>/^\d+$/.test(cellsFor(r,projectCenters)[0]));
          if(!anchors.length){
            if(handledProjectCells.has(cellKey))continue;
            handledProjectCells.add(cellKey);
            const prior=projectRows.at(-1),priorCell=prior?.sourceCell;
            const following=rows.find(r=>r.y<continuationCell.bottom&&/^\d+$/.test(cellsFor(r,projectCenters)[0]));
            const nextCells=following?cellsFor(following,projectCenters):null;
            const sameHeader=rows.some(r=>r.text===`Optimizador de corte - ${documentId}`);
            const onlyReference=inside.every(r=>r.items.every(i=>i.x>continuationCell.left&&i.center<continuationCell.right));
            const firstCell=!rows.some(r=>r.y>continuationCell.top&&projectCell(page.rules,projectCenters,r.y));
            if(prior&&prior.grouping==='PRINTED_CELL'&&previousPage&&page.page===previousPage.page+1&&prior.page===previousPage.page&&
              page.width===previousPage.width&&page.height===previousPage.height&&sameHeader&&documentId&&prior.sourceDocumentId===documentId&&onlyReference&&firstCell&&
              priorCell&&priorCell.bottom<60&&continuationCell.top>page.height-80&&
              Math.abs(priorCell.left-continuationCell.left)<.5&&Math.abs(priorCell.right-continuationCell.right)<.5&&
              nextCells&&Number(nextCells[0])===Number(prior.sourceId.match(/item(\d+)$/)?.[1])+1){
              prior.reference+=' '+inside.flatMap(r=>r.items.map(i=>i.text)).join(' ');
              prior.sourceContinuations=[...(prior.sourceContinuations||[]),{page:page.page,sourceCell:continuationCell,text:inside.flatMap(r=>r.items.map(i=>i.text)).join(' ')}];
            }else issues.push({code:'ORPHAN_PROJECT_CONTINUATION',page:page.page,reference:prior?.ref||''});
            continue;
          }
        }
        if(c[1]&&/^\d+$/.test(c[0]))knownReferences.add(c[1]);
        if(/^\d+$/.test(c[0])&&c[1]&&lengthIndex>=0&&/^\d+$/.test(c[5])){
          const cell=projectCell(page.rules,projectCenters,row.y);
          let reference='',grouping='BASELINE_ONLY';
          if(cell){
            const inside=rows.filter(r=>r.y>cell.bottom&&r.y<cell.top);
            const anchors=inside.filter(r=>/^\d+$/.test(cellsFor(r,projectCenters)[0]));
            if(anchors.length===1){reference=inside.flatMap(r=>r.items.filter(i=>i.x>cell.left&&i.center<cell.right)).map(i=>i.text).join(' ');grouping='PRINTED_CELL';}
            else issues.push({code:'AMBIGUOUS_PROJECT_CELL',page:page.page,reference:c[1]});
          }else{
            reference=row.items.slice(lengthIndex+1).filter(i=>i.center<(projectCenters[4]+projectCenters[5])/2).map(i=>i.text).join(' ');
          }
          projectRows.push({sourceId:`project-p${page.page}-item${c[0]}`,sourceDocumentId:documentId,ref:c[1],finish:c[2],length:row.items[lengthIndex].text,quantity:Number(c[5]),reference,page:page.page,grouping,sourceCell:cell});
        }else if(/^\d+$/.test(c[0]))issues.push({code:'INCOMPLETE_PROJECT_ROW',page:page.page,reference:c[1]});
        else if(!projectCell(page.rules,projectCenters,row.y))issues.push({code:'UNASSIGNED_PROJECT_TEXT',page:page.page,reference:''});
        continue;
      }
      if(mode==='summary'){
        const c=cellsFor(row,summaryCenters);
        if(/^\d+$/.test(c[0])&&c[1]&&inch.test(c[3])&&/^\d+$/.test(c[4]))summaryRows.push({ref:c[1],finish:c[2],length:c[3],quantity:Number(c[4]),location:c[5],code:c[6],observation:c[7],page:page.page});
        else if(/^\d+$/.test(c[0]))issues.push({code:'INCOMPLETE_SUMMARY_ROW',page:page.page,reference:c[1]});
        continue;
      }
      if(mode!=='patterns'||!centers)continue;
      const c=terminalCells(row,centers,page.rules,cellsFor(row,centers));
      if(/^\d+$/.test(c[0])){
        const perf=Number(c[0]);
        if(!ref||!block||!Number.isSafeInteger(perf)||perf<1||perf>10000){issue('PATTERN_WITHOUT_CONTEXT',page.page);current=null;continue;}
        current={id:`pdf-p${page.page}-r${rowIndex}`,ref,finish,length:block.length,barqty:perf,code:block.code,location:block.location,page:page.page,sourcePages:[page.page],sourceRow:rowIndex+1,sourceSettings:{...sourceSettings},cells:[[],[],[],[]],rest:c[13],restDisposition:c[14],issues:[]};plans.push(current);
      }else if(c[0]){issue('UNCLASSIFIED_ROW',page.page);if(current)current.issues.push('UNCLASSIFIED_ROW');continue;}
      if(!current){if(c.slice(1,13).some(Boolean))issue('ORPHAN_CONTINUATION',page.page);continue;}
      if(!current.sourcePages.includes(page.page))current.sourcePages.push(page.page);
      for(let group=0;group<4;group++){
        const offset=1+3*group,length=c[offset],reference=c[offset+1],quantity=c[offset+2],cuts=current.cells[group];
        if(length){
          if(!inch.test(length)||thirtySeconds(length)===null||!/^\d+$/.test(quantity)||Number(quantity)<1||Number(quantity)>10000){current.issues.push('INCOMPLETE_CUT');issue('INCOMPLETE_CUT',page.page,`column ${group+1}`);cuts.push({length,project:reference,quantity:null,page:page.page,column:group+1});continue;}
          cuts.push({length,project:reference,quantity:Number(quantity),page:page.page,column:group+1});
        }else if(reference){
          if(cuts.length)cuts.at(-1).project+=' '+reference;
          else {current.issues.push('ORPHAN_REFERENCE');issue('ORPHAN_REFERENCE',page.page,`column ${group+1}`);}
        }
        if(!length&&quantity){current.issues.push('ORPHAN_QUANTITY');issue('ORPHAN_QUANTITY',page.page);}
      }
    }
  }
  for(const plan of plans){
    plan.cuts=[];plan.unresolvedCells=[];
    for(const cell of plan.cells)for(const [slotIndex,cut] of cell.entries()){
      if(cut.quantity===null){plan.unresolvedCells.push({...cut});continue;}
      if(!cut.project){plan.issues.push('MISSING_REFERENCE');issues.push({code:'MISSING_REFERENCE',page:cut.page,reference:plan.ref});}
      const total=plan.barqty*cut.quantity;
      if(total>10000||plan.cuts.length+total>20000||expandedTotal+total>100000){plan.issues.push('EXPANSION_LIMIT');issues.push({code:'EXPANSION_LIMIT',page:cut.page,reference:plan.ref});continue;}
      expandedTotal+=total;
      for(let n=0;n<total;n++)plan.cuts.push({length:cut.length,project:cut.project,qty:1,sourceRow:plan.sourceRow,sourcePage:cut.page,sourceColumn:cut.column,sourceSlot:slotIndex+1,profileInstance:Math.floor(n/cut.quantity)+1,unitInstance:n%cut.quantity+1,rest:plan.rest,uncertain:plan.issues.length>0||!cut.project});
    }
    if(plan.issues.length)for(const cut of plan.cuts)cut.uncertain=true;
    delete plan.cells;plan.extractionStatus='PROVISIONAL';
  }
  const reconciliation=[];
  for(const key of new Set([...plans,...projectRows,...summaryRows].map(p=>JSON.stringify([p.ref,p.finish])))){
    const [reference,finish]=JSON.parse(key),matches=p=>p.ref===reference&&p.finish===finish;
    const own=plans.filter(matches),expectedCuts=projectRows.filter(matches),expectedBars=summaryRows.filter(matches);
    const lengths=new Map(),printedLengths=new Map(),bars=new Map(),printedBars=new Map(),refs=new Map(),printedRefs=new Map();
    for(const p of own){count(bars,JSON.stringify([thirtySeconds(p.length),p.code]),p.barqty);for(const c of p.cuts){count(lengths,thirtySeconds(c.length),1);count(refs,JSON.stringify([thirtySeconds(c.length),norm(c.project)]),1);}}
    for(const p of expectedCuts){count(printedLengths,thirtySeconds(p.length),p.quantity);count(printedRefs,JSON.stringify([thirtySeconds(p.length),norm(p.reference)]),p.quantity);}
    for(const p of expectedBars)count(printedBars,JSON.stringify([thirtySeconds(p.length),p.code]),p.quantity);
    reconciliation.push({reference,finish,bars:own.reduce((n,p)=>n+p.barqty,0),cuts:own.reduce((n,p)=>n+p.cuts.length,0),printedBars:expectedBars.length?expectedBars.reduce((n,p)=>n+p.quantity,0):null,printedCuts:expectedCuts.length?expectedCuts.reduce((n,p)=>n+p.quantity,0):null,
      barLengthsMatch:expectedBars.length?equals(bars,printedBars):null,cutLengthsMatch:expectedCuts.length?equals(lengths,printedLengths):null,referenceGroupsMatch:expectedCuts.length?equals(refs,printedRefs):null,
      incomplete:own.some(p=>p.issues.length>0)||issues.some(i=>i.reference===reference),status:'PROVISIONAL',productionEnabled:false});
  }
  const individualCoverage=reconcileIndividuals({plans,projectRows,profileSummaries});
  return {plans,issues,reconciliation,individualCoverage,sourceProjectRows:projectRows,
    sourceMaterialRows:summaryRows,sourceProfileSummaries:profileSummaries,
    pdfPages:pages.length,productionEnabled:false};
}
