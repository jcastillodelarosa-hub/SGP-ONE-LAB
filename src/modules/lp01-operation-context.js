/** Scope adapter only: the shared component owns notes, tabs and affectation writes. */
export async function mountOperationOrderContext({host,row,scope,bridge,isCurrent,mount}){
 const token=bridge.getToken(),key=row.key,context={...scope};
 const alive=()=>host.isConnected&&token===bridge.getToken()&&isCurrent({key,...context});
 if(!token||!alive())return false;
 const client=await bridge.getClient();
 if(!alive())return false;
 await mount({host,row,target:null,scope:context,client,getToken:()=>alive()?token:null,isCurrent:alive});
 return alive();
}
