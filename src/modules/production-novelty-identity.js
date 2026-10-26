import {validatedNoveltySource} from '../domain/pdt-piece-identity.js';

export function attachNoveltyIdentity({root,client,token,production,onIdentity=()=>{}}){
 const field=id=>root.querySelector('#'+id);
 const profile=field('prodNoveltyProfile'),reserve=field('prodNoveltyReserve'),finish=field('prodNoveltyFinish'),length=field('prodNoveltyLength');
 const select=field('prodNoveltyPiece'),status=field('prodNoveltyIdentityStatus'),line=field('prodNoveltyLine'),save=field('prodNoveltySave');
 let rows=[],selected=null,sequence=0,timer,saving=false;
 const disableSave=invalid=>{save.disabled=saving||invalid;};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const clear=()=>{length.readOnly=false;selected=null;onIdentity(null);select.innerHTML='<option value="">Selecciona una pieza de origen</option>';line.textContent='Línea sin verificar';};
 async function refresh(){
  const request=++sequence;clear();rows=[];
  const code=profile.value.trim();
  if(!code){status.textContent='Sin PDT de aluminio: puedes registrar una novedad sin perfil.';select.disabled=true;disableSave(false);return;}
  disableSave(true);select.disabled=true;status.textContent='Consultando clasificación y origen verificable…';
  try{
   const {data,error}=await client.rpc('sgp_pdt_origenes_novedad_v3',{p_token:token,p_reserva:reserve.value,p_buscar:code,p_produccion:production||null,p_acabado:finish.value||null});
   if(request!==sequence)return;
   if(error)throw new Error(error.code==='PGRST202'?'El servidor aún no tiene el contrato de identidad segura. No se guardará un PDT por la ruta antigua.':error.message);
   if(!Array.isArray(data)||data.length>100)throw new Error('Demasiados orígenes o respuesta no verificable. Precisa el código SAP.');
   rows=data;
   if(!rows.length)throw new Error('No hay pieza activa y clasificada para esta reserva, producción y acabado. Revisa el maestro o selecciona otro perfil.');
   if(new Set(rows.map(x=>x.id_pieza+'|'+x.key_produccion)).size!==rows.length)throw new Error('Identidades de origen ambiguas. No se puede guardar.');
   select.innerHTML='<option value="">Selecciona una pieza de origen</option>'+rows.map((x,i)=>'<option value="'+i+'">'+esc(x.tipo_pieza)+' → '+esc(x.id_linea)+' · '+esc(x.produccion)+' · '+esc(x.fabricacion)+' · '+esc(x.longitud)+' · '+esc(x.acabado)+' · '+esc(String(x.id_pieza).split(':').slice(-2).join(':'))+'</option>').join('');
   field('prodProfileCatalog').innerHTML=[...new Set(rows.map(x=>x.codigo_sap))].map(x=>'<option value="'+esc(x)+'"></option>').join('');
   select.disabled=false;status.textContent='Selecciona explícitamente una pieza. La línea procede del maestro; el nombre de producción no decide la asociación.';
  }catch(error){if(request===sequence){status.textContent=error.message;disableSave(true);select.disabled=true;}}
 }
 select.onchange=()=>{
  try{
   selected=rows[Number(select.value)];if(select.value===''||!selected)throw new Error('Selecciona una pieza real.');
   profile.value=selected.codigo_sap;length.value=selected.longitud??'';length.readOnly=true;
   validatedNoveltySource(selected,{perfil:profile.value,reserva:reserve.value,acabado:finish.value,produccion:production});
   line.textContent=selected.tipo_pieza+' → '+selected.id_linea+' · '+selected.key_produccion;
   status.textContent='Identidad verificada. El servidor volverá a comprobarla al guardar.';disableSave(false);onIdentity(selected);
  }catch(error){selected=null;onIdentity(null);line.textContent='Línea sin verificar';status.textContent=error.message;disableSave(true);}
 };
 const invalidate=()=>{++sequence;clear();disableSave(!!profile.value.trim());clearTimeout(timer);timer=setTimeout(refresh,180);};
 profile.oninput=invalidate;profile.onchange=refresh;
 reserve.onchange=()=>{finish.value=reserve.selectedOptions[0]?.dataset.finish||'';finish.readOnly=!!finish.value;refresh();};
 finish.oninput=invalidate;
 field('prodNoveltyIdentityRetry').onclick=refresh;
 return {refresh,setSaving(value){saving=value;disableSave(!!profile.value.trim()&&!selected);},getIdentity(){
  if(!profile.value.trim())return null;
  const source=validatedNoveltySource(selected,{perfil:profile.value,reserva:reserve.value,acabado:finish.value,produccion:production});
  if(Number(length.value)!==Number(source.longitud))throw new Error('La longitud no corresponde a la pieza seleccionada.');
  return source;
 },dispose(){++sequence;clearTimeout(timer);}};
}
