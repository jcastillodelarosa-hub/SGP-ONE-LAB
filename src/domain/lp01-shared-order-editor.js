/** Request identity survives an uncertain response; shared CAS never silently rebases a draft. */
export function sharedOrderEditor(transport,{uuid=()=>crypto.randomUUID()}={}){
 let snapshot=null,draft=null,baseRevision=null,pending=null,busy=false,confirmed=false;
 return {
  get state(){return {snapshot,draft:draft&&{...draft},baseRevision,busy,confirmed,uncertain:Boolean(pending)&&!confirmed};},
  async refresh(){snapshot=await transport.read();return snapshot;},
  edit(value){if(busy)throw Error('SHARED_BUSY');if(pending&&!confirmed)throw Error('SHARED_RETRY_REQUIRED');if(!draft)baseRevision=snapshot?.revision;draft={...value};pending=null;confirmed=false;},
  discard(){if(busy||pending&&!confirmed)throw Error('SHARED_RETRY_REQUIRED');draft=null;baseRevision=null;pending=null;confirmed=false;},
  async save(){
   if(busy||!draft||!Number.isSafeInteger(baseRevision))throw Error('SHARED_DRAFT_REQUIRED');
   if(!snapshot?.canReport)throw Error('NO_AUTORIZADO');
   if(!pending)pending={...draft,id:uuid(),revision:baseRevision};busy=true;
   try{const result=await transport.command(pending);confirmed=true;draft=null;baseRevision=null;pending=null;return result;}
   catch(e){if(e.confirmedRejected){pending=null;confirmed=false;}throw e;}
   finally{busy=false;}
  }
 };
}
