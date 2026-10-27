/** TEST-ONLY pg-compatible client using local docker/psql persistent sessions.
 * Production must inject a maintained bound-parameter PG driver/pool instead.
 */
import {spawn} from 'node:child_process';
export function connectPsql(database){
 const child=spawn('docker',['exec','-i','sgp-pdt-qa-91','psql','-X','-qAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=0'],{stdio:['pipe','pipe','pipe']});
 let pending=null,buffer='',errors='',n=0;
 child.stderr.on('data',d=>{errors+=d.toString();});
 child.stdout.on('data',d=>{
  buffer+=d.toString();let idx;
  while((idx=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,idx).replace(/\r$/,'');buffer=buffer.slice(idx+1);if(!pending)continue;
   if(line.startsWith('__B2_STATUS__'))pending.status=line;
   else if(line===pending.marker){const p=pending;pending=null;if(!p.status?.includes(' false 00000'))p.reject(Object.assign(new Error(errors||p.status||'PG failure'),{code:'PG_TEST_ERROR'}));else p.resolve({rows:p.rows});}
   else if(line.trim()){try{pending.rows.push({data:JSON.parse(line)});}catch{/* command notices are not evidence */}}
  }
 });
 child.on('error',e=>{pending?.reject(e);pending=null;});child.on('exit',()=>{pending?.reject(new Error('PG test process exited'));pending=null;});
 return {query(sql,values=[]){if(pending)throw new Error('ONE_QUERY_PER_SESSION');
  const literal=v=>v===null||v===undefined?'NULL':typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'";
  const bound=sql.replace(/\$(\d+)/g,(_,i)=>literal(values[Number(i)-1]));
  return new Promise((resolve,reject)=>{errors='';pending={marker:'__B2_END_'+ ++n,rows:[],resolve,reject};child.stdin.write(bound.replace(/;\s*$/,'')+';\n\\echo __B2_STATUS__ :ERROR :SQLSTATE\n\\echo '+pending.marker+'\n');});
 },release(){child.stdin.end('\\q\n');}};
}
