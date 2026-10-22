import {groupMissingPieceCodes,validateMasterRecord,PIECE_TYPES,PIECE_DESTINATIONS,PIECE_LINES,listPieceMaster,savePieceMaster} from "../services/piece-master-admin.js";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const options=(items,current="")=>items.map(v=>`<option value="${esc(v)}" ${v===current?"selected":""}>${esc(v)}</option>`).join("");
let missing=[];
export function initPieceMasterUI(){
 const mount=document.querySelector('[data-view-panel="configuracion"]');
 if(!mount||document.getElementById("pieceMasterDialog"))return;
 const tabbar=mount.querySelector(".config-tabs");
 if(tabbar){const b=document.createElement("button");b.type="button";b.dataset.configTab="maestro-piezas";b.textContent="Maestro de Piezas";tabbar.append(b);
 const panel=document.createElement("div");panel.className="config-panel";panel.dataset.configPanel="maestro-piezas";panel.hidden=true;panel.innerHTML='<h3>Maestro de Piezas de Aluminio</h3><p>Consulta de códigos SAP, tipo, destino, líneas y estado. La edición se habilitará cuando esté aprobada la RPC segura.</p><button type="button" id="masterRefresh">Consultar Maestro</button><input id="masterSearch" placeholder="Buscar código SAP o clasificación" aria-label="Buscar Maestro"><p id="masterStatus" role="status"></p><div class="table-wrap"><table><thead><tr><th>SAP</th><th>Tipo</th><th>Destino</th><th>Líneas</th><th>Activo</th></tr></thead><tbody id="masterBody"></tbody></table></div>';mount.append(panel);
 b.addEventListener("click",()=>{mount.querySelectorAll("[data-config-tab]").forEach(x=>x.classList.toggle("active",x===b));mount.querySelectorAll("[data-config-panel]").forEach(x=>x.hidden=x!==panel);refresh()});
 let records=[];async function refresh(){const status=panel.querySelector("#masterStatus");status.textContent="Consultando…";try{records=await listPieceMaster();render();status.textContent=records.length+" registros consultados";}catch(e){status.textContent=e.message;}}
 function render(){const q=panel.querySelector("#masterSearch").value.toLowerCase();panel.querySelector("#masterBody").innerHTML=records.filter(x=>[x.codigo_sap,x.tipo_pieza,x.destino_productivo].join(" ").toLowerCase().includes(q)).map(x=>`<tr><td>${esc(x.codigo_sap)}</td><td>${esc(x.tipo_pieza)}</td><td>${esc(x.destino_productivo)}</td><td>${esc((x.lineas_aplicables||[]).join(", "))}</td><td>${esc(x.activo)}</td></tr>`).join("");}
 panel.querySelector("#masterRefresh").addEventListener("click",refresh);panel.querySelector("#masterSearch").addEventListener("input",render);
 }
 const dialog=document.createElement("dialog");dialog.id="pieceMasterDialog";dialog.style.cssText="width:min(960px,95vw);max-height:90dvh;border:1px solid #cbd5e1;border-radius:14px;padding:20px;overflow:auto";dialog.innerHTML='<h2>Completar Maestro de Piezas</h2><p id="missingMasterStatus"></p><div id="missingMasterRows"></div><button type="button" id="missingMasterClose">Cerrar y conservar carga</button>';document.body.append(dialog);
 dialog.querySelector("#missingMasterClose").addEventListener("click",()=>dialog.close());
}
export function showMissingPieceMaster(rows){
 initPieceMasterUI();missing=groupMissingPieceCodes(rows);const dialog=document.getElementById("pieceMasterDialog");if(!dialog)return;
 dialog.querySelector("#missingMasterStatus").textContent=`${missing.length} código(s) SAP pendientes, ${rows.length} fila(s) afectadas. El guardado estará disponible tras aprobar permisos de escritura.`;
 dialog.querySelector("#missingMasterRows").innerHTML=missing.map((r,i)=>`<fieldset style="margin:12px 0;border:1px solid #d5e2f5;border-radius:10px;padding:12px"><legend><b>${esc(r.codigo_sap)}</b> — ${r.filas} fila(s)</legend><p>${esc(r.descripcion||"Sin descripción")}</p><label>Tipo de pieza <select disabled>${options(PIECE_TYPES)}</select></label> <label>Destino productivo <select disabled>${options(PIECE_DESTINATIONS)}</select></label><p>Líneas: ${esc(r.lineas.join(", "))}</p><label>Observación <input disabled placeholder="Observación del Maestro"></label></fieldset>`).join("");
 if(!dialog.open)dialog.showModal();
}
