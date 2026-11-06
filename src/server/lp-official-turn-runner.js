/** Inject only an approved server-side RPC client and approved SGP identity.
 * No scheduler, credential provisioning or browser binding is created here. */
export async function openDueOfficialTurns({rpc,token,scopes}){
 if(!token||!Array.isArray(scopes)||scopes.length>4)throw Error('AUTOMATIC_RUNNER_CONFIG_REQUIRED');
 const seen=new Set(),results=[];
 for(const {stage,line} of scopes){
  const key=stage+'/'+line;
  if(!['ENSAMBLE','EMPAQUE'].includes(stage)||!['PANELES_2','FRAMES_2'].includes(line)||seen.has(key))throw Error('AUTOMATIC_SCOPE_INVALID');seen.add(key);
 }
 for(const {stage,line} of scopes){
  const {data,error}=await rpc('sgp_lp_official_open_due_v1',{p_token:token,p_stage:stage,p_line:line});
  if(error){results.push({stage,line,status:'BLOCKED',reason:error.message});continue;}
  if(!['OPENED','EXISTS','WAITING_SCHEDULE'].includes(data?.status))throw Error('AUTOMATIC_RESPONSE_UNCONFIRMED');
  results.push({stage,line,...data});
 }
 return results;
}
