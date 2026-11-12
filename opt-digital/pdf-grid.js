// Recover painted, axis-aligned PDF rules in page coordinates. Clipping paths do
// not count as printed cell boundaries. Unsupported curves never become rules.
export function paintedRules(list, ops) {
  const rules=[],stack=[];let matrix=[1,0,0,1,0,0],path=[];
  const point=(x,y)=>[matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]];
  const segment=(a,b)=>{if([...a,...b].every(Number.isFinite)&&(Math.abs(a[0]-b[0])<.05||Math.abs(a[1]-b[1])<.05))path.push({x1:a[0],y1:a[1],x2:b[0],y2:b[1]});};
  if(list.fnArray.length>500000)throw Error('PDF excede límite de operaciones gráficas');
  for(let n=0;n<list.fnArray.length;n++){
    const op=list.fnArray[n],args=list.argsArray[n];
    if(op===ops.save)stack.push([...matrix]);
    else if(op===ops.restore){if(!stack.length)throw Error('Estado gráfico PDF incompleto');matrix=stack.pop();}
    else if(op===ops.transform){const [a,b,c,d,e,f]=args,[g,h,i,j,k,l]=matrix;matrix=[g*a+i*b,h*a+j*b,g*c+i*d,h*c+j*d,g*e+i*f+k,h*e+j*f+l];}
    else if(op===ops.constructPath){
      const [commands,coords]=args;let k=0,last=null,first=null;
      for(const command of commands){
        if(command===ops.moveTo){last=point(coords[k++],coords[k++]);first=last;}
        else if(command===ops.lineTo){const next=point(coords[k++],coords[k++]);if(last)segment(last,next);last=next;}
        else if(command===ops.rectangle){const x=coords[k++],y=coords[k++],w=coords[k++],h=coords[k++],p=[point(x,y),point(x+w,y),point(x+w,y+h),point(x,y+h)];for(let i=0;i<4;i++)segment(p[i],p[(i+1)%4]);last=p[0];first=last;}
        else if(command===ops.closePath){if(last&&first)segment(last,first);last=first;}
        else {k+=command===ops.curveTo?6:command===ops.curveTo2||command===ops.curveTo3?4:coords.length;last=null;}
      }
    }else if([ops.stroke,ops.closeStroke,ops.fillStroke,ops.eoFillStroke,ops.closeFillStroke,ops.closeEOFillStroke].includes(op)){rules.push(...path);path=[];}
    else if([ops.endPath,ops.fill,ops.eoFill].includes(op))path=[];
    if(rules.length>100000)throw Error('PDF excede límite de líneas');
  }
  return rules;
}
export function projectCell(rules, centers, y) {
  if(!Array.isArray(rules)||!rules.length)return null;
  const horizontal=rules.filter(r=>Math.abs(r.y1-r.y2)<.05&&Math.min(r.x1,r.x2)<=centers[0]&&Math.max(r.x1,r.x2)>=centers[5]);
  const above=horizontal.map(r=>r.y1).filter(v=>v>y+.1),below=horizontal.map(r=>r.y1).filter(v=>v<y-.1);
  if(!above.length||!below.length)return null;
  const top=Math.min(...above),bottom=Math.max(...below);
  const vertical=rules.filter(r=>Math.abs(r.x1-r.x2)<.05&&Math.min(r.y1,r.y2)<=bottom+.5&&Math.max(r.y1,r.y2)>=top-.5).map(r=>r.x1);
  const lefts=vertical.filter(x=>x<centers[4]),rights=vertical.filter(x=>x>centers[4]);
  if(!lefts.length||!rights.length)return null;
  const left=Math.max(...lefts),right=Math.min(...rights);
  if(left<=centers[3]||right>=centers[5])return null;
  return {top,bottom,left,right};
}
