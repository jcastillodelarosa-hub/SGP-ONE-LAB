/** In-memory editor state. A response must acknowledge the exact command before
 * success; uncertain writes retain their UUID and payload until explicitly retried.
 * No local persistence of user notes or session tokens.
 */
export function orderNoteEditor(transport,{uuid=()=>crypto.randomUUID()}={}) {
 const state={snapshot:null,draft:'',draftRevision:null,dirty:false,busy:false,pending:null,status:'UNAVAILABLE',error:null};
 const authorized=()=>{if(!transport.isCurrent()){state.snapshot=null;state.draft='';state.draftRevision=null;state.pending=null;state.dirty=false;state.status='UNAVAILABLE';throw Error('NO_AUTORIZADO');}};
 return {state,
  // Deliberately discard the draft before starting again from the latest snapshot.
  discardDraft(){authorized();if(state.busy||state.pending)throw Error('ORDER_NOTE_PENDING');if(!state.snapshot)throw Error('ORDER_NOTE_DISABLED');state.draft=state.snapshot.note.observation;state.draftRevision=state.snapshot.note.revision;state.dirty=false;},
  edit(text){authorized();if(state.busy||state.pending)throw Error('ORDER_NOTE_PENDING');if(!state.dirty)state.draftRevision=state.snapshot?.note.revision??null;state.draft=text;state.dirty=text!==state.snapshot?.note.observation;if(!state.dirty)state.draftRevision=state.snapshot?.note.revision??null;},
  async load(){
   authorized();if(state.busy||state.pending)throw Error('ORDER_NOTE_PENDING');state.busy=true;
   try{const d=await transport.read();authorized();state.snapshot=d;if(!state.dirty){state.draft=d.note.observation;state.draftRevision=d.note.revision;}state.status='READY';state.error=null;return d;}
   catch(e){state.status='UNAVAILABLE';state.error=e.message;if(e.message==='NO_AUTORIZADO'){state.snapshot=null;state.draft='';state.draftRevision=null;state.dirty=false;}throw e;}finally{state.busy=false;}
  },
  async save(){
   authorized();if(state.busy)throw Error('ORDER_NOTE_BUSY');
   if(!state.pending){if(state.status!=='READY'||!state.snapshot?.capabilities.includes('NOTE'))throw Error('ORDER_NOTE_DISABLED');state.pending={id:uuid(),revision:state.draftRevision,observation:state.draft};}
   state.busy=true;
   try{const result=await transport.save(state.pending);authorized();state.pending=null;state.dirty=false;state.draftRevision=result.revision;state.status='SAVED';state.error=null;
    // Keep the acknowledged revision even if a subsequent refresh fails.
    state.snapshot={...state.snapshot,note:{...state.snapshot.note,revision:result.revision,observation:result.observation}};
    return result;
   }catch(e){state.error=e.message;if(e.confirmedRejected){state.pending=null;state.status='RELOAD_REQUIRED';}else state.status='UNCERTAIN';if(e.message==='NO_AUTORIZADO'){state.snapshot=null;state.draft='';state.draftRevision=null;state.pending=null;state.dirty=false;state.status='UNAVAILABLE';}throw e;}
   finally{state.busy=false;}
  }
 };
}
