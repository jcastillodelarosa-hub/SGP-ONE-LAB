import {coordinateRows} from './geometric-extraction.js';
import {buildOptProjectData} from '../src/domain/opt-project-data.js';
// Separate read-only metadata extraction. Never changes plans or cut identities.
export function extractOptProjectData(pages, sourceRows) {
 if(!Array.isArray(pages)||!Array.isArray(sourceRows))throw Error('OPT_PROJECT_DATA_SOURCE');
 const byPage=new Map(pages.map(p=>[p.page,p]));
 const rows=sourceRows.map(source=>{
  const page=byPage.get(source.page),cell=source.sourceCell;
  if(!page||source.grouping!=='PRINTED_CELL'||!cell)throw Error('OPT_PROJECT_DATA_CELL');
  const vertical=(page.rules||[]).filter(r=>Math.abs(r.x1-r.x2)<.05&&Math.min(r.y1,r.y2)<=cell.bottom+.5&&Math.max(r.y1,r.y2)>=cell.top-.5).map(r=>r.x1).sort((a,b)=>a-b);
  const boundaries=vertical.filter((x,i)=>i===0||x-vertical[i-1]>.5);
  // Full row has six ruled columns; the stored reference cell is column 5.
  const refIndex=boundaries.findIndex(x=>Math.abs(x-cell.left)<.5);
  if(refIndex!==4||boundaries.length!==7||Math.abs(boundaries[5]-cell.right)>.5)throw Error('OPT_PROJECT_DATA_BOUNDARIES');
  const inside=coordinateRows(page.items).filter(r=>r.y>cell.bottom&&r.y<cell.top);
  const cells=boundaries.slice(0,-1).map((left,index)=>inside.flatMap(r=>r.items.filter(i=>i.x>left&&i.center<boundaries[index+1])).map(i=>i.text).join(' ').trim());
  const item=Number(source.sourceId.match(/item(\d+)$/)?.[1]);
  if(cells[0]!==String(item)||cells[1]!==source.ref||cells[3]!==source.length||cells[5]!==String(source.quantity))throw Error('OPT_PROJECT_DATA_ANCHOR');
  if(!cells[2]||!cells[4])throw Error('OPT_PROJECT_DATA_INCOMPLETE');
  // Cross-page continuations were independently verified by the source extractor.
  const reference=cells[4]+(source.sourceContinuations||[]).map(c=>' '+c.text).join('');
  if(reference!==source.reference)throw Error('OPT_PROJECT_DATA_REFERENCE');
  return {...source,finish:cells[2],reference};
 });
 return buildOptProjectData(rows);
}
